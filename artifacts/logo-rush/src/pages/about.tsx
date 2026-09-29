import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import type { Locale } from '@/i18n';
import { THEME_ATTRIBUTIONS } from '@/lib/theme-attributions';

export default function About() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language?.slice(0, 2) as Locale) || 'fr';
  const [, setLocation] = useLocation();

  // Every provider is always listed — not only those of currently-enabled
  // themes: this page used to be driven by the live /game/themes response,
  // and rendered nothing but its intro whenever that list was unavailable.
  const providers = Object.values(THEME_ATTRIBUTIONS);

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.back')}
        </Button>
        <div className="flex items-center gap-3">
          <Info className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">{t('about.title')}</h1>
        </div>
      </div>

      <p className="text-muted-foreground">{t('about.description')}</p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('about.apisTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('about.intro')}</p>
        {providers.map((attribution) => (
          <Card key={attribution.url} className="bg-card/40 backdrop-blur-md">
            <CardContent className="p-5 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a
                  href={attribution.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                >
                  {attribution.name} <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {locale === 'en' ? attribution.themesEn : attribution.themesFr}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{locale === 'en' ? attribution.noteEn : attribution.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">{t('about.trademarks')}</p>
    </div>
  );
}
