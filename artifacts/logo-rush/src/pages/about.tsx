import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useListThemes } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import type { Locale } from '@/i18n';
import { THEME_ATTRIBUTIONS } from '@/lib/theme-attributions';

export default function About() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language?.slice(0, 2) as Locale) || 'fr';
  const [, setLocation] = useLocation();
  const { data: themes } = useListThemes();

  // Driven by the live, enabled theme list (not hardcoded) so a newly
  // enabled theme's attribution appears here automatically — see the
  // multi-theme plan, section "Page À propos".
  const providers = [...new Set((themes ?? []).map((theme) => theme.imageProvider))]
    .map((provider) => THEME_ATTRIBUTIONS[provider])
    .filter((attribution): attribution is NonNullable<typeof attribution> => Boolean(attribution));

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

      <p className="text-muted-foreground">{t('about.intro')}</p>

      <div className="space-y-4">
        {providers.map((attribution) => (
          <Card key={attribution.url} className="bg-card/40 backdrop-blur-md">
            <CardContent className="p-5 space-y-1">
              <a
                href={attribution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                {attribution.name} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-sm text-muted-foreground">{locale === 'en' ? attribution.noteEn : attribution.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
