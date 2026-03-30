"""La Place de l'Immobilier (laplacedelimmobilier-pro.com) web scraper.

Uses Playwright Firefox to log in and search for property owners.
Reuses newmark_common.browser.launch_firefox() for Playwright setup.

Architecture:
  - Login goes to the React SPA at /app/webapp/login
  - Owner search uses the legacy app at /LPdI/fr_FR/owner/search
  - Results are a table of companies with links to detail pages
  - Detail pages show SIREN, forme juridique, dirigeants, financials
"""

import logging
import os
import re
import time

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

LAPLACE_URL = "https://www.laplacedelimmobilier-pro.com"
LAPLACE_EMAIL = os.environ.get("LAPLACE_EMAIL", "")
LAPLACE_PASSWORD = os.environ.get("LAPLACE_PASSWORD", "")

_NAV_TIMEOUT = 60_000
_SELECTOR_TIMEOUT = 30_000


def login(page) -> bool:
    """Log in to La Place de l'Immobilier via the React SPA login form.

    The login page is at /app/webapp/login with:
      - textbox "Saisissez votre e-mail"
      - textbox "Saisissez votre mot de passe"
      - button "Se connecter"
      - Cookie consent dialog (Axeptio) with button "OK pour moi"

    After login, redirects to /app/webapp/home with title "Bienvenue {name} !".
    """
    if not LAPLACE_EMAIL or not LAPLACE_PASSWORD:
        logger.warning("La Place credentials not set — skipping")
        return False

    try:
        page.goto(f"{LAPLACE_URL}/app/webapp/login", wait_until="domcontentloaded", timeout=_NAV_TIMEOUT)
        time.sleep(3)  # React SPA needs time to render

        # Dismiss Axeptio cookie consent
        _accept_cookies(page)

        # Fill login form
        email_input = page.get_by_role("textbox", name="Saisissez votre e-mail")
        email_input.wait_for(state="visible", timeout=_SELECTOR_TIMEOUT)
        email_input.fill(LAPLACE_EMAIL)

        password_input = page.get_by_role("textbox", name="Saisissez votre mot de passe")
        password_input.fill(LAPLACE_PASSWORD)

        # Submit
        page.get_by_role("button", name="Se connecter").click()

        # Wait for redirect to home page
        page.wait_for_url("**/home**", timeout=_NAV_TIMEOUT)
        time.sleep(2)

        logger.info("La Place: login successful")
        return True

    except Exception as exc:
        logger.error("La Place login failed: %s", exc)
        return False


def search_address(page, address: str) -> dict:
    """Search for property owners at a given address.

    Flow:
      1. Navigate to /LPdI/fr_FR/owner/search (legacy owner search)
      2. Fill the "Localisation" textbox with the address
      3. Click "Ajouter l'adresse" to trigger autocomplete
      4. Select the first autocomplete option
      5. Click "Lancer la recherche"
      6. Parse the results table (list of companies)
      7. Visit first company detail page for SIREN + dirigeants

    Returns:
    {
        "address_query": str,
        "found": bool,
        "owners": [{"name": str, "type": str, "siren": str, "forme_juridique": str}],
        "dirigeants": [{"fonction": str, "nom": str, "societe": str}],
        "property_info": {...},
        "error": str | None,
    }
    """
    try:
        # Navigate to the legacy owner search page
        page.goto(
            f"{LAPLACE_URL}/LPdI/fr_FR/owner/search",
            wait_until="domcontentloaded",
            timeout=_NAV_TIMEOUT,
        )
        time.sleep(3)

        # Fill the address field — use type() to trigger jQuery events
        loc_input = page.locator("#autocomplete_localisation")
        if not loc_input.is_visible(timeout=_SELECTOR_TIMEOUT):
            # Fallback: find by role
            loc_input = page.get_by_role(
                "textbox", name=re.compile(r"Localisation", re.IGNORECASE)
            )
        loc_input.click()
        loc_input.fill(address)
        time.sleep(1)

        # Click "Ajouter l'adresse" to trigger autocomplete dropdown
        page.locator("a[title=\"Ajouter l'adresse\"], img[alt=\"Ajouter l'adresse\"]").first.click()
        logger.info("La Place: clicked 'Ajouter l'adresse', waiting for listbox...")

        # Wait for the autocomplete listbox to appear (can take 3-5s)
        listbox = page.get_by_role("listbox")
        listbox.wait_for(state="visible", timeout=_SELECTOR_TIMEOUT)
        time.sleep(1)

        options = listbox.get_by_role("option").all()
        if not options:
            logger.warning("La Place: no autocomplete results for '%s'", address)
            return _empty_result(address, error="No autocomplete results")

        logger.info("La Place: %d autocomplete options, selecting first", len(options))
        options[0].click()
        time.sleep(1)

        # Launch the search
        page.get_by_role("button", name="Lancer la recherche").click()

        # Wait for results table to appear
        page.locator("table.searchResultTable").wait_for(
            state="visible", timeout=_SELECTOR_TIMEOUT
        )
        time.sleep(2)

        # Parse the results table
        return _parse_results(page, address)

    except Exception as exc:
        logger.error("La Place search failed for '%s': %s", address, exc)
        return _empty_result(address, error=str(exc))


