import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useGetGameStats, getGetGameStatsQueryKey } from '@workspace/api-client-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Gamepad2, Users, Trophy, ChevronRight, Activity, Medal, ShieldCheck, Info } from 'lucide-react';

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { nickname, setNickname } = useGameStore();
  const [localName, setLocalName] = useState(nickname);

  const { data: stats, isLoading: statsLoading } = useGetGameStats({
    query: {
      queryKey: getGetGameStatsQueryKey(),
      refetchInterval: 10000,
    }
  });

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (localName.trim().length >= 2 && localName.trim().length <= 20) {
      setNickname(localName.trim());
    }
  };

  const isNameSet = !!nickname;

  return (
    <motion.div 
      className="flex-1 flex flex-col items-center justify-center space-y-12 py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="text-center space-y-4">
        <motion.div 
          className="inline-block mb-4"
          whileHover={{ scale: 1.05, rotate: 2 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="relative">
            <h1 className="text-6xl sm:text-8xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-primary via-accent to-secondary">
              LOGO RUSH
            </h1>
            <div className="absolute -inset-1 bg-primary/20 blur-xl -z-10 rounded-full" />
          </div>
        </motion.div>
        <p className="text-xl sm:text-2xl text-muted-foreground max-w-lg mx-auto font-medium">
          {t('home.tagline')}
        </p>
      </div>

      {!isNameSet ? (
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-primary/20 shadow-2xl shadow-primary/10">
          <CardContent className="pt-6">
            <form onSubmit={handleSaveName} className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold">{t('home.chooseNickname')}</h2>
                <p className="text-sm text-muted-foreground">{t('home.nicknamePrompt')}</p>
              </div>
              <div className="space-y-4">
                <Input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder={t('home.nicknamePlaceholder')}
                  className="text-center text-lg h-14 bg-background/50 border-primary/30 focus-visible:ring-primary"
                  minLength={2}
                  maxLength={20}
                  data-testid="input-nickname"
                />
                <Button
                  type="submit"
                  disabled={localName.trim().length < 2 || localName.trim().length > 20}
                  className="w-full h-14 text-lg font-bold"
                  size="lg"
                  data-testid="button-save-nickname"
                >
                  {t('home.start')} <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="h-full cursor-pointer hover:border-primary/50 transition-colors bg-card/40 backdrop-blur-md group"
              onClick={() => setLocation('/solo')}
              data-testid="card-mode-solo"
            >
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Gamepad2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold">{t('home.soloMode')}</h3>
                <p className="text-muted-foreground">{t('home.soloDescription')}</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="h-full cursor-pointer hover:border-secondary/50 transition-colors bg-card/40 backdrop-blur-md group relative overflow-hidden"
              onClick={() => setLocation('/multiplayer')}
              data-testid="card-mode-multi"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold">{t('home.multiplayer')}</h3>
                <p className="text-muted-foreground">{t('home.multiplayerDescription')}</p>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      )}

      <motion.div className="w-full max-w-3xl" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Card
          className="cursor-pointer hover:border-accent/50 transition-colors bg-card/40 backdrop-blur-md group"
          onClick={() => setLocation('/leaderboard')}
          data-testid="card-leaderboard"
        >
          <CardContent className="p-6 flex flex-col sm:flex-row items-center text-center sm:text-left gap-5">
            <div className="h-14 w-14 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
              <Medal className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">{t('home.leaderboard')}</h3>
              <p className="text-muted-foreground">{t('home.leaderboardDescription')}</p>
            </div>
            <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Stats */}
      <div className="flex gap-4 sm:gap-8 opacity-80 mt-12">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-secondary animate-pulse" />
          <span>{statsLoading ? '...' : t('home.playersOnline', { count: stats?.playersOnline || 0 })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Trophy className="h-4 w-4 text-primary" />
          <span>{statsLoading ? '...' : t('home.gamesInProgress', { count: stats?.gamesInProgress || 0 })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/logo-audit')} data-testid="button-open-logo-audit">
          <ShieldCheck className="h-4 w-4" />
          {t('home.logoAudit')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setLocation('/about')} data-testid="button-open-about">
          <Info className="h-4 w-4" />
          {t('about.title')}
        </Button>
      </div>
    </motion.div>
  );
}
