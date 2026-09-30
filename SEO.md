# SEO & visibilité — Logo Rush

Ce qui est en place dans le code, le nom de domaine recommandé, et la marche
à suivre pour le brancher. Le déploiement lui-même reste décrit dans
`DEPLOY.md`.

## 1. Nom de domaine

Disponibilité vérifiée le 30/09/2026 par interrogation RDAP (registres
officiels) et DNS. « Libre » = aucun enregistrement trouvé : **à confirmer
chez le registrar au moment de l'achat** (un nom réservé ou « premium » ne
se voit pas toujours d'ici, et un nom libre peut être pris d'ici là).

| Domaine | Statut | Remarque |
|---|---|---|
| `logorush.com` | **pris** (une entreprise de signalétique) | inutile d'insister |
| **`logorush.fr`** | libre | **recommandé** |
| `logorush.app` | libre | bon second choix, HTTPS obligatoire (sans problème avec Vercel) |
| `logorush.games` | libre | thématique, plus cher |
| `logorush.io`, `logorush.gg` | libres | look « gamer », renouvellement cher |
| `logo-rush.com` | libre | le tiret nuit au bouche-à-oreille, à éviter |
| `devinelogo.com`, `blurquiz.com`, `flouquiz.com`, `devinerush.com` | libres | alternatives si vous changez de nom |

**Recommandation : `logorush.fr`.**

- Il reprend exactement la marque : c'est ce que les gens taperont après
  l'avoir entendu citer ou l'avoir vu dans un lien partagé.
- Le public visé est francophone (interface en français par défaut, textes
  SEO en français) : `.fr` est un signal de ciblage géographique positif
  pour Google France.
- Coût d'ordre de grandeur de quelques euros par an (OVH, Gandi… — Cloudflare
  ne vend pas le `.fr`). Un `.fr` demande un titulaire avec une adresse dans
  l'UE/EEE.

Si l'ambition devient clairement internationale (pages `/en/…`, voir §5),
préférez `logorush.app` ou `logorush.games` comme domaine principal : un
`.fr` limite le ciblage hors de France. Achetez éventuellement les deux et
redirigez le second vers le premier.

## 2. Brancher le domaine (une fois acheté)

1. **Vercel** → projet → *Settings → Domains* : ajouter `logorush.fr` et
   `www.logorush.fr` (rediriger `www` vers le domaine sans `www`). Reporter
   chez le registrar les enregistrements DNS **que Vercel affiche**.
2. **Vercel** → *Settings → Environment Variables* : ajouter
   `VITE_SITE_URL=https://logorush.fr` (Production), puis **redéployer**.
   C'est ce qui fixe les URL canoniques, `og:url`, `og:image` et le sitemap.
   Sans elle, le build se rabat sur l'URL de production fournie par Vercel
   (`VERCEL_PROJECT_PRODUCTION_URL`) ; sans rien, il omet ces balises et
   affiche un avertissement `[seo]` dans les logs.
3. Aucun changement côté Render : le CORS de l'API est déjà permissif.
4. **Vérifier après déploiement** :
   - `curl -I https://logorush.fr/about` → `200` ; `curl -I https://logorush.fr/nimportequoi` → `404` ;
   - « Afficher le code source » de `/about` : le `<title>` et le `<h1>` doivent y être ;
   - `https://logorush.fr/sitemap.xml` et `/robots.txt` répondent.
5. **Google Search Console** : ajouter une propriété *Domaine*
   (validation par enregistrement DNS TXT chez le registrar), puis
   soumettre `https://logorush.fr/sitemap.xml` et demander l'indexation de
   `/`. Faire de même dans **Bing Webmaster Tools** (import direct depuis
   Search Console).
6. Tester l'aperçu des liens partagés : débogueur de partage Facebook,
   *Post Inspector* LinkedIn, ou opengraph.xyz. Discord/WhatsApp mettent
   l'aperçu en cache : un nouveau lien peut être nécessaire pour le voir changer.

## 3. Ce qui est en place dans le code

- **`<head>` par page** (titre, description, canonical, Open Graph, Twitter,
  `robots`) : source unique dans `src/lib/seo-routes.ts`, FR + EN.
