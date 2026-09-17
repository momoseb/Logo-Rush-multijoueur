import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useHealthCheck, getHealthCheckQueryKey, getGetGameStatsQueryKey } from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Home from '@/pages/home';
import Solo from '@/pages/solo';
import Multiplayer from '@/pages/multiplayer';
import Room from '@/pages/room';
import Leaderboard from '@/pages/leaderboard';
import NotFound from '@/pages/not-found';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/store/useGameStore';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/solo" component={Solo} />
        <Route path="/multiplayer" component={Multiplayer} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/room/:code" component={Room} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ServerStatus() {
  const { data, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });
  
  if (isError || (data && data.status !== 'ok')) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs font-medium text-destructive bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-destructive/20">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        Hors ligne
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/50">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      En ligne
    </div>
  );
}

function OnlinePresence() {
  const sessionId = useGameStore((state) => state.sessionId);

  useEffect(() => {
    const socket = getSocket();
    const identify = () => socket.emit('presence:identify', { sessionId });
    const updateStats = (stats: { playersOnline: number; publicRooms: number; gamesInProgress: number }) => {
      queryClient.setQueryData(getGetGameStatsQueryKey(), stats);
    };

    if (socket.connected) identify();
    socket.on('connect', identify);
    socket.on('stats:update', updateStats);

    return () => {
      socket.off('connect', identify);
      socket.off('stats:update', updateStats);
    };
  }, [sessionId]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '')}>
          <OnlinePresence />
          <main className="min-h-[100dvh] flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col relative">
              {/* Animated decorative elements could go here */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
              
              <Router />
            </div>
            <ServerStatus />
          </main>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
