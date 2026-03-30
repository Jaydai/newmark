"""Playwright Firefox launcher shared across agents.

Azure Functions runs as root but sets HOME=/home (owned by 'app').
Firefox refuses to start in this configuration. fix_azure_home() patches
HOME *before* Playwright spawns the browser process.
"""

import logging
import os


def fix_azure_home():
    """Override HOME=/root when running as root on Azure Functions."""
    if os.getuid() == 0 and os.environ.get("HOME") != "/root":
        os.environ["HOME"] = "/root"
        logging.info("HOME overridden to /root for Azure Functions root user")


def launch_firefox(playwright, *, headless=True):
    """Launch a Firefox instance with fr-FR locale.

    Returns (browser, context, page).
    """
    browser = playwright.firefox.launch(headless=headless)
    context = browser.new_context(
        locale="fr-FR",
        viewport={"width": 1280, "height": 720},
    )
    page = context.new_page()
    return browser, context, page
