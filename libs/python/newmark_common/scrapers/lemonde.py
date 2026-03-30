"""Le Monde Premium scraper — cookie-based auth, article extraction.

Uses requests (no browser needed) — Le Monde doesn't block automated access
as aggressively as Business Immo.
"""

import logging
import re

import requests
from bs4 import BeautifulSoup


def login(email, password):
    """Authenticate to Le Monde and return an authenticated requests.Session."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
    })

    login_url = "https://secure.lemonde.fr/sfuser/connexion"
    login_page = session.get(login_url)
    soup = BeautifulSoup(login_page.text, "html.parser")

    login_data = {"email": email, "password": password}
    csrf_input = soup.find("input", {"name": "_csrf_token"})
    if csrf_input:
        login_data["_csrf_token"] = csrf_input.get("value", "")

    session.post(login_url, data=login_data, allow_redirects=True)
    logging.info("Le Monde login submitted")
    return session


def get_recent_articles(session, section_url, max_articles=10):
    """Fetch recent article links from a Le Monde section.

    section_url: e.g. "economie", "immobilier"
    """
    url = f"https://www.lemonde.fr/{section_url}/"
    response = session.get(url)
    soup = BeautifulSoup(response.text, "html.parser")

    articles = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        href = link.get("href", "")
        if f"/{section_url}/" not in href:
            continue
        if not re.search(r"/article/\d{4}/\d{2}/\d{2}/", href) and \
           not re.search(r"_\d{6,}_\d+\.html", href):
            continue

        full_url = href if href.startswith("http") else f"https://www.lemonde.fr{href}"
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        title = link.get_text(strip=True)
        if len(title) < 15:
            continue

        articles.append({"title": title, "url": full_url})
        if len(articles) >= max_articles:
            break

    return articles


def get_article_content(session, url):
    """Extract the text content of a Le Monde article.

    Uses article__paragraph class first, then <article> fallback.
    """
    response = session.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    content_parts = []

    # Strategy 1: p.article__paragraph
    paragraphs = soup.find_all("p", class_=re.compile(r"article__paragraph"))
    if paragraphs:
        for p in paragraphs:
            text = p.get_text(strip=True)
            if text:
                content_parts.append(text)

    # Strategy 2: <article> fallback
    if not content_parts:
        article_tag = soup.find("article")
        if article_tag:
            for p in article_tag.find_all("p"):
                text = p.get_text(strip=True)
                if text and len(text) > 30:
                    content_parts.append(text)

    return "\n".join(content_parts[:20])[:2000]
