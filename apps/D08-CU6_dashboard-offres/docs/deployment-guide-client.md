# Dashboard Suivi des Offres — Guide de Déploiement Client

## Sommaire

1. [Présentation de l'application](#1-présentation-de-lapplication)
2. [Architecture & Sécurité](#2-architecture--sécurité)
3. [Options de déploiement](#3-options-de-déploiement)
4. [Procédure détaillée par option](#4-procédure-détaillée-par-option)
5. [Prérequis techniques](#5-prérequis-techniques)
6. [FAQ Sécurité](#6-faq-sécurité)

---

## 1. Présentation de l'application

Le **Dashboard Suivi des Offres** est une application web qui permet de visualiser et analyser les KPIs immobiliers à partir de fichiers Excel de suivi des offres.

**Fonctionnalités :**
- Importation de fichiers Excel (`.xlsx`) depuis un poste local ou directement depuis SharePoint
- Tableau de bord interactif avec KPIs agrégés, graphiques et tableaux détaillés
- Analyse par secteur de marché, gestionnaire, type de contrat, surfaces, loyers, etc.
- Authentification Microsoft Entra ID (Azure AD)

**Caractéristiques techniques :**
- Application web statique (HTML/CSS/JS) — aucun serveur backend
- Tout le traitement des données se fait **dans le navigateur du client**
- Aucune donnée n'est stockée, transmise ou conservée par l'application
- Hébergée sur **Azure Static Web Apps** (infrastructure Microsoft)

---

## 2. Architecture & Sécurité

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVIGATEUR UTILISATEUR                 │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Authentifica- │    │  Fichier     │    │  Tableau de  │  │
│  │ tion Entra ID│───►│  Excel       │───►│  bord KPI    │  │
│  │ (SSO)        │    │  (local ou   │    │  (graphiques │  │
│  │              │    │  SharePoint) │    │  et données) │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
└─────────┼───────────────────┼───────────────────────────────┘
          │                   │
          ▼                   ▼
   Microsoft Entra ID   Microsoft Graph API
   (authentification)   (accès SharePoint)
```

### Principes de sécurité

| Aspect | Détail |
|---|---|
| **Authentification** | Microsoft Entra ID (Azure AD) — SSO avec le compte professionnel de l'utilisateur |
| **Autorisation** | Seuls les tenants (organisations) explicitement autorisés peuvent se connecter |
| **Données** | Traitées exclusivement dans le navigateur — aucun transit vers un serveur tiers |
| **Stockage** | Aucune donnée n'est stockée par l'application — ni base de données, ni cache serveur |
| **SharePoint** | Permissions déléguées — l'application agit **au nom de l'utilisateur connecté**, qui ne voit que les fichiers auxquels il a déjà accès |
| **Hébergement** | Azure Static Web Apps — infrastructure Microsoft, certifiée SOC 2, ISO 27001 |
| **Chiffrement** | HTTPS obligatoire (TLS 1.2+), certificat SSL géré automatiquement par Azure |

---

## 3. Options de déploiement

Deux options sont proposées selon le niveau d'isolation souhaité par le client.

### Option A — Application partagée (multi-tenant)

> **Recommandée pour un démarrage rapide et sans coût supplémentaire.**

L'application est hébergée sur l'infrastructure Jaydai. Le client y accède en se connectant avec son compte Microsoft professionnel.

```
  https://dashboard.jayd.ai
  ├── Utilisateur Jaydai    → voit les fichiers SharePoint Jaydai
  ├── Utilisateur Client A  → voit les fichiers SharePoint Client A
  └── Utilisateur Client B  → voit les fichiers SharePoint Client B
```

| Critère | Détail |
|---|---|
| **Hébergement** | Infrastructure Jaydai (Azure Static Web Apps) |
| **URL** | `https://dashboard.jayd.ai` (ou sous-domaine personnalisé) |
| **Isolation des données** | Garantie par Microsoft Entra ID — chaque utilisateur n'accède qu'aux données de son propre tenant |
| **Coût pour le client** | Aucun coût supplémentaire |
| **Maintenance** | Assurée par Jaydai |
| **Mise en place** | ~30 minutes (ajout du tenant, consentement admin) |

#### Ce que le client doit fournir :
1. L'ID du tenant Microsoft Entra ID de son organisation
2. Un administrateur qui accorde le consentement pour l'application (one-time)

#### Ce que Jaydai fait :
1. Ajoute le tenant du client à la liste des tenants autorisés
2. (Optionnel) Configure un sous-domaine personnalisé (ex : `client.jayd.ai`)

---

### Option B — Instance dédiée (single-tenant)

> **Pour les clients qui exigent un contrôle total de l'infrastructure.**

L'application est déployée sur l'infrastructure Azure du client. Le client est propriétaire de toute la chaîne.

```
  https://dashboard.client.com
  └── Hébergé sur Azure du client
      └── App registration dans le tenant du client
          └── Seuls les utilisateurs du client peuvent se connecter
```

| Critère | Détail |
|---|---|
| **Hébergement** | Infrastructure Azure du client |
| **URL** | Domaine au choix du client (ex : `dashboard.newmark.com`) |
| **Isolation des données** | Totale — infrastructure, code et configuration chez le client |
| **Coût pour le client** | Azure Static Web Apps Free ($0) ou Standard (~$9/mois) |
| **Maintenance** | Le client ou Jaydai (selon contrat de support) |
| **Mise en place** | ~2 heures (configuration Azure + déploiement) |

#### Ce que le client doit fournir :
1. Un abonnement Azure (gratuit ou payant)
2. Un administrateur avec droits sur Azure et Microsoft Entra ID
3. (Optionnel) Un nom de domaine pour l'URL personnalisée

#### Ce que Jaydai livre :
1. Le code source de l'application (accès au dépôt GitHub ou archive)
2. Le workflow de déploiement automatique (GitHub Actions)
3. La documentation de configuration
4. (Optionnel) Accompagnement à la mise en place

---

### Comparatif

| | Option A — Partagée | Option B — Dédiée |
|---|---|---|
| **Vitesse de mise en place** | 30 minutes | 2 heures |
| **Coût pour le client** | $0 | $0–9/mois |
| **Isolation infrastructure** | Partagée (Azure Jaydai) | Totale (Azure client) |
| **Isolation données** | Garantie par Entra ID | Garantie par infrastructure |
| **Mises à jour** | Automatiques (Jaydai) | Manuelles ou CI/CD client |
| **Personnalisation URL** | Sous-domaine jayd.ai | Domaine client |
| **Contrôle total** | Non | Oui |
| **Conformité stricte** | Standard | Maximale |

---

## 4. Procédure détaillée par option

### Option A — Mise en place (partagée)

**Étape 1 — Côté client : Fournir l'ID du tenant**

L'administrateur IT du client communique à Jaydai l'ID de son tenant Microsoft Entra ID.

Pour le trouver :
1. Aller sur https://entra.microsoft.com
2. Vue d'ensemble → **Tenant ID** (format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Étape 2 — Côté Jaydai : Autoriser le tenant**

Jaydai ajoute l'ID du tenant du client à la liste des tenants autorisés dans l'app registration Azure.

**Étape 3 — Côté client : Accorder le consentement administrateur**

Un administrateur du tenant client doit accorder le consentement pour les permissions de l'application.

Permissions requises (déléguées — agissent au nom de l'utilisateur) :

| Permission | Usage | Sensibilité |
|---|---|---|
| `User.Read` | Lire le profil de l'utilisateur connecté | Faible |
| `Files.Read.All` | Lire les fichiers SharePoint accessibles à l'utilisateur | Moyenne |
| `Sites.Read.All` | Lister les sites SharePoint accessibles à l'utilisateur | Moyenne |

> **Note :** Ces permissions sont en lecture seule. L'application ne peut ni modifier, ni supprimer, ni créer de fichiers.

L'administrateur accorde le consentement via l'URL suivante (remplacer `{TENANT_ID}` par l'ID du tenant client) :

```
https://login.microsoftonline.com/{TENANT_ID}/adminconsent?client_id=1aac185e-4745-45e9-bd8d-895c50fd8ab0
```

**Étape 4 — Utilisation**

Les utilisateurs du client accèdent à `https://dashboard.jayd.ai`, se connectent avec leur compte professionnel, et utilisent l'application.

---

### Option B — Mise en place (dédiée)

**Étape 1 — Créer une Azure Static Web App**

1. Aller sur https://portal.azure.com
2. Rechercher **Static Web Apps** → **Créer**
3. Paramètres :
   - Nom : `dashboard-suivi-offres`
   - Plan : **Free** (ou Standard si besoin de fonctionnalités avancées)
   - Région : **West Europe** (recommandé)
   - Source : **GitHub** → connecter le dépôt fourni par Jaydai
4. Créer la ressource

**Étape 2 — Enregistrer l'application dans Entra ID**

1. Aller sur https://entra.microsoft.com
2. **Applications** → **App registrations** → **New registration**
3. Paramètres :
   - Nom : `Dashboard Suivi Offres`
   - Types de comptes : **Comptes dans cet annuaire organisationnel uniquement** (single-tenant)
   - URI de redirection : **Single-page application (SPA)**
     - `https://<url-de-la-static-web-app>`
     - `http://localhost:3000` (pour le développement)
4. Cliquer sur **Register**
5. Noter l'**Application (client) ID** et le **Directory (tenant) ID**

**Étape 3 — Configurer les permissions API**

1. Dans l'app registration → **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Delegated permissions** :
   - `User.Read`
   - `Files.Read.All`
   - `Sites.Read.All`
3. Cliquer sur **Grant admin consent**

**Étape 4 — Configurer les variables d'environnement**

Dans le dépôt GitHub, aller dans **Settings** → **Secrets and variables** → **Actions** :

| Secret / Variable | Valeur |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token de déploiement (Azure Portal → Static Web App → Manage deployment token) |

Dans le fichier `.github/workflows/deploy.yml`, mettre à jour :

```yaml
env:
  NEXT_PUBLIC_AZURE_CLIENT_ID: "<Application (client) ID>"
  NEXT_PUBLIC_AZURE_TENANT_ID: "<Directory (tenant) ID>"
```

**Étape 5 — Déployer**

Pousser le code sur la branche `main` → le déploiement se fait automatiquement via GitHub Actions.

**Étape 6 — (Optionnel) Configurer un domaine personnalisé**

1. Azure Portal → Static Web App → **Custom domains** → **Add**
2. Ajouter un enregistrement CNAME dans le DNS du client
3. Valider dans Azure (certificat SSL provisionné automatiquement)

---

## 5. Prérequis techniques

### Pour l'Option A (partagée)
- Un tenant Microsoft Entra ID (inclus avec tout abonnement Microsoft 365)
- Un administrateur pouvant accorder le consentement pour l'application
- Des navigateurs modernes (Chrome, Edge, Firefox, Safari)

### Pour l'Option B (dédiée)
- Tout ce qui précède, plus :
- Un abonnement Azure (le tier gratuit suffit)
- Un compte GitHub (pour le déploiement automatique)
- (Optionnel) Un nom de domaine avec accès à la configuration DNS

---

## 6. FAQ Sécurité

**L'application stocke-t-elle des données ?**
> Non. L'application est entièrement client-side. Les fichiers Excel sont traités dans le navigateur de l'utilisateur. Aucune donnée ne transite par un serveur Jaydai ni n'est stockée.

**Qui peut accéder à l'application ?**
> Seuls les utilisateurs appartenant à un tenant Microsoft Entra ID explicitement autorisé peuvent se connecter. Les tenants non autorisés sont rejetés au niveau de Microsoft Entra ID, avant même que l'application ne se charge.

**Quelles données l'application peut-elle lire sur SharePoint ?**
> L'application utilise des permissions **déléguées** (et non des permissions d'application). Cela signifie qu'elle agit au nom de l'utilisateur connecté et ne peut voir que les fichiers auxquels cet utilisateur a déjà accès dans SharePoint. Un utilisateur sans accès à un site SharePoint ne verra pas ce site dans l'application.

**L'application peut-elle modifier ou supprimer des fichiers ?**
> Non. Les permissions demandées sont exclusivement en lecture (`Read`). L'application ne peut ni créer, ni modifier, ni supprimer de fichiers ou de données.

**Les données transitent-elles par des serveurs tiers ?**
> Non. L'authentification se fait directement avec Microsoft Entra ID. L'accès aux fichiers SharePoint se fait directement via l'API Microsoft Graph. L'application web statique ne fait que fournir le code JavaScript exécuté dans le navigateur.

**Quelle certification possède l'hébergement ?**
> Azure Static Web Apps est hébergé sur l'infrastructure Microsoft Azure, certifiée SOC 1, SOC 2, ISO 27001, ISO 27018, HIPAA, et conforme au RGPD.

**Est-il possible de révoquer l'accès ?**
> Oui. L'administrateur du tenant client peut à tout moment :
> - Révoquer le consentement de l'application dans Entra ID
> - Supprimer l'application des "Enterprise applications" du tenant
> - L'accès est immédiatement coupé pour tous les utilisateurs du tenant

---

*Document préparé par Jaydai — Contact : quentin@jayd.ai*
