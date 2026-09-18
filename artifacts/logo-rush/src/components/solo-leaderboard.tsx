import type { SoloLeaderboardEntry } from '@workspace/api-client-react';
import { Medal, Trophy, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function SoloLeaderboard({
  entries,
  isLoading,
  isError,
  title = 'Top 5 de ce mode',
}: {
  entries?: SoloLeaderboardEntry[];
  isLoading: boolean;
  isError?: boolean;
  title?: string;
}) {
  return (
    <Card className="w-full p-5 bg-card/50 backdrop-blur-md border-primary/20">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {isLoading ? (
        <p className="py-5 text-center text-muted-foreground">Chargement du classement...</p>
      ) : isError ? (
        <p className="flex items-center justify-center gap-2 py-5 text-center text-destructive">
          <AlertTriangle className="h-4 w-4" /> Classement indisponible pour le moment. Réessayez plus tard.
        </p>
      ) : !entries?.length ? (
        <p className="py-5 text-center text-muted-foreground">Aucun score pour ce mode. Soyez le premier !</p>
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