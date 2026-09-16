import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  nickname: string;
  sessionId: string;
  setNickname: (name: string) => void;
  ensureSessionId: () => void;
}

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
    }
  )
);
