import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/i18n';
import { useGetSoloLeaderboard, useListThemes } from '@workspace/api-client-react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SoloLeaderboard } from '@/components/solo-leaderboard';

type RoundCount = 5 | 10 | 15 | 20;
type RoundDuration = 15 | 20 | 30;

export default function Leaderboard() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language?.slice(0, 2) as Locale) || 'fr';
  const [, setLocation] = useLocation();
  const { data: themes } = useListThemes();
  const [themeId, setThemeId] = useState('brands');
  useEffect(() => {
    if (themes?.length && !themes.some((t) => t.id === themeId)) setThemeId(themes[0]!.id);
  }, [themes, themeId]);
  const [roundCount, setRoundCount] = useState<RoundCount>(5);
  const [roundDuration, setRoundDuration] = useState<RoundDuration>(20);
  const { data, isLoading, isError } = useGetSoloLeaderboard({ themeId, roundCount, roundDuration });

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.back')}
        </Button>
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold">{t('leaderboard.title')}</h1>
        </div>
        <div className="w-24" />
      </div>

      <Card className="space-y-6 p-6 bg-card/50 backdrop-blur-md">
        {themes && themes.length > 1 && (
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('common.theme')}</p>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((theme) => (
                <Button key={theme.id} variant={themeId === theme.id ? 'default' : 'outline'} onClick={() => setThemeId(theme.id)}>
                  {locale === 'en' ? theme.nameEn : theme.nameFr}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('common.roundCount')}</p>
          <div className="grid grid-cols-4 gap-2">
            {([5, 10, 15, 20] as RoundCount[]).map((value) => (
              <Button
                key={value}
                variant={roundCount === value ? 'default' : 'outline'}
                onClick={() => setRoundCount(value)}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('common.roundDuration')}</p>
          <div className="grid grid-cols-3 gap-2">
            {([15, 20, 30] as RoundDuration[]).map((value) => (
              <Button
                key={value}
                variant={roundDuration === value ? 'secondary' : 'outline'}
                onClick={() => setRoundDuration(value)}
              >
                {value} s
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <SoloLeaderboard
        entries={data}
        isLoading={isLoading}
        isError={isError}
        title={t('leaderboard.topOfMode', { roundCount, roundDuration })}
      />
    </div>
  );
}