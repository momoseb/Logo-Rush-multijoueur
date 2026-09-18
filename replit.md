# Logo Rush

Jeu web de reconnaissance de marques, jouable en solo ou à plusieurs en temps réel.

> Voir aussi `AGENTS.md` à la racine du repo pour un guide plus complet
> (architecture, pièges connus, issues ouvertes) destiné aux agents de code.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Variable publique requise : `VITE_BRANDFETCH_CLIENT_ID`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/logo-rush` — application React.
- `artifacts/api-server/src/game.ts` — moteur de jeu et salons temps réel.
- `lib/api-spec/openapi.yaml` — contrat REST.

## Architecture decisions

- L’état multijoueur et le calcul des points restent exclusivement côté serveur.
- Les réponses des manches multijoueur ne sont envoyées qu’à la fin de la manche.
- Les logos de grandes marques sont chargés directement depuis le CDN Brandfetch, conformément à leurs règles d’utilisation.

## Product

- Partie solo configurable, dépixelisation progressive, salons publics/privés, lobby, classement en direct et résultats.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