- **Pré-rendu au build sans SSR** (`vite-plugin-seo.ts`) : une page HTML par
  route publique (`/`, `/solo`, `/leaderboard`, `/about`) avec son propre
  `<head>` et un texte statique dans `#root`. Les robots qui n'exécutent pas
  JavaScript (scrapers de réseaux sociaux, la plupart des bots d'IA) voient
  donc du vrai contenu, pas une page vide.
- **`404.html`** en `noindex` : Vercel le sert avec un vrai statut 404 ; la SPA
  démarre par-dessus et affiche sa page « Introuvable ».
- **`sitemap.xml` et `robots.txt` générés** (`public/robots.txt` supprimé :
  il aurait été écrasé).
- **Pages privées en `noindex`** (`/room/*`, `/multiplayer`, `/admin/*`,
  `/logo-audit`) : balise `robots` côté client **et** en-tête `X-Robots-Tag`
  côté Vercel (`vercel.json`), efficace même sans JavaScript.
- **`SeoManager`** (`src/components/seo-manager.tsx`) : garde titre, description,
  canonical, `<html lang>` à jour à chaque navigation et au changement de langue.
- **Données structurées** JSON-LD (`WebSite` + `VideoGame`) sur l'accueil.
- **Contenu indexable sur l'accueil** (comment jouer, thèmes, FAQ) et vrais
  liens `<a href>` vers les autres pages — les cartes à `onClick` n'étaient
  pas suivies par les robots.
- **Image de partage** 1200×630 (`public/og-image.png`), **favicon** et icônes
  (`favicon.svg`, `icon-192/512.png`, `apple-touch-icon.png`) aux couleurs
  de la charte, **`manifest.webmanifest`**.
- **Performance** : police Outfit chargée par `<link>` + `preconnect` (au lieu
  d'un `@import` CSS en cascade), police Inter inutilisée supprimée, cache
  immuable sur `/assets/*`.
- **Partage d'un salon** : bouton « partager le lien d'invitation » dans le
  salon (Web Share sur mobile, copie du lien sinon). Le lien d'invitation est
  la principale boucle de croissance du jeu, et son aperçu utilise l'image
  de partage ci-dessus.

### Régénérer les visuels

`design/og-image.html` est la source de `public/og-image.png` ; l'icône est
`public/favicon.svg`. Rendu avec n'importe quel Chromium headless
(`$CHROMIUM` = chemin de `headless_shell` ou de `chrome`) :

```bash
"$CHROMIUM" --no-sandbox --hide-scrollbars --virtual-time-budget=3000 \
  --window-size=1200,630 --screenshot=artifacts/logo-rush/public/og-image.png \
  file://$PWD/artifacts/logo-rush/design/og-image.html
```

Avec `chrome --headless` classique, la hauteur de capture est rognée : utilisez
`headless_shell`, ou Playwright avec un viewport 1200×630.

## 4. Pièges à connaître

- **Nouvelle route SPA = une ligne dans `vercel.json`.** Les réécritures vers
  `/index.html` sont désormais une liste explicite (pour que les URL
  inconnues renvoient un vrai 404). Une nouvelle route privée oubliée dans
  `rewrites` donnerait un 404 en production. Une nouvelle route **publique**
  s'ajoute dans `SEO_ROUTES` (`src/lib/seo-routes.ts`) : le build génère sa
  page, sans réécriture nécessaire.
- **Ne jamais coder un domaine en dur** dans le plugin : un canonical vers un
  domaine que nous ne possédons pas est pire que pas de canonical.
- Les aperçus de déploiement Vercel sont déjà en `noindex` côté Vercel.

## 5. Suite recommandée (non fait ici)

1. **Pages d'atterrissage par thème** (`/quiz-logos`, `/quiz-foot`,
   `/quiz-films`, `/quiz-series`, `/quiz-jeux-video`) avec un vrai texte et
   un bouton « jouer » qui présélectionne le thème : c'est le plus gros levier
   de trafic organique, car chaque page vise une requête précise.
2. **URL par langue** (`/en/…` + `hreflang`) : aujourd'hui FR et EN partagent
   la même URL (langue dans le `localStorage`), donc Google n'indexe que le
   français.
3. **Réduire la friction d'entrée** : le pseudo est obligatoire avant même de
   voir les modes de jeu ; un « jouer tout de suite » augmenterait la
   conversion des visiteurs qui arrivent du référencement ou d'un partage.
4. **Partage du score** en fin de partie solo (« j'ai fait 4200, bats-moi »
   + lien) : deuxième boucle virale, après l'invitation en salon.

## 6. Faire connaître le jeu (hors code)

Aucun résultat n'est garanti ; ce sont des pistes classées par rapport
effort/impact pour un jeu de navigateur gratuit :

- **Courtes vidéos** (TikTok, Reels, Shorts) : la dépixelisation d'un logo est
  un format naturellement visuel (« tu le trouves en combien de secondes ? »).
- **Communautés** : Reddit (r/WebGames, r/france selon les règles de chaque
  sous-reddit sur l'auto-promotion), serveurs Discord de jeux et de quiz,
  Product Hunt, Show HN.
- **Portails de jeux web** (CrazyGames, itch.io…) : plus d'exposition, mais
  intégration et conditions propres à chacun.
- **Backlinks** : listings d'outils/jeux gratuits, articles « meilleurs quiz
  en ligne ». Le SEO technique ci-dessus ne remplace pas les liens entrants.
