// Attribution required by each image provider's terms of use — see the
// multi-theme plan for the CGU check behind each choice. Keyed by
// theme.imageProvider (not themeId) since the attribution is really about
// the data/image source, not the theme itself.
export type ThemeAttribution = {
  name: string;
  url: string;
  note: string;
  noteEn: string;
  /** Themes whose images come from this provider (display only). */
  themesFr: string;
  themesEn: string;
};

export const THEME_ATTRIBUTIONS: Record<string, ThemeAttribution> = {
  brandfetch: {
    name: "Brandfetch",
    url: "https://brandfetch.com",
    note: "Logos de marques fournis par l'API Brandfetch.",
    noteEn: "Brand logos provided by the Brandfetch API.",
    themesFr: "Marques",
    themesEn: "Brands",
  },
  "football-data": {
    name: "football-data.org",
    url: "https://www.football-data.org",
    note: "Écussons et noms de clubs fournis par l'API football-data.org.",
    noteEn: "Club crests and names provided by the football-data.org API.",
    themesFr: "Clubs de foot",
    themesEn: "Football clubs",
  },
  tmdb: {
    name: "TMDb (The Movie Database)",
    url: "https://www.themoviedb.org",
    note: "Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.",
    noteEn: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    themesFr: "Affiches de films, Séries",
    themesEn: "Movie posters, TV series",
  },
  rawg: {
    name: "RAWG",
    url: "https://rawg.io",
    note: "Jaquettes et informations de jeux vidéo fournies par l'API RAWG.",
    noteEn: "Video game covers and information provided by the RAWG API.",
    themesFr: "Jeux vidéo",
    themesEn: "Video games",
  },
};
