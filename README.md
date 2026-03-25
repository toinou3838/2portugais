# O Mestre do Português

Monorepo pour un frontend `Next.js + Clerk` et un backend `FastAPI + Postgres`, avec un déploiement recommandé:

- frontend sur Vercel
- backend sur Render
- auth sur Clerk
- base Postgres sur Render

## Ce que j’ai ajouté pour le mode “backend distant uniquement”

- [render.yaml](/Users/antoi/Library/Mobile%20Documents/com~apple~CloudDocs/Appli%20portugais%202/render.yaml)
  Blueprint Render pour créer la base Postgres et le backend web service.
- [backend/scripts/trigger_internal_job.py](/Users/antoi/Library/Mobile%20Documents/com~apple~CloudDocs/Appli%20portugais%202/backend/scripts/trigger_internal_job.py)
  Script pour des cron jobs Render qui déclenchent les endpoints de rappel ou de sync.
- [frontend/.env.example](/Users/antoi/Library/Mobile%20Documents/com~apple~CloudDocs/Appli%20portugais%202/frontend/.env.example)
  Frontend pointé vers un backend Render.
- [backend/.env.example](/Users/antoi/Library/Mobile%20Documents/com~apple~CloudDocs/Appli%20portugais%202/backend/.env.example)
  Variables alignées sur un backend de production distant.

## Déploiement recommandé

### 1. Créer dans Clerk

Dans Clerk, crée:

1. Une application Clerk.
2. Une production instance pour le vrai déploiement.
3. Les providers de connexion:
   - Google
   - Email / Password
4. Un JWT template nommé `backend`.

Le template `backend` doit avoir une audience identique à l’env backend `CLERK_AUDIENCE`, donc ici `backend`.

Claims recommandés du template:

```json
{
  "aud": "backend",
  "email": "{{user.primary_email_address}}",
  "name": "{{user.full_name}}",
  "image_url": "{{user.image_url}}"
}
```

Tu récupères ensuite dans Clerk:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- l’issuer Clerk
- le JWKS URL

Dans notre projet:

- le frontend demande `getToken({ template: "backend" })`
- le backend vérifie ce JWT avec `CLERK_ISSUER`, `CLERK_JWKS_URL` et `CLERK_AUDIENCE=backend`

## 2. Créer dans Render

Le plus simple: utilise le blueprint [render.yaml](/Users/antoi/Library/Mobile%20Documents/com~apple~CloudDocs/Appli%20portugais%202/render.yaml).

Dans Render:

1. `New` → `Blueprint`
2. Connecte le repo
3. Sélectionne la branche
4. Valide le blueprint

Ce blueprint crée:

1. Une base Postgres Render:
   - nom: `o-mestre-db`
2. Un Web Service Render:
   - nom: `o-mestre-api`
   - root directory: `backend`
   - build command: `pip install .`
   - pre-deploy command: `alembic upgrade head`
   - start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - health check: `/health`

Quand le service est créé, Render te donnera une URL publique de ce type:

```text
https://o-mestre-api.onrender.com
```

C’est cette URL que tu mettras côté Vercel dans `NEXT_PUBLIC_API_URL`.

## 3. Créer dans Vercel

Dans Vercel:

1. `New Project`
2. importe le repo
3. configure le projet sur le dossier `frontend`
4. build command: `npm run build`
5. install command: `npm install`

Après déploiement, tu auras une URL de ce type:

```text
https://ton-projet.vercel.app
```

Cette URL doit être reportée dans Render pour `CORS_ORIGINS`, et dans Clerk comme domaine de prod.

## 4. Variables à mettre exactement

### A. Variables Vercel

À définir dans le projet Vercel `frontend`:

- `NEXT_PUBLIC_API_URL`
  Valeur: `https://o-mestre-api.onrender.com`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  Valeur: ta clé publique Clerk
- `CLERK_SECRET_KEY`
  Valeur: ta clé secrète Clerk
- `NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE`
  Valeur: `backend`

### B. Variables Render du backend

Pour le service `o-mestre-api`, mets:

- `APP_NAME`
  Valeur: `O Mestre do Português API`
- `API_PREFIX`
  Valeur vide
- `ENVIRONMENT`
  Valeur: `production`
- `DEBUG`
  Valeur: `false`
- `DATABASE_URL`
  Valeur: référence à la base Render `o-mestre-db` via `connectionString`
- `CORS_ORIGINS`
  Valeur: l’URL Vercel exacte, par exemple `https://ton-projet.vercel.app`
- `CLERK_JWKS_URL`
  Valeur: ton URL JWKS Clerk
- `CLERK_ISSUER`
  Valeur: ton issuer Clerk
- `CLERK_AUDIENCE`
  Valeur: `backend`
- `CLERK_SECRET_KEY`
  Valeur: ta clé secrète Clerk
