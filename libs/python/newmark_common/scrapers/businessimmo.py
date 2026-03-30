"""Business Immo scraper — login, list articles, extract content.

Requires Playwright Firefox (Chromium blocked by Akamai Bot Manager).
"""

import logging
import re
import time

from bs4 import BeautifulSoup

BASE_URL = "https://www.businessimmo.com"


def _accept_cookies(page):
    """Dismiss Osano cookie consent banner if present."""
    try:
        page.evaluate("""
            const btn = document.querySelector('button.osano-cm-accept-all');
            if (btn) btn.click();
        """)
        time.sleep(1)
        logging.info("Cookie consent accepted")
    except Exception:
        pass


def login(page, email, password):
    """Log in to Business Immo via the connection modal."""
    print("[SCRAPER] Logging in to Business Immo...", flush=True)
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    print("[SCRAPER] Homepage loaded", flush=True)
    time.sleep(2)

    # Must accept cookies BEFORE login, otherwise session cookies aren't stored
    _accept_cookies(page)

    try:
        login_link = page.query_selector('a:has-text("Se connecter")')
        if login_link:
            login_link.click()
            print("[SCRAPER] Waiting for login form...", flush=True)
            page.wait_for_selector("#username", state="visible", timeout=30000)

            page.fill("#username", email)
            page.fill("#password", password)

            submit_btn = page.query_selector('button:has-text("Connectez-vous")')
            if submit_btn:
                submit_btn.click()
                time.sleep(5)
                print("[SCRAPER] Login submitted", flush=True)
        else:
            print("[SCRAPER] No 'Se connecter' link found — may already be logged in", flush=True)
    except Exception as e:
        print(f"[SCRAPER] Login flow error (continuing anyway): {e}", flush=True)


def get_recent_articles(page, section_path, section_label, max_articles=10):
    """Fetch recent article links from a Business Immo section page."""
    url = f"{BASE_URL}/{section_path}"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
    except Exception as e:
        logging.warning("Navigation error for %s: %s", section_label, e)
        return []

    time.sleep(2)
    soup = BeautifulSoup(page.content(), "html.parser")
    articles = []
    seen_urls = set()

    for h2 in soup.find_all("h2"):
        link = h2.find("a", href=re.compile(r"/actualites/article/\d+/"))
        if not link:
            continue

        href = link.get("href", "")
        full_url = href if href.startswith("http") else f"{BASE_URL}{href}"
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        title = h2.get_text(strip=True)
        if not title or len(title) < 10:
            continue

        articles.append({"title": title, "url": full_url})
        if len(articles) >= max_articles:
            break

    return articles


_PAYWALL_MARKERS = [
    "articles premium",
    "Profitez d'avantages",
    "offres sur-mesure",
    "licence Business Immo",
    "dernières actualités du marché en temps réel",
    "Des contenus à 360",
    "fiches contact dans notre annuaire",
    "transactions révélées en",
    "découvrir l'ensemble de nos avantages",
]


def _is_paywall_text(text: str) -> bool:
    """Return True if the paragraph looks like paywall / promo content."""
    return any(marker in text for marker in _PAYWALL_MARKERS)


def get_article_content(page, url):
    """Extract the text content of a Business Immo article.

    Tries Playwright live-DOM extraction first (handles JS-rendered pages),
    falls back to BeautifulSoup for legacy layouts.
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
    except Exception:
        return ""

    # ── Strategy 1: wait for JS-rendered article body and extract via Playwright ──
    for selector in [
        ".RichTextArticleBody-body",
        ".RichTextArticleBody",
        ".article-body-html",
    ]:
        try:
            page.wait_for_selector(selector, timeout=5000)
            # Brief wait for content rendering
            time.sleep(1)
            raw_text = page.inner_text(selector)
            if raw_text and len(raw_text.strip()) > 50:
                # Filter out paywall lines
                lines = [
                    line.strip() for line in raw_text.split("\n")
                    if line.strip() and len(line.strip()) > 10
                    and not _is_paywall_text(line)
                ]
                if lines:
                    return "\n".join(lines[:40])[:10000]
        except Exception:
            continue

    # ── Strategy 2: fallback to BeautifulSoup (legacy layout) ──
    time.sleep(1)
    soup = BeautifulSoup(page.content(), "html.parser")
    content_parts = []

    richtext = soup.find(class_="richtext")
    if richtext:
        for p in richtext.find_all("p"):
            text = p.get_text(strip=True)
            if text and len(text) > 20 and not _is_paywall_text(text):
                content_parts.append(text)

    if not content_parts:
        article_tag = soup.find("article")
        if article_tag:
            for p in article_tag.find_all("p"):
                text = p.get_text(strip=True)
                if text and len(text) > 20 and not _is_paywall_text(text):
                    content_parts.append(text)

    if not content_parts:
        main = soup.find("main")
        if main:
            for p in main.find_all("p"):
                text = p.get_text(strip=True)
                if text and len(text) > 30 and not _is_paywall_text(text):
                    content_parts.append(text)

    return "\n".join(content_parts[:40])[:10000]
