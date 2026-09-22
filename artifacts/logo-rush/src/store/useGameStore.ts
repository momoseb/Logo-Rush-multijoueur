import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface NicknameState {
  nickname: string;
  setNickname: (name: string) => void;
}

interface SessionState {
  sessionId: string;
  ensureSessionId: () => void;
}

// Nickname lives in localStorage (shared across tabs) on purpose: it's just a
// display preference, and players expect it to still be there when they open
// the game in a new tab.
const useNicknameStore = create<NicknameState>()(
  persist(
    (set) => ({
      nickname: '',
      setNickname: (nickname) => set({ nickname }),
    }),
    {
      name: 'logo-rush-nickname',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// sessionId is stored in sessionStorage (not localStorage) on purpose: it must stay
// scoped to a single browser tab. Two tabs of the same browser are the most common
// way to test/play multiplayer locally, and they must be treated as two different
// players. localStorage is shared across all tabs of the same origin, so a second
// tab would silently reuse the first tab's sessionId, hijack its socket connection
// on `room:join` (server matches players by sessionId) and make the game unplayable
// from the first tab (its "Démarrer"/guess actions target a socket no longer bound
// to any player). sessionStorage still survives a same-tab refresh, so reconnecting
// mid-game keeps working.
const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
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

type GameState = NicknameState & SessionState;

// Thin composed hook kept for backwards compatibility: callers use it exactly
// like a single zustand store (with or without a selector), but nickname and
// sessionId are actually backed by two separate stores with different storage
// scopes (see above). Store actions (setNickname/ensureSessionId) stay
// referentially stable across renders since they come straight from the
// underlying stores, so effect dependency arrays relying on them are safe.
export function useGameStore(): GameState;
export function useGameStore<T>(selector: (state: GameState) => T): T;
export function useGameStore<T>(selector?: (state: GameState) => T): T | GameState {
  const nickname = useNicknameStore((state) => state.nickname);
  const setNickname = useNicknameStore((state) => state.setNickname);
  const sessionId = useSessionStore((state) => state.sessionId);
  const ensureSessionId = useSessionStore((state) => state.ensureSessionId);
  const state: GameState = { nickname, setNickname, sessionId, ensureSessionId };
  return selector ? selector(state) : state;
}
