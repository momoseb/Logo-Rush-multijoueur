import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GameState {
  nickname: string;
  sessionId: string;
  setNickname: (name: string) => void;
  ensureSessionId: () => void;
}

// sessionId is stored in sessionStorage (not localStorage) on purpose: it must stay
// scoped to a single browser tab. Two tabs of the same browser are the most common
// way to test/play multiplayer locally, and they must be treated as two different
// players. localStorage is shared across all tabs of the same origin, so a second
// tab would silently reuse the first tab's sessionId, hijack its socket connection
// on `room:join` (server matches players by sessionId) and make the game unplayable
// from the first tab (its "Démarrer"/guess actions target a socket no longer bound
// to any player). sessionStorage still survives a same-tab refresh, so reconnecting
// mid-game keeps working.
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      nickname: '',
      sessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
      setNickname: (nickname) => set({ nickname }),
      ensureSessionId: () => {
        if (!get().sessionId) {
          set({ sessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36) });
        }
      },
    }),
    {
      name: 'logo-rush-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