- `CLERK_API_BASE_URL`
  Valeur: `https://api.clerk.com/v1`
- `REMINDER_GOAL`
  Valeur: `50`
- `REMINDER_JOB_SECRET`
  Valeur: secret aléatoire généré par Render ou défini manuellement
- `RESEND_API_KEY`
  Optionnel, seulement si tu veux les emails
- `REMINDER_FROM_EMAIL`
  Optionnel, seulement si tu veux les emails
- `TRANSLATION_PROVIDER`
  Valeur: `local`
- `LIBRETRANSLATE_URL`
  Optionnel
- `LIBRETRANSLATE_API_KEY`
  Optionnel
- `GOOGLE_SHEETS_ENABLED`
  Valeur: `false` tant que tu n’actives pas ce mode
- `GOOGLE_SHEET_ID`
  Optionnel
- `GOOGLE_SHEET_NAME`
  Valeur: `Vocabulary`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
  Optionnel

### C. Configuration Clerk

Dans Clerk:

1. utilise une vraie production instance
2. ajoute ton domaine frontend Vercel dans la configuration de prod
3. active Google et Email / Password
4. crée le template JWT `backend`

À reporter:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Vercel
- `CLERK_SECRET_KEY` → Vercel et Render backend
- `issuer` → `CLERK_ISSUER` sur Render
- `jwks_url` → `CLERK_JWKS_URL` sur Render

## 5. Si tu ne veux rien lancer en local

Ton ordre de mise en place doit être celui-ci:

1. Clerk
2. Render Postgres + backend
3. Vercel frontend
4. retour dans Render pour mettre `CORS_ORIGINS` à l’URL Vercel finale si elle a changé
5. retour dans Clerk pour vérifier le domaine de prod

## 6. Cron jobs Render optionnels

Je ne les ai pas mis dans le blueprint principal pour éviter de te créer automatiquement des services payants supplémentaires. En revanche, le projet est prêt pour ça.

Si tu veux les reminders quotidiens, crée un `Cron Job` Render séparé:

- Name: `o-mestre-reminders`
- Root Directory: `backend`
- Runtime: `python`
- Build Command: `pip install .`
- Start Command:

```bash
python scripts/trigger_internal_job.py /jobs/reminders/send
```

- Schedule:

```text
0 20 * * *
```

- Environment variables:
  - `BACKEND_BASE_URL=https://o-mestre-api.onrender.com`
  - `REMINDER_JOB_SECRET=<la même valeur que sur le web service backend>`

Si tu veux le job Google Sheets:

- Name: `o-mestre-google-sheets-sync`
- Root Directory: `backend`
- Runtime: `python`
- Build Command: `pip install .`
- Start Command:

```bash
python scripts/trigger_internal_job.py /jobs/google-sheets/sync
```

- Environment variables:
  - `BACKEND_BASE_URL=https://o-mestre-api.onrender.com`
  - `REMINDER_JOB_SECRET=<la même valeur que sur le web service backend>`

## 7. Si tu préfères créer Render à la main au lieu du blueprint

Crée exactement:

1. `PostgreSQL`
   - Name: `o-mestre-db`
2. `Web Service`
   - Name: `o-mestre-api`
   - Root Directory: `backend`
   - Build Command: `pip install .`
   - Pre-Deploy Command: `alembic upgrade head`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/health`

Puis relie:

- `DATABASE_URL` au connection string interne de la base Render
- `CORS_ORIGINS` à l’URL Vercel
- les variables Clerk comme indiqué plus haut

## 8. Résumé ultra concret

À créer:

1. Dans Clerk:
   - une app
   - une production instance
   - un template JWT `backend`
2. Dans Render:
   - une base Postgres `o-mestre-db`
   - un web service `o-mestre-api`
   - optionnellement un cron service `o-mestre-reminders`
3. Dans Vercel:
   - un projet pour `frontend`

À copier:

1. URL Render backend → `NEXT_PUBLIC_API_URL` sur Vercel
2. URL Vercel frontend → `CORS_ORIGINS` sur Render
3. Publishable key Clerk → Vercel
4. Secret key Clerk → Vercel + Render backend
5. JWT template name `backend` → `NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE`
6. Issuer Clerk → `CLERK_ISSUER`
7. JWKS URL Clerk → `CLERK_JWKS_URL`

## Sources officielles

- Render Blueprints: https://render.com/docs/infrastructure-as-code
- Render Blueprint spec: https://render.com/docs/blueprint-spec
- Render cron jobs: https://render.com/docs/cronjobs
- Render monorepo rootDir: https://render.com/docs/monorepo-support
- Clerk env vars: https://clerk.com/docs/guides/development/clerk-environment-variables
- Clerk JWT templates: https://clerk.com/docs/guides/sessions/jwt-templates
- Clerk production deployment: https://clerk.com/docs/guides/development/deployment/production

