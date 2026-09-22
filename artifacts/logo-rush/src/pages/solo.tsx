import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  getGetSoloLeaderboardQueryKey,
  useGetSoloLeaderboard,
  useListSoloRounds,
  useRevealSoloRound,
  useSubmitSoloGuess,
  useSubmitSoloScore,
} from '@workspace/api-client-react';
import type { SoloRound } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PixelatedLogo } from '@/components/pixelated-logo';
import { SoloLeaderboard } from '@/components/solo-leaderboard';
import { ReportLogoButton } from '@/components/report-logo-button';

type GameState = 'setup' | 'playing' | 'round_recap' | 'results';
type RoundCount = 5 | 10 | 15 | 20;
type RoundDuration = 15 | 20 | 30;

export default function Solo() {
  const [, setLocation] = useLocation();
  const nickname = useGameStore((state) => state.nickname);
  const queryClient = useQueryClient();
  const { data: rounds, isLoading } = useListSoloRounds();

  const [gameState, setGameState] = useState<GameState>('setup');
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [roundCount, setRoundCount] = useState<RoundCount>(5);
  const [roundDuration, setRoundDuration] = useState<RoundDuration>(20);
  const [gameRounds, setGameRounds] = useState<SoloRound[]>([]);

  // Round state
  const [timeLeft, setTimeLeft] = useState<number>(roundDuration);
  const [guess, setGuess] = useState('');
  const [roundResult, setRoundResult] = useState<'won' | 'lost' | null>(null);
  // The answer is only known once the server reveals it (on a correct guess,
  // or once the timer runs out) — never upfront, unlike the old client-side
  // answer key that used to ship the whole catalog (with answers) on page
  // load and was trivially readable from the Network tab.
  const [roundAnswer, setRoundAnswer] = useState('');

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const guessInputRef = useRef<HTMLInputElement>(null);
  const submittedResultRef = useRef(false);
  const leaderboardParams = { roundCount, roundDuration };
  const { data: leaderboard, isLoading: isLeaderboardLoading, isError: isLeaderboardError } = useGetSoloLeaderboard(leaderboardParams);
  const submitScore = useSubmitSoloScore({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSoloLeaderboardQueryKey(leaderboardParams) });
      },
    },
  });
  const guessMutation = useSubmitSoloGuess();
  const revealMutation = useRevealSoloRound();

  const currentLogo = gameRounds[currentRound];

  const startGame = () => {
    if (!rounds?.length) return;
    const selectedRounds = [...rounds]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(roundCount, rounds.length));
    setGameRounds(selectedRounds);
    submittedResultRef.current = false;
    setScore(0);
    setCurrentRound(0);
    startRound(selectedRounds[0]!);
  };

  const startRound = (round: SoloRound) => {
    setGameState('playing');
    setTimeLeft(roundDuration);
    setGuess('');
    setRoundResult(null);
    setRoundAnswer('');
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, roundDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        handleTimeout(round);
      }
    }, 100);
  };

  const endRound = (result: 'won' | 'lost', answer: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRoundResult(result);
    setRoundAnswer(answer);
    setGameState('round_recap');

    if (result === 'won') {
      const points = Math.max(100, Math.round(1000 * (timeLeft / roundDuration)));
      setScore(s => s + points);
    }
  };

  const handleTimeout = async (round: SoloRound) => {
    try {
      const result = await revealMutation.mutateAsync({ data: { token: round.token } });
      endRound('lost', result.answer);
    } catch {
      endRound('lost', '');
    }
  };

  const nextRound = () => {
    const nextIndex = currentRound + 1;
    if (nextIndex < gameRounds.length) {
      setCurrentRound(nextIndex);
      startRound(gameRounds[nextIndex]!);
    } else {
      setGameState('results');
    }
  };

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const guessValue = guess.trim();
    if (gameState !== 'playing' || !currentLogo || !guessValue || guessMutation.isPending) return;

    try {
      const result = await guessMutation.mutateAsync({ data: { token: currentLogo.token, guess: guessValue } });
      if (result.correct) {
        endRound('won', result.answer || '');
      } else {
        setGuess('');
      }
    } catch {
      setGuess('');
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    requestAnimationFrame(() => guessInputRef.current?.focus());
  }, [gameState, currentRound]);

  useEffect(() => {
    if (gameState !== 'round_recap') return;
    const handleNextRoundKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      nextRound();
    };
    window.addEventListener('keydown', handleNextRoundKey);
    return () => window.removeEventListener('keydown', handleNextRoundKey);
  }, [gameState, currentRound, gameRounds.length]);

  useEffect(() => {
    if (gameState !== 'results' || submittedResultRef.current || !nickname) return;
    submittedResultRef.current = true;
    submitScore.mutate({
      data: {
        nickname,
        score,
        roundCount,
        roundDuration,
      },
    });
  }, [gameState, nickname, roundCount, roundDuration, score]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="flex-1 flex flex-col items-center py-12 space-y-8">
        <Button variant="ghost" className="absolute top-4 left-4" onClick={() => setLocation('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold">Mode Solo</h1>
          <p className="text-xl text-muted-foreground">Configurez votre défi avant de jouer.</p>
        </div>
        <Card className="w-full max-w-xl space-y-6 p-6 bg-card/50 backdrop-blur-md">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nombre de manches</p>
            <div className="grid grid-cols-4 gap-2">
              {([5, 10, 15, 20] as RoundCount[]).map(value => <Button key={value} variant={roundCount === value ? 'default' : 'outline'} onClick={() => setRoundCount(value)}>{value}</Button>)}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Durée d'une manche</p>
            <div className="grid grid-cols-3 gap-2">
              {([15, 20, 30] as RoundDuration[]).map(value => <Button key={value} variant={roundDuration === value ? 'secondary' : 'outline'} onClick={() => setRoundDuration(value)}>{value} s</Button>)}
            </div>
          </div>
        </Card>
        <Button size="lg" className="h-16 px-12 text-2xl" onClick={startGame} disabled={!rounds?.length}>
          Démarrer
        </Button>
        <div className="w-full max-w-xl">
          <SoloLeaderboard entries={leaderboard} isLoading={isLeaderboardLoading} isError={isLeaderboardError} />
        </div>
      </div>
    );
  }

  if (gameState === 'results') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <h1 className="text-5xl font-bold">Partie Terminée !</h1>
        <Card className="p-8 text-center bg-card/50 backdrop-blur-md border-primary/20">
          <p className="text-xl text-muted-foreground mb-2">Score Final</p>
          <p className="text-6xl font-extrabold text-primary">{score}</p>
        </Card>
        <div className="flex gap-4">
          <Button variant="outline" size="lg" onClick={() => setLocation('/')}>
            Menu Principal
          </Button>
          <Button size="lg" onClick={startGame}>
            Rejouer
          </Button>
        </div>
        <div className="w-full max-w-xl">
          <SoloLeaderboard
            entries={submitScore.data ?? leaderboard}
            isLoading={submitScore.isPending || isLeaderboardLoading}
            isError={!submitScore.data && isLeaderboardError}
          />
        </div>
      </div>
    );
  }

  const revealProgress = gameState === 'playing' ? 1 - timeLeft / roundDuration : 1;
  const progressPercent = (timeLeft / roundDuration) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-8">
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Manche</span>
          <span className="text-2xl font-bold">{currentRound + 1} / {gameRounds.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Score</span>
          <span className="text-2xl font-bold text-primary">{score}</span>
        </div>
      </div>

      <Progress value={progressPercent} className={cn("h-3 w-full", timeLeft < 5 && "bg-destructive/20 [&>div]:bg-destructive")} />

      <div className="w-full flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 font-mono text-xl font-medium" style={{ color: timeLeft < 5 ? 'var(--color-destructive)' : 'inherit' }}>
          <Clock className="h-5 w-5" /> {timeLeft.toFixed(1)}s
        </div>
        {gameState === 'playing' && <ReportLogoButton logoId={currentLogo?.token} />}
      </div>

      <Card className="w-full aspect-square md:aspect-video flex items-center justify-center overflow-hidden bg-card/30 backdrop-blur-md border-primary/10 relative">
        <AnimatePresence mode="wait">
          {currentLogo && (
            <motion.div
              key={currentLogo.token}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="w-full h-full flex items-center justify-center relative"
            >
              <PixelatedLogo src={currentLogo.imageUrl} progress={revealProgress} reveal={gameState !== 'playing'} />
            </motion.div>
          )}
        </AnimatePresence>

        {gameState === 'round_recap' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10"
          >
            {roundResult === 'won' ? (
              <CheckCircle2 className="w-24 h-24 text-green-500 mb-4 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
            ) : (
              <XCircle className="w-24 h-24 text-destructive mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            )}
            <h2 className="text-4xl font-bold mb-2">
              {roundAnswer}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {roundResult === 'won' ? `Trouvé en ${(roundDuration - timeLeft).toFixed(1)}s` : 'Temps écoulé !'}
            </p>
            <Button size="lg" onClick={nextRound}>
              Manche suivante <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
          </motion.div>
        )}
      </Card>

      <form onSubmit={handleGuessSubmit} className="w-full flex gap-4 relative z-0">
        <Input
          ref={guessInputRef}
          autoFocus
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Taper la marque ici..."
          className="h-14 text-xl text-center bg-card/50 backdrop-blur-md"
          disabled={gameState !== 'playing' || guessMutation.isPending}
          data-testid="input-solo-guess"
        />
        <Button
          type="submit"
          disabled={gameState !== 'playing' || !guess.trim() || guessMutation.isPending}
          className="h-14 px-8 text-lg font-bold"
          data-testid="button-solo-submit"
        >
          Valider
        </Button>
      </form>
    </div>
  );
}