def _parse_results(page, address: str) -> dict:
    """Parse the owner search results page.

    Results page structure:
      - Heading: "{N} sociétés ..."
      - Table with columns: checkbox | Société | Maison mère | Nbre actifs | Surface en m²
      - Each Société cell contains a link to /LPdI/fr_FR/company/{id}
    """
    html = page.content()
    soup = BeautifulSoup(html, "html.parser")

    owners = []

    # Target the specific results table by class (not by header text,
    # because the outer layout table also contains "Société" headers)
    results_table = soup.find("table", class_="searchResultTable")

    if not results_table:
        # Check if there's a "0 sociétés" heading
        heading_text = soup.get_text()
        if "0 sociétés" in heading_text or "0 société" in heading_text:
            return _empty_result(address, error=None)
        logger.warning("La Place: searchResultTable not found for '%s'", address)
        return _empty_result(address, error="Results table not found")

    # Extract company rows from tbody — skip rows without <td> cells
    # (Row 0 is a sort-header row with only <th> elements and links)
    tbody = results_table.find("tbody")
    if not tbody:
        return _empty_result(address, error="No results tbody")

    for row in tbody.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        # Cell 0 = checkbox, Cell 1 = Société (with link), Cell 2 = Maison mère,
        # Cell 3 = Nbre actifs, Cell 4 = Surface
        societe_cell = cells[1]
        link = societe_cell.find("a")
        company_name = societe_cell.get_text(strip=True)
        company_url = link.get("href", "") if link else ""

        maison_mere = cells[2].get_text(strip=True) if len(cells) > 2 else ""
        nbre_actifs = cells[3].get_text(strip=True) if len(cells) > 3 else ""
        surface = cells[4].get_text(strip=True) if len(cells) > 4 else ""

        logger.info("La Place: found owner '%s' at %s", company_name, company_url)

        owners.append({
            "name": company_name,
            "type": _guess_owner_type(company_name),
            "siren": None,
            "forme_juridique": None,
            "maison_mere": maison_mere,
            "nbre_actifs": nbre_actifs,
            "surface": surface,
            "detail_url": company_url,
        })

    if not owners:
        return {
            "address_query": address,
            "found": False,
            "owners": [],
            "dirigeants": [],
            "property_info": {},
            "error": None,
        }

    # Visit the first company's detail page for SIREN + dirigeants
    first_owner = owners[0]
    detail_url = first_owner.get("detail_url", "")
    dirigeants = []

    if detail_url:
        detail_info = _scrape_company_detail(page, detail_url)
        first_owner["siren"] = detail_info.get("siren")
        first_owner["forme_juridique"] = detail_info.get("forme_juridique")
        dirigeants = detail_info.get("dirigeants", [])

    return {
        "address_query": address,
        "found": True,
        "owners": owners,
        "dirigeants": dirigeants,
        "property_info": {},
        "error": None,
    }


