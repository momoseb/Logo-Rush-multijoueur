import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

const STEPS = ['step1', 'step2', 'step3'] as const;
const THEMES = [
  ['themeBrands', 'themeBrandsDesc'],
  ['themeFootball', 'themeFootballDesc'],
  ['themeMovies', 'themeMoviesDesc'],
  ['themeSeries', 'themeSeriesDesc'],
  ['themeGames', 'themeGamesDesc'],
] as const;
const FAQ = [
  ['faqFreeQ', 'faqFreeA'],
  ['faqMultiQ', 'faqMultiA'],
  ['faqMobileQ', 'faqMobileA'],
  ['faqImagesQ', 'faqImagesA'],
] as const;

// Below-the-fold text on the home page. The game UI above is almost wordless,
// which leaves search engines little to rank the page on; this gives them real
// copy (how to play, themes, FAQ) and — just as important — plain <a href>
// links to the other public pages, which the onClick cards above don't offer.
export function HomeSeoContent() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-3xl space-y-10 border-t border-border/50 pt-10 text-left">
      <section aria-labelledby="home-how" className="space-y-3">
        <h2 id="home-how" className="text-2xl font-bold">
          {t('home.seo.howTitle')}
        </h2>
        <ol className="list-decimal space-y-2 pl-6 text-muted-foreground">
          {STEPS.map((key) => (
            <li key={key}>{t(`home.seo.${key}`)}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="home-themes" className="space-y-3">
        <h2 id="home-themes" className="text-2xl font-bold">
          {t('home.seo.themesTitle')}
        </h2>
        <ul className="space-y-2 text-muted-foreground">
          {THEMES.map(([name, desc]) => (
            <li key={name}>
              <strong className="font-semibold text-foreground">{t(`home.seo.${name}`)}</strong> — {t(`home.seo.${desc}`)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-faq" className="space-y-3">
        <h2 id="home-faq" className="text-2xl font-bold">
          {t('home.seo.faqTitle')}
        </h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-lg border border-border/50 bg-card/40 px-4 py-3">
              <summary className="cursor-pointer font-medium marker:text-primary">{t(`home.seo.${q}`)}</summary>
              <p className="mt-2 text-muted-foreground">{t(`home.seo.${a}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <nav aria-label={t('home.seo.navLabel')} className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
        <Link href="/solo" className="text-primary hover:underline">
          {t('home.seo.navSolo')}
        </Link>
        <Link href="/leaderboard" className="text-primary hover:underline">
          {t('home.seo.navLeaderboard')}
        </Link>
        <Link href="/about" className="text-primary hover:underline">
          {t('home.seo.navAbout')}
        </Link>
      </nav>
    </div>
  );
}
