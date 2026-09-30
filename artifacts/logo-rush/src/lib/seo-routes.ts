// Single source of truth for per-route SEO metadata. Read by BOTH the build
// plugin (vite-plugin-seo.ts → prerendered HTML, sitemap) and the client
// (components/seo-manager.tsx → title/meta updates on navigation and on
// language change). Keep it dependency-free — the plugin imports it from
// vite.config.ts, where the "@/" alias and browser globals don't exist.

export type SeoLocale = 'fr' | 'en';

export const SITE_NAME = 'Logo Rush';
export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_ALT: Record<SeoLocale, string> = {
  fr: 'Logo Rush : une image se dépixelise, devinez-la avant les autres',
  en: 'Logo Rush: an image slowly de-pixelates, guess it before everyone else',
};

type Localized = Record<SeoLocale, string>;

export interface SeoRoute {
  path: string;
  /** false → `noindex` and left out of the sitemap. */
  index: boolean;
  title: Localized;
  description: Localized;
  /**
   * Static French content written into the prerendered HTML (inside #root,
   * replaced once React mounts). Crawlers that don't run JavaScript — social
   * scrapers, most AI/answer-engine bots — only ever see this.
   */
  prerender?: {
    h1: string;
    lead: string;
    sections?: { title: string; items: string[] }[];
  };
}

export const SEO_ROUTES: SeoRoute[] = [
  {
    path: '/',
    index: true,
    title: {
      fr: 'Logo Rush – Quiz de logos à deviner, solo ou multijoueur',
      en: 'Logo Rush – Guess the Logo Quiz, Solo or Multiplayer',
    },
    description: {
      fr: 'Un logo se dépixelise : devinez-le avant les autres ! Marques, clubs de foot, films, séries, jeux vidéo. Gratuit, sans inscription, en solo ou multijoueur.',
      en: 'A logo slowly de-pixelates: guess it before everyone else! Brands, football clubs, movies, TV series, video games. Free, no sign-up, solo or multiplayer.',
    },
    prerender: {
      h1: 'Logo Rush – le quiz de logos qui se dépixelise',
      lead: 'Une image apparaît en gros pixels puis devient de plus en plus nette : trouvez ce qu’elle représente avant les autres. Gratuit, sans inscription, en solo ou en multijoueur avec vos amis.',
      sections: [
        {
          title: 'Les thèmes',
          items: ['Logos de marques', 'Écussons de clubs de foot', 'Affiches de films', 'Séries', 'Jaquettes de jeux vidéo'],
        },
        {
          title: 'Comment jouer',
          items: [
            'Choisissez un pseudo, puis un thème.',
            'L’image se dépixelise : tapez votre réponse dès que vous reconnaissez.',
            'Plus vous répondez vite, plus vous marquez de points.',
          ],
        },
      ],
    },
  },
  {
    path: '/solo',
    index: true,
    title: {
      fr: 'Jouer en solo – Quiz de logos, films et jeux | Logo Rush',
      en: 'Play Solo – Logo, Movie & Game Quiz | Logo Rush',
    },
    description: {
      fr: 'Lancez une partie solo : choisissez un thème (marques, foot, films, séries, jeux vidéo), le nombre de manches et le chrono, puis battez votre record.',
      en: 'Start a solo game: pick a theme (brands, football, movies, series, video games), the number of rounds and the timer, then beat your high score.',
    },
    prerender: {
      h1: 'Jouer en solo à Logo Rush',
      lead: 'Entraînez-vous à votre rythme : le chrono est votre seul adversaire. Choisissez un thème, le nombre de manches et la durée, puis devinez avant que l’image ne soit nette.',
    },
  },
  {
    path: '/leaderboard',
    index: true,
    title: {
      fr: 'Classement – Meilleurs scores du quiz de logos | Logo Rush',
      en: 'Leaderboard – Top Scores | Logo Rush',
    },
    description: {
      fr: 'Le classement des meilleurs joueurs de Logo Rush, en solo et en multijoueur, pour chaque thème. Pouvez-vous entrer dans le top ?',
      en: 'The best Logo Rush players, solo and multiplayer, for every theme. Can you make the top?',
    },
    prerender: {
      h1: 'Classement Logo Rush',
      lead: 'Les meilleurs scores des parties solo et multijoueur, thème par thème.',
    },
  },
  {
    path: '/about',
    index: true,
    title: {
      fr: 'À propos de Logo Rush – Le jeu de rapidité qui se dépixelise',
      en: 'About Logo Rush – The De-Pixelating Guessing Game',
    },
    description: {
      fr: 'Logo Rush est un jeu de rapidité : une image se dépixelise peu à peu, trouvez ce qu’elle représente avant les autres. Découvrez aussi d’où viennent les images.',
      en: 'Logo Rush is a speed game: an image slowly de-pixelates, guess what it is before everyone else. Find out where the images come from too.',
    },
    prerender: {
      h1: 'À propos de Logo Rush',
      lead: 'Logo Rush est un jeu de rapidité : une image se dépixelise peu à peu, trouvez ce qu’elle représente avant les autres — en solo ou en multijoueur.',
    },
  },
];

/** Routes that exist in the app but must never be indexed. */
const NOINDEX_PREFIXES: { prefix: string; title: Localized; description: Localized }[] = [
  {
    prefix: '/room/',
    title: { fr: 'Salon – Logo Rush', en: 'Room – Logo Rush' },
    description: {
      fr: 'Rejoignez ce salon Logo Rush et devinez avant vos amis.',
      en: 'Join this Logo Rush room and guess before your friends.',
    },
  },
  {
    prefix: '/multiplayer',
    title: { fr: 'Multijoueur – Logo Rush', en: 'Multiplayer – Logo Rush' },
    description: {
      fr: 'Trouvez un salon public ou créez le vôtre pour défier vos amis.',
      en: 'Find a public room or create your own to challenge your friends.',
    },
  },
  {
    prefix: '/admin',
    title: { fr: 'Administration – Logo Rush', en: 'Admin – Logo Rush' },
    description: { fr: 'Outil interne de gestion du catalogue.', en: 'Internal catalogue management tool.' },
  },
  {
    prefix: '/logo-audit',
    title: { fr: 'Contrôle des logos – Logo Rush', en: 'Logo audit – Logo Rush' },
    description: { fr: 'Outil interne de contrôle des images.', en: 'Internal image quality check tool.' },
  },
];

export const NOT_FOUND_SEO = {
  title: { fr: 'Page introuvable – Logo Rush', en: 'Page not found – Logo Rush' } as Localized,
  description: {
    fr: 'Cette page n’existe pas ou a été déplacée.',
    en: 'This page does not exist or has been moved.',
  } as Localized,
};

export interface ResolvedSeo {
  path: string;
  index: boolean;
  title: Localized;
  description: Localized;
}

/** Resolve a router pathname (base already stripped) to its SEO metadata. */
export function resolveSeo(pathname: string): ResolvedSeo {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const known = SEO_ROUTES.find((r) => r.path === path);
  if (known) return known;

  const hidden = NOINDEX_PREFIXES.find((r) => path === r.prefix.replace(/\/$/, '') || path.startsWith(r.prefix));
  if (hidden) {
    return { path, index: false, title: hidden.title, description: hidden.description };
  }

  return { path, index: false, ...NOT_FOUND_SEO };
}