def _scrape_company_detail(page, detail_path: str) -> dict:
    """Scrape a company detail page for SIREN, forme juridique, and dirigeants.

    Detail page structure:
      - Heading: "// {COMPANY NAME} ( SIREN: {siren} )"
      - Table "Informations juridiques": Forme juridique, Date de création, Code NAF, etc.
      - Table "Dirigeants": Fonction | Nom | Société du contact | Age | Fonctions dans

    Args:
        detail_path: Relative URL like /LPdI/fr_FR/company/33242588
    """
    url = f"{LAPLACE_URL}{detail_path}" if detail_path.startswith("/") else detail_path

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=_NAV_TIMEOUT)
        time.sleep(2)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        result = {"siren": None, "forme_juridique": None, "dirigeants": []}

        # Extract SIREN from heading: "// COMPANY NAME ( SIREN: 907747810 )"
        for h4 in soup.find_all("h4"):
            text = h4.get_text(strip=True)
            siren_match = re.search(r"SIREN\s*:\s*(\d{9})", text)
            if siren_match:
                result["siren"] = siren_match.group(1)
                break

        # Extract forme juridique from "Informations juridiques" table
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all("td")
                if len(cells) >= 2:
                    label = cells[0].get_text(strip=True).lower()
                    value = cells[1].get_text(strip=True)
                    if "forme juridique" in label:
                        result["forme_juridique"] = value

        # Extract dirigeants from "Dirigeants" table
        # Headers: Fonction | Nom | Société du contact | Age | Fonctions dans
        dirigeants_heading = soup.find("h5", string=re.compile(r"Dirigeants", re.IGNORECASE))
        if dirigeants_heading:
            # Find the table after the heading
            dirigeants_table = dirigeants_heading.find_next("table")
            if dirigeants_table:
                tbody = dirigeants_table.find("tbody")
                rows = tbody.find_all("tr") if tbody else dirigeants_table.find_all("tr")[1:]
                for row in rows:
                    cells = row.find_all("td")
                    if len(cells) >= 3:
                        fonction = cells[0].get_text(strip=True).rstrip(":")
                        nom = cells[1].get_text(strip=True)
                        societe = cells[2].get_text(strip=True)

                        # Extract link to company detail if present
                        societe_link = cells[2].find("a")
                        societe_url = societe_link.get("href", "") if societe_link else ""

                        result["dirigeants"].append({
                            "fonction": fonction,
                            "nom": nom,
                            "societe": societe,
                            "societe_url": societe_url,
                        })

        return result

    except Exception as exc:
        logger.error("La Place: failed to scrape company detail at %s: %s", detail_path, exc)
        return {"siren": None, "forme_juridique": None, "dirigeants": []}


def _accept_cookies(page):
    """Dismiss Axeptio cookie consent banner if present."""
    try:
        # Axeptio uses: button "OK pour moi" (accept all)
        btn = page.get_by_role("button", name="Accepter les cookies")
        if btn.is_visible(timeout=3000):
            btn.click()
            time.sleep(1)
            return
    except Exception:
        pass

    # Fallback selectors
    for selector in [
        'button:has-text("OK pour moi")',
        'button:has-text("Accepter")',
        'button:has-text("Accept")',
    ]:
        try:
            btn = page.query_selector(selector)
            if btn:
                btn.click()
                time.sleep(0.5)
                return
        except Exception:
            continue


def _guess_owner_type(name: str) -> str:
    """Heuristic: detect if owner name looks like a company."""
    company_indicators = [
        "SCI", "SAS", "SARL", "SA ", "SNC", "EURL", "SCCV",
        "OPCI", "SCPI", "SIIC", "GIE", "S.À R.L.", "SÀRL",
    ]
    upper = name.upper()
    for indicator in company_indicators:
        if indicator in upper:
            return "personne_morale"
    return "personne_physique"


def _empty_result(address: str, error: str | None = None) -> dict:
    return {
        "address_query": address,
        "found": False,
        "owners": [],
        "dirigeants": [],
        "property_info": {},
        "error": error,
    }
