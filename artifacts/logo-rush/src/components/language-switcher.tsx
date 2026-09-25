import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Mounted once in App.tsx so it's available on every route without a shared
// layout component. The chosen language is persisted to localStorage by
// i18next-browser-languagedetector (see src/i18n/index.ts) — no separate
// store needed.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.language?.slice(0, 2) as Locale) || 'fr';

  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-1 rounded-full border border-border/50 bg-background/80 p-1 backdrop-blur-md text-xs font-medium">
      {SUPPORTED_LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          size="sm"
          variant={current === locale ? 'default' : 'ghost'}
          className={cn('h-7 rounded-full px-3 uppercase')}
          onClick={() => i18n.changeLanguage(locale)}
          data-testid={`button-locale-${locale}`}
        >
          {locale}
        </Button>
      ))}
    </div>
  );
}
