import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PendingTransaction {
  id: string; // uuid
  payload: any;
  timestamp: number;
}

interface SyncState {
  pendingQueue: PendingTransaction[];
  addPending: (payload: any) => void;
  removePending: (id: string) => void;
  clearQueue: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      pendingQueue: [],
      addPending: (payload) => set((state) => ({
        pendingQueue: [...state.pendingQueue, { id: crypto.randomUUID(), payload, timestamp: Date.now() }]
      })),
      removePending: (id) => set((state) => ({
        pendingQueue: state.pendingQueue.filter(t => t.id !== id)
      })),
      clearQueue: () => set({ pendingQueue: [] })
    }),
    {
      name: 'pos-sync-queue',
    }
  )
);
