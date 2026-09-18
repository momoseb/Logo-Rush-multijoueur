# Déploiement — Vercel (frontend) + Render (backend)

L'app n'est plus couplée à Replit pour être construite ou déployée. La
topologie recommandée sépare le frontend statique (Vercel) du backend
temps réel avec état (Render, ou toute plateforme qui héberge un process
Node persistant) : Socket.IO garde l'état des salons et les timers de
manche en mémoire, ce qui est incompatible avec des fonctions serverless
éphémères comme celles de Vercel.

```
Navigateur ──HTTPS/WSS──▶ Render (Express + Socket.IO + Postgres)
     │
     └────HTTPS (statique)──▶ Vercel (React / Vite, build only)
```

## 1. Backend sur Render

Déployé automatiquement à la racine du repo via `render.yaml` (Blueprint)
ou manuellement :

- **Runtime** : Node
- **Build command** :
  `pnpm install --frozen-lockfile && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build`
  (pas de `corepack enable` : l'image de build Render fournit déjà pnpm
  via son propre binaire en lecture seule — `corepack enable` essaie de
  le remplacer et plante avec `EROFS`)
  — le `pnpm --filter @workspace/db run push` resynchronise le schéma à
  chaque déploiement, ce qui évite le bug de leaderboard "cassé après un
  changement de schéma" documenté dans l'issue GitHub #2.
- **Start command** : `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- **Health check** : `/api/healthz`
- **Variables d'environnement** :
  - `DATABASE_URL` — fournie automatiquement si vous liez une base Postgres Render
  - `PORT` — injectée automatiquement par Render, ne pas la fixer manuellement
  - `NODE_ENV=production`

CORS est déjà permissif côté API (`cors()` sans restriction d'origine,
Socket.IO avec `origin: true`) — aucune configuration supplémentaire
n'est nécessaire pour accepter les requêtes cross-origin depuis Vercel.

## 2. Frontend sur Vercel

Le fichier `artifacts/logo-rush/vercel.json` définit déjà la commande de
build (qui s'installe et se construit depuis la racine du monorepo via
`pnpm --filter`), le dossier de sortie et la réécriture SPA nécessaire
pour que les routes client (`/room/ABCD`, `/leaderboard`, ...) se
chargent directement sans passer par le serveur.

Dans le dashboard Vercel (« Import Project » sur ce repo) :

1. **Root Directory** : `artifacts/logo-rush`
2. **Framework Preset** : Vite (auto-détecté)
3. **Variables d'environnement** :
   - `VITE_API_BASE_URL` = l'URL publique du service Render (ex.
     `https://logo-rush-api.onrender.com`) — indispensable, c'est ce qui
     permet au frontend de parler à un backend sur un autre domaine.
   - `VITE_BRANDFETCH_CLIENT_ID` = l'identifiant public Brandfetch
     (actuellement `1idke8AlkDn4BHhX1fs`, visible dans `.replit`)

`PORT`/`BASE_PATH` ne sont plus requis : `vite.config.ts` les valorise
par défaut désormais (ils ne servent de toute façon qu'à `vite
dev`/`vite preview`, jamais à `vite build`).

## 3. Développement local sans Replit

```bash
# Base de données (une instance Postgres locale ou distante)
export DATABASE_URL=postgresql://...
pnpm --filter @workspace/db run push

# Backend
DATABASE_URL=... PORT=5000 pnpm --filter @workspace/api-server run dev

# Frontend (proxy /api et /socket.io vers localhost:5000 par défaut,
# voir VITE_DEV_API_PROXY_TARGET dans vite.config.ts pour pointer
# ailleurs, par ex. vers le backend déployé sur Render)
PORT=5173 VITE_BRANDFETCH_CLIENT_ID=... pnpm --filter @workspace/logo-rush run dev
```

## Ce qui reste spécifique à Replit (volontairement conservé)

- `.replit`, `replit.md`, `artifacts/*/.replit-artifact/` — utiles si vous
  continuez à développer dans l'éditeur Replit ; ignorés par tout le
  reste (Vercel, Render, dev local).
- `artifacts/mockup-sandbox` — outil de design interne à l'éditeur
  Replit, sans lien avec le jeu, non déployé.
