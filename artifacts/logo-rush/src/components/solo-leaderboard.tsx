import type { SoloLeaderboardEntry } from '@workspace/api-client-react';
import { Medal, Trophy, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';

export function SoloLeaderboard({
  entries,
  isLoading,
  isError,
  title,
}: {
  entries?: SoloLeaderboardEntry[];
  isLoading: boolean;
  isError?: boolean;
  title?: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="w-full p-5 bg-card/50 backdrop-blur-md border-primary/20">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{title ?? t('soloLeaderboard.defaultTitle')}</h2>
      </div>
      {isLoading ? (
        <p className="py-5 text-center text-muted-foreground">{t('soloLeaderboard.loading')}</p>
      ) : isError ? (
        <p className="flex items-center justify-center gap-2 py-5 text-center text-destructive">
          <AlertTriangle className="h-4 w-4" /> {t('soloLeaderboard.error')}
        </p>
      ) : !entries?.length ? (
        <p className="py-5 text-center text-muted-foreground">{t('soloLeaderboard.empty')}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-4 py-3">
              <span className="flex w-7 items-center justify-center font-bold text-primary">
                {index < 3 ? <Medal className="h-5 w-5" /> : index + 1}
              </span>
              <span className="flex-1 truncate font-semibold">{entry.nickname}</span>
              <span className="font-mono text-lg font-bold">{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}