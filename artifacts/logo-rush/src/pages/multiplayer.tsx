import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useListPublicRooms, getListPublicRoomsQueryKey } from '@workspace/api-client-react';
import { useGameStore } from '@/store/useGameStore';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Plus, Hash, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Multiplayer() {
  const [, setLocation] = useLocation();
  const { nickname, sessionId, ensureSessionId } = useGameStore();
  const { data: rooms, isLoading } = useListPublicRooms({ query: { queryKey: getListPublicRoomsQueryKey(), refetchInterval: 5000 } });
  const { toast } = useToast();

  
  const [joinCode, setJoinCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomRoundCount, setNewRoomRoundCount] = useState(5);
  const [newRoomRoundDuration, setNewRoomRoundDuration] = useState(20);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    ensureSessionId();
    if (!nickname) {
      setLocation('/');
    }
  }, [nickname, ensureSessionId, setLocation]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    
    const socket = getSocket();
    socket.emit('room:create', { 
      name: newRoomName.trim(),
      nickname,
      sessionId,
      isPublic: true,
      maxPlayers: 10,
      roundCount: newRoomRoundCount,
      roundDuration: newRoomRoundDuration
    }, (result: { ok: boolean; room?: { code: string }; error?: string }) => {
      setIsCreating(false);
      if (result.ok && result.room) setLocation(`/room/${result.room.code}`);
      else toast({ variant: 'destructive', description: result.error || 'Impossible de créer le salon.' });
    });
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    // Just navigate, the room component will handle the actual join via socket
    setLocation(`/room/${joinCode.toUpperCase()}`);
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto space-y-8 py-8">
      <div className="flex items-center gap-4 relative">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')} className="absolute -left-12 top-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold">Multijoueur</h1>
          <p className="text-muted-foreground">Trouvez un salon ou créez le vôtre</p>
        </div>
      </div>

      <Tabs defaultValue="public" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card/50 backdrop-blur-md">
          <TabsTrigger value="public">Salons Publics</TabsTrigger>
          <TabsTrigger value="join">Code Privé</TabsTrigger>
          <TabsTrigger value="create">Créer un salon</TabsTrigger>
        </TabsList>
        
        <TabsContent value="public" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Recherche de salons...</div>
          ) : !rooms || rooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card/30 rounded-xl border border-primary/10">
              Aucun salon public disponible pour le moment.<br/>Créez le vôtre !
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <Card key={room.code} className="bg-card/40 backdrop-blur-md hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span>{room.name}</span>
                      <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-1 rounded-md">{room.code}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {room.playerCount} / {room.maxPlayers} joueurs
                      </div>
                      <Button 
                        size="sm"
                        disabled={room.status === 'playing' || room.playerCount >= room.maxPlayers}
                        onClick={() => setLocation(`/room/${room.code}`)}
                      >
                        Rejoindre
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="join" className="mt-6">
          <Card className="bg-card/40 backdrop-blur-md">
            <CardContent className="pt-6">
              <form onSubmit={handleJoinByCode} className="space-y-4 max-w-md mx-auto">
                <div className="text-center space-y-2 mb-6">
                  <Hash className="w-12 h-12 mx-auto text-primary opacity-50" />
                  <h3 className="text-xl font-semibold">Rejoindre avec un code</h3>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Ex: AB12"
                    className="font-mono text-center text-lg h-12 uppercase"
                    maxLength={6}
                    data-testid="input-join-code"
                  />
                  <Button type="submit" disabled={!joinCode.trim()} className="h-12 px-8">
                    <LogIn className="w-5 h-5 mr-2" /> Go
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="create" className="mt-6">
          <Card className="bg-card/40 backdrop-blur-md">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateRoom} className="space-y-4 max-w-md mx-auto">
                <div className="text-center space-y-2 mb-6">
                  <Plus className="w-12 h-12 mx-auto text-secondary opacity-50" />
                  <h3 className="text-xl font-semibold">Créer un nouveau salon</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nom du salon</label>
                    <Input 
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Le repaire des boss"
                      className="h-12"
                      data-testid="input-room-name"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Nombre de manches</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={newRoomRoundCount === value ? 'default' : 'outline'}
                          onClick={() => setNewRoomRoundCount(value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Durée d'une manche</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 20, 30].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={newRoomRoundDuration === value ? 'secondary' : 'outline'}
                          onClick={() => setNewRoomRoundDuration(value)}
                        >
                          {value} s
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={!newRoomName.trim() || isCreating} className="w-full h-12" variant="secondary">
                    {isCreating ? 'Création...' : 'Créer le salon'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
