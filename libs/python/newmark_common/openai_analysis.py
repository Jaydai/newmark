"""AI-based article analysis for Newmark signal detection.

Houses the system prompt (single source of truth) and the analysis function
used by all scraper agents (CU5 veille presse, CU3 newsletter).

This is a SIMPLE classification task (6 JSON fields) → uses DeepSeek by default.
Override via AI_MODEL env var if needed.

Configuration via 3 environment variables:
  - AZURE_AI_ENDPOINT : Azure OpenAI resource endpoint
  - AZURE_AI_KEY      : Azure OpenAI API key
  - AI_MODEL          : Deployment name (default: DeepSeek-V3.2 — cheapest)
"""

import json
import logging
import os
import re

from openai import AzureOpenAI

# ---------------------------------------------------------------------------
# System prompt — single source of truth
# ---------------------------------------------------------------------------
NEWMARK_SIGNAL_PROMPT = """\
Tu es un analyste spécialisé en immobilier tertiaire et commerce pour Newmark France.
Réponds UNIQUEMENT en JSON valide :
{
  "entreprise": "Nom de l'entreprise principale",
  "categorie": "LEVEE_FONDS|RECRUTEMENT|NOMINATION|TRANSACTION|EXPANSION|ACQUISITION",
  "score_prospect": 1,
  "secteur": "Tech|Finance|Santé|Industrie|Retail|Services|Immobilier|Autre",
  "resume_signal": "Synthèse en 1 phrase du signal détecté",
  "action_suggeree": "Action concrète pour l'équipe commerciale",
  "pertinent": true
}
Score 3 (CHAUD) : Levée >10M€, recrutement >50 postes IDF, nomination DG/CEO/CFO, acquisition majeure
Score 2 (À SURVEILLER) : Levée 2-10M€, recrutement 20-50 postes, expansion régionale
Score 1 (RADAR) : Levée <2M€, nomination mid-management, partenariat
pertinent=false : Article sans signal d'affaires pour l'immobilier tertiaire/commerce
JSON uniquement, aucun texte autour."""

# ---------------------------------------------------------------------------
# Configuration — all via env vars, switchable without code changes
# ---------------------------------------------------------------------------
AZURE_AI_ENDPOINT = os.getenv("AZURE_AI_ENDPOINT")
AZURE_AI_KEY = os.getenv("AZURE_AI_KEY")
DEFAULT_MODEL = os.getenv("AI_MODEL", "DeepSeek-V3.2")  # Cheap model for classification

# ---------------------------------------------------------------------------
# Client — AzureOpenAI (works with Standard deployments in Foundry)
# ---------------------------------------------------------------------------
_client = None

if AZURE_AI_ENDPOINT and AZURE_AI_KEY:
    _client = AzureOpenAI(
        azure_endpoint=AZURE_AI_ENDPOINT,
        api_key=AZURE_AI_KEY,
        api_version="2025-01-01-preview",
    )
    print(f"[AI_INIT] Client ready → endpoint={AZURE_AI_ENDPOINT}, model={DEFAULT_MODEL}, api_version=2025-01-01-preview", flush=True)
else:
    print(f"[AI_INIT] CLIENT NOT CONFIGURED! AZURE_AI_ENDPOINT={AZURE_AI_ENDPOINT!r}, AZURE_AI_KEY={'SET' if AZURE_AI_KEY else 'NOT SET'}", flush=True)
    logging.error(
        "AI client not configured. Set AZURE_AI_ENDPOINT and AZURE_AI_KEY. "
        "Get both from: ai.azure.com → your project → Deployments → your model"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _strip_code_fences(text: str) -> str:
    """Remove markdown ```json ... ``` wrappers that LLMs sometimes add."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def analyze_article(title, content, source, _api_key=None, *, model=None):
    """Send an article to the configured AI backend for signal analysis.

    Returns the parsed JSON dict, or None on failure / non-pertinent.

    Args:
        title: Article title.
        content: Article body text.
        source: Source name (e.g. "Business Immo - Bureau").
        _api_key: DEPRECATED — ignored. Kept for backward compatibility.
        model: Override the default model name.
    """
    if _client is None:
        logging.error("No AI client available — skipping analysis")
        return None

    model = model or DEFAULT_MODEL

    try:
        response = _client.chat.completions.create(
            model=model,
            temperature=0.1,
            messages=[
                {"role": "system", "content": NEWMARK_SIGNAL_PROMPT},
                {"role": "user", "content": f"Source: {source}\nTitre: {title}\n\nContenu:\n{content}"},
            ],
        )

        result_text = response.choices[0].message.content.strip()
        result_text = _strip_code_fences(result_text)
        return json.loads(result_text)

    except Exception as e:
        print(f"[AI_ERROR] Article analysis error (model={model}): {type(e).__name__}: {e}", flush=True)
        logging.error("Article analysis error (model=%s): %s", model, e)
        return None
