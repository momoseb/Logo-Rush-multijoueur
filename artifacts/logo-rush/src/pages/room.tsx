import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGameStore } from '@/store/useGameStore';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Trophy, Play, Check, X, Clock, Copy, Crown, Swords } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PixelatedLogo } from '@/components/pixelated-logo';
import { ReportLogoButton } from '@/components/report-logo-button';

// Types derived from expected socket payloads
type Player = { id: string; nickname: string; score: number; connected?: boolean; foundAt?: number; roundPoints?: number; hasGuessed?: boolean };
type RoomState = 'waiting' | 'playing' | 'round_recap' | 'results';

export default function Room() {
  const { code } = useParams();
  const [, setLocation] = useLocation();
  const { nickname, sessionId, ensureSessionId, setNickname } = useGameStore();
  const { toast } = useToast();
  const [localName, setLocalName] = useState('');

  const [gameState, setGameState] = useState<RoomState>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomName, setRoomName] = useState('');
  const [hostId, setHostId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  
  const [currentLogo, setCurrentLogo] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundDuration, setRoundDuration] = useState(15);
  const [roundNumber, setRoundNumber] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [mode, setMode] = useState<'ffa' | 'duel'>('ffa');
  const [targetScore, setTargetScore] = useState(5);
  
  const [guess, setGuess] = useState('');
  const [guessState, setGuessState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  
  const [roundAnswer, setRoundAnswer] = useState('');
  
  const timerRef = useRef<number | null>(null);
  const guessInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ensureSessionId();
    if (!code) {
      setLocation('/');
      return;
    }
    // No nickname yet: this is likely someone opening a shared room link for
    // the first time. Stay on this route and let them set a pseudo inline
    // (below) instead of bouncing them to `/` and losing the room code.
    if (!nickname) return;

    const socket = getSocket();
    
    // Join room
    socket.emit('room:join', { code, nickname, sessionId }, (result: { ok: boolean; room?: any; playerId?: string; error?: string }) => {
      if (!result.ok) {
        toast({ variant: 'destructive', description: result.error || 'Impossible de rejoindre le salon.' });
        setLocation('/multiplayer');
        return;
      }
      if (result.playerId) setMyPlayerId(result.playerId);
      if (result.room) handleRoomUpdate(result.room);
    });

    const handleRoomUpdate = (data: any) => {
      if (data.name) setRoomName(data.name);
      if (data.hostId) setHostId(data.hostId);
      if (data.players) {
        // Transform Object to Array if needed, assuming backend sends array or map
        const pArray = Array.isArray(data.players) ? data.players : Object.values(data.players);
        setPlayers(pArray as Player[]);
      }
      if (data.status === 'waiting') setGameState('waiting');
      if (data.roundCount) setTotalRounds(data.roundCount);
      if (data.roundDuration) setRoundDuration(data.roundDuration);
      if (data.mode) setMode(data.mode);
      if (data.targetScore) setTargetScore(data.targetScore);
    };

    const handleGameStart = () => {
      setGameState('playing');
    };

    const handleRoundStart = (data: any) => {
      setGameState('playing');
      setCurrentLogo(data.logo);
      setRoundDuration(data.duration || 15);
      setTimeLeft(data.duration || 15);
       setRoundNumber((data.roundIndex ?? 0) + 1);
      setGuess('');
      setGuessState('idle');
      
      // Clear all players 'hasGuessed' status locally
      setPlayers(prev => prev.map(p => ({ ...p, hasGuessed: false })));

      if (timerRef.current) clearInterval(timerRef.current);
      const startTime = data.startedAt || Date.now();
      const dur = (data.duration || 15) * 1000;
      
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, (dur - elapsed) / 1000);
        setTimeLeft(remaining);
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      }, 100);
    };

    const handlePlayerFound = (data: { playerId: string }) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, hasGuessed: true } : p));
    };

    const handleRoundEnd = (data: { answer: string; players: Player[] }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('round_recap');
      setRoundAnswer(data.answer);
      if (data.players) setPlayers(data.players);
    };

    const handleGameEnd = (data: { players: Player[] }) => {
      setGameState('results');
      if (data.players) setPlayers(data.players);
    };

    const handleError = (data: { message: string }) => {
      toast({ variant: 'destructive', description: data.message });
      if (data.message.includes('not found') || data.message.includes('full')) {
        setLocation('/multiplayer');
      }
    };

    socket.on('room:update', handleRoomUpdate);
    socket.on('game:start', handleGameStart);
    socket.on('round:start', handleRoundStart);
    socket.on('player:found', handlePlayerFound);
    socket.on('round:end', handleRoundEnd);
    socket.on('game:end', handleGameEnd);
    socket.on('error', handleError);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.emit('room:leave', { code });
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:start', handleGameStart);
      socket.off('round:start', handleRoundStart);
      socket.off('player:found', handlePlayerFound);
      socket.off('round:end', handleRoundEnd);
      socket.off('game:end', handleGameEnd);
      socket.off('error', handleError);
    };
  }, [code, nickname, sessionId, setLocation, ensureSessionId]);

  useEffect(() => {
    if (gameState !== 'playing' || guessState === 'correct') return;
    requestAnimationFrame(() => guessInputRef.current?.focus());
  }, [gameState, roundNumber, guessState]);

  const handleStartGame = () => {
    getSocket().emit('game:start', { code });
  };

  const handleRestartGame = () => {
    getSocket().emit('game:restart', { code });
  };

  // The "primary" setting is manches (FFA) or points pour gagner (duel) — the
  // server only applies whichever one matches the room's own mode, so it's
  // safe to always send both.
  const updateRoomSettings = (nextPrimaryValue: number, nextRoundDuration: number) => {
    getSocket().emit(
      'room:settings',
      { code, roundCount: nextPrimaryValue, targetScore: nextPrimaryValue, roundDuration: nextRoundDuration },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) toast({ variant: 'destructive', description: result.error });
      },
    );
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || guessState === 'correct') return;
    
    getSocket().emit('guess:submit', { code, guess: guess.trim() }, (result: { correct: boolean }) => {
      if (result.correct) setGuessState('correct');
      else {
        setGuessState('wrong');
        setTimeout(() => setGuessState('idle'), 650);
      }
    });
    setGuess('');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code || '');
    toast({ description: 'Code copié !' });
  };

  const amIHost = myPlayerId === hostId;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  if (!nickname) {
    const handleSaveName = (e: React.FormEvent) => {
      e.preventDefault();
      if (localName.trim().length >= 2 && localName.trim().length <= 20) {
        setNickname(localName.trim());
      }
    };

    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 w-full max-w-md mx-auto">
        <Card className="w-full bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl shadow-primary/10">
          <div className="p-6">
            <form onSubmit={handleSaveName} className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold">Choisissez un pseudo</h2>
                <p className="text-sm text-muted-foreground">
                  pour rejoindre le salon <span className="font-mono text-primary">{code}</span>
                </p>
              </div>
              <div className="space-y-4">
                <Input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Ex: FlashDevin, LogoMaster..."
                  className="text-center text-lg h-14 bg-background/50 border-primary/30 focus-visible:ring-primary"
                  minLength={2}
                  maxLength={20}
                  autoFocus
                  data-testid="input-nickname"
                />
                <Button
                  type="submit"
                  disabled={localName.trim().length < 2 || localName.trim().length > 20}
                  className="w-full h-14 text-lg font-bold"
                  size="lg"
                  data-testid="button-save-nickname"
                >
                  Rejoindre le salon
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation('/')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l'accueil
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center py-8 w-full max-w-5xl mx-auto">
        <div className="w-full flex justify-between items-center mb-8">
          <Button variant="ghost" onClick={() => setLocation('/multiplayer')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quitter
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
              {roomName || 'Salon'}
              {mode === 'duel' && (
                <span className="flex items-center gap-1 text-xs font-semibold bg-secondary/20 text-secondary px-2 py-1 rounded-md align-middle">
                  <Swords className="h-3.5 w-3.5" /> Duel 1v1
                </span>
              )}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-muted-foreground">Code:</span>
              <span className="font-mono bg-primary/20 text-primary px-3 py-1 rounded-md text-lg tracking-widest">{code}</span>
              <Button variant="ghost" size="icon" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="w-24" /> {/* Spacer for balance */}
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-2 bg-card/40 backdrop-blur-md border-primary/20">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> 
                  Joueurs ({players.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {players.map((p) => (
                  <div key={p.id || p.nickname} className="flex items-center gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-secondary uppercase">
                      {p.nickname.substring(0, 2)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate">{p.nickname}</p>
                      {p.id === hostId && <span className="text-xs text-primary">Hôte</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          
          <div className="flex flex-col gap-4">
            <Card className="bg-card/40 backdrop-blur-md border-primary/20 p-6 flex flex-col items-center justify-center text-center h-full min-h-[250px]">
              {amIHost ? (
                <>
                  <Play className="h-12 w-12 text-primary mb-4" />
                  <h3 className="font-bold text-lg mb-2">Prêt ?</h3>
                  <p className="text-sm text-muted-foreground mb-4">Réglez la partie puis lancez-la.</p>
                  <div className="w-full mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {mode === 'duel' ? 'Points pour gagner' : 'Manches'}
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {[5, 10, 15, 20].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={(mode === 'duel' ? targetScore : totalRounds) === value ? 'default' : 'outline'}
                          onClick={() => updateRoomSettings(value, roundDuration)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="w-full mb-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Temps par manche</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[15, 20, 30].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={roundDuration === value ? 'secondary' : 'outline'}
                          onClick={() => updateRoomSettings(mode === 'duel' ? targetScore : totalRounds, value)}
                        >
                          {value} s
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="w-full text-lg h-14"
                    onClick={handleStartGame}
                    disabled={mode === 'duel' ? players.length < 2 : players.length < 1}
                  >
                    Démarrer
                  </Button>
                  {mode === 'duel' && players.length < 2 && (
                    <p className="mt-2 text-xs text-muted-foreground">En attente d'un second joueur...</p>
                  )}
                </>
              ) : (
                <>
                  <Clock className="h-12 w-12 text-secondary mb-4 animate-pulse" />
                  <h3 className="font-bold text-lg mb-2">En attente de l'hôte</h3>
                  <p className="text-sm text-muted-foreground">La partie va bientôt commencer...</p>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const revealProgress = gameState === 'playing' ? 1 - timeLeft / roundDuration : 1;
  const progressPercent = (timeLeft / roundDuration) * 100;

  return (
    <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto py-4">
      {/* Header Info */}
      <div className="flex justify-between items-end mb-4 px-2">
        <div>
          {mode === 'duel' ? (
            <>
              <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Premier à</p>
              <p className="text-2xl font-bold">{targetScore} <span className="text-muted-foreground text-lg">points</span></p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Manche</p>
              <p className="text-2xl font-bold">{roundNumber} <span className="text-muted-foreground text-lg">/ {totalRounds}</span></p>
            </>
          )}
        </div>
        {gameState === 'playing' && <ReportLogoButton logoId={currentLogo?.token} />}
        <div className="text-right">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Temps</p>
          <p className={cn("text-3xl font-mono font-bold", timeLeft < 5 ? "text-destructive" : "text-primary")}>
            {timeLeft.toFixed(1)}s
          </p>
        </div>
      </div>
      
      <Progress value={progressPercent} className={cn("h-2 mb-6", timeLeft < 5 && "[&>div]:bg-destructive")} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">
        {/* Main Game Area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex-1 flex items-center justify-center bg-card/30 backdrop-blur-md border-primary/20 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {(gameState === 'playing' || gameState === 'round_recap') && currentLogo && (
                <motion.div
                  key={currentLogo.token || 'logo'}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.1, opacity: 0 }}
                  className="w-full h-full flex items-center justify-center relative p-8"
                >
                  <PixelatedLogo src={currentLogo.imageUrl} progress={revealProgress} reveal={gameState !== 'playing'} />
                </motion.div>
              )}
            </AnimatePresence>

            {gameState === 'round_recap' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-10"
              >
                <h2 className="text-sm font-bold tracking-widest text-primary uppercase mb-2">Réponse</h2>
                <p className="text-5xl font-black mb-8 text-foreground">{roundAnswer}</p>
                
                <div className="flex gap-4">
                  <div className="bg-card/50 px-6 py-4 rounded-xl border border-border/50 text-center">
                    <p className="text-muted-foreground text-sm mb-1">Votre Statut</p>
                    {guessState === 'correct' ? (
                      <p className="text-green-500 font-bold flex items-center gap-2"><Check className="w-5 h-5"/> Trouvé</p>
                    ) : (
                      <p className="text-destructive font-bold flex items-center gap-2"><X className="w-5 h-5"/> Raté</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === 'results' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 z-20"
              >
                <Crown className="w-20 h-20 text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                <h2 className="text-4xl font-bold mb-8 text-center">
                  {mode === 'duel' && sortedPlayers[0]
                    ? `🏆 ${sortedPlayers[0].nickname} remporte le duel !`
                    : 'Partie Terminée'}
                </h2>
                
                <div className="w-full max-w-md space-y-3 mb-8">
                  {sortedPlayers.slice(0, 3).map((p, i) => (
                    <div key={p.id} className={cn(
                      "flex items-center justify-between p-4 rounded-xl border",
                      i === 0 ? "bg-yellow-500/10 border-yellow-500/50" :
                      i === 1 ? "bg-gray-400/10 border-gray-400/50" :
                      "bg-orange-700/10 border-orange-700/50"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xl w-6">{i + 1}</span>
                        <span className="font-semibold text-lg">{p.nickname}</span>
                      </div>
                      <span className="font-mono text-xl font-bold">{p.score}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-col items-center gap-3">
                  {amIHost ? (
                    <Button size="lg" className="h-14 px-10 text-lg" onClick={handleRestartGame}>
                      <Play className="mr-2 h-5 w-5" /> Rejouer
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">En attente de l'hôte pour relancer une partie...</p>
                  )}
                  <Button variant="outline" size="lg" onClick={() => setLocation('/')}>
                    Retour à l'accueil
                  </Button>
                </div>
              </motion.div>
            )}
          </Card>

          {/* Input Area */}
          <form onSubmit={handleGuessSubmit} className="relative">
            <Input
              ref={guessInputRef}
              autoFocus
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={gameState !== 'playing' || guessState === 'correct'}
              placeholder={
                gameState !== 'playing' ? "En attente..." :
                guessState === 'correct' ? "Vous avez trouvé !" : 
                "Tapez votre réponse..."
              }
              className={cn(
                "h-16 text-xl text-center shadow-lg transition-colors",
                guessState === 'wrong' && "border-destructive bg-destructive/10 animate-shake",
                guessState === 'correct' && "border-green-500 bg-green-500/10 text-green-500",
                gameState === 'playing' && guessState === 'idle' && "border-primary/50 focus-visible:ring-primary bg-card/50 backdrop-blur-md"
              )}
            />
            <Button 
              type="submit" 
              className="absolute right-2 top-2 h-12 px-8"
              disabled={gameState !== 'playing' || !guess.trim() || guessState === 'correct'}
            >
              Go
            </Button>
          </form>
        </div>

        {/* Leaderboard Sidebar */}
        <Card className="lg:col-span-1 bg-card/40 backdrop-blur-md border-primary/20 flex flex-col">
          <div className="p-4 border-b border-border/50 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Classement</h3>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {sortedPlayers.map((p, i) => (
              <div 
                key={p.id || p.nickname} 
                className={cn(
                  "p-3 rounded-lg flex items-center justify-between transition-colors",
                  p.hasGuessed ? "bg-green-500/20 border border-green-500/30" : "bg-background/40",
                  p.nickname === nickname && "ring-1 ring-primary/50"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-muted-foreground font-bold text-sm w-4">{i + 1}</span>
                  <span className="font-medium truncate text-sm">{p.nickname}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.hasGuessed && <Check className="h-4 w-4 text-green-500" />}
                  <span className="font-mono font-bold text-primary">{p.score}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
