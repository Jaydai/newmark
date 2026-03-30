"""AI-based article classification & transaction extraction.

Uses Azure OpenAI (via Foundry) to:
1. Determine if an article is a real estate transaction
2. If yes, extract ~35 structured fields matching the client's Excel template

This is a COMPLEX extraction task (35+ fields) → uses gpt-4o-mini by default.
DeepSeek is too unreliable for this many fields.

Configuration via environment variables:
  - AZURE_AI_ENDPOINT : Azure OpenAI resource endpoint
  - AZURE_AI_KEY      : Azure OpenAI API key
  - AI_MODEL          : Deployment name (default: gpt-4o-mini — more reliable)
"""

import json
import logging
import os
import re

from openai import AzureOpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
AZURE_AI_ENDPOINT = os.getenv("AZURE_AI_ENDPOINT")
AZURE_AI_KEY = os.getenv("AZURE_AI_KEY")
DEFAULT_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

# ---------------------------------------------------------------------------
# Client — AzureOpenAI (same pattern as openai_analysis.py)
# ---------------------------------------------------------------------------
_client = None

if AZURE_AI_ENDPOINT and AZURE_AI_KEY:
    _client = AzureOpenAI(
        azure_endpoint=AZURE_AI_ENDPOINT,
        api_key=AZURE_AI_KEY,
        api_version="2025-01-01-preview",
    )
    print(f"[AI_INIT] CU1 client ready → endpoint={AZURE_AI_ENDPOINT}, model={DEFAULT_MODEL}, api_version=2025-01-01-preview", flush=True)
else:
    print(f"[AI_INIT] CU1 CLIENT NOT CONFIGURED! AZURE_AI_ENDPOINT={AZURE_AI_ENDPOINT!r}, AZURE_AI_KEY={'SET' if AZURE_AI_KEY else 'NOT SET'}", flush=True)
    logging.error(
        "AI client not configured. Set AZURE_AI_ENDPOINT and AZURE_AI_KEY."
    )

# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """\
Tu es un analyste immobilier expert. On te donne un article de presse immobilière.

**Étape 1 — Classification**
Détermine si l'article décrit une **transaction immobilière** (vente, acquisition, cession d'actif, portefeuille, sale & leaseback, VEFA, etc.).

**Étape 2 — Extraction** (uniquement si c'est une transaction)
Extrais les champs suivants en JSON. Laisse `null` si l'information n'est pas dans l'article.

{
  "est_transaction": true,
  "nom_immeuble": "Nom de l'immeuble ou du site",
  "adresse": "Adresse complète si mentionnée",
  "departement_cp": "Code postal ou département (ex: 75008, 92)",
  "commune": "Ville",
  "sous_secteur_geo": "Quartier ou sous-marché (ex: QCA, La Défense)",
  "region": "Région (ex: Île-de-France, PACA)",

  "bureaux_pct": "% bureau (0-100)",
  "commerces_pct": "% commerce",
  "industriel_pct": "% industriel/logistique",
  "residentiel_pct": "% résidentiel",
  "hotel_pct": "% hôtel",
  "sante_pct": "% santé",

  "vendeurs": "Nom du/des vendeur(s)",
  "profil_vendeur": "Type: Foncière, Investisseur, Promoteur, Utilisateur, etc.",
  "nationalite_vendeur": "Nationalité du vendeur",
  "acquereurs": "Nom du/des acquéreur(s)",
  "profil_acquereur": "Type acquéreur",
  "nationalite_acquereur": "Nationalité de l'acquéreur",
  "nb_acquereurs": 1,

  "prix_hd": "Prix hors droits en M€ (nombre ou null)",
  "prix_aem": "Prix acte en mains en M€",
  "prix_retenu": "Prix retenu pour l'analyse en M€",
  "estime": "Estimation si prix non confirmé (true/false)",
  "surface_m2": "Surface en m²",
  "prix_m2": "Prix au m² si calculable",
  "taux_rendement": "Taux de rendement en % si mentionné",

  "etat": "Neuf, Rénové, En l'état, VEFA",
  "type_transaction": "Acquisition, Cession, Sale & Leaseback, Portefeuille",
  "vefa": "Oui/Non — Vente en Futur État d'Achèvement",
  "locataires": "Nom du/des locataire(s) principal(aux)",
  "loyer": "Loyer annuel en M€ si mentionné",
  "walb": "Durée résiduelle du bail (WALB) en années",
  "brokers": "Nom des conseils/brokers mentionnés",
  "commentaires": "Informations complémentaires notables",

  "titre_article": "Titre original de l'article",
  "source": "Source de l'article",
  "url": "URL de l'article"
}

**Si ce n'est PAS une transaction**, renvoie uniquement :
{
  "est_transaction": false,
  "titre": "Titre de l'article",
  "resume": "Résumé en 1 phrase",
  "url": "URL",
  "source": "Source"
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def classify_and_extract_transaction(
    title: str, content: str, source: str, url: str
) -> dict | None:
    """Send article to AI for classification and optional extraction.

    Returns a dict with 'est_transaction' key, or None on failure.
    """
    if _client is None:
        print("[AI_ERROR] No AI client available — skipping analysis", flush=True)
        return None

    user_message = (
        f"**Titre:** {title}\n"
        f"**Source:** {source}\n"
        f"**URL:** {url}\n\n"
        f"**Contenu:**\n{content}"
    )

    try:
        response = _client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": EXTRACTION_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        return json.loads(raw)

    except json.JSONDecodeError as e:
        print(f"[AI_ERROR] JSON parse error for '{title}': {e}", flush=True)
        return None
    except Exception as e:
        print(f"[AI_ERROR] AI error for '{title}' (model={DEFAULT_MODEL}): {type(e).__name__}: {e}", flush=True)
        return None
