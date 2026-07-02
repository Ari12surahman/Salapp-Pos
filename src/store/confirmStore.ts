import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  showConfirm: (options: { title: string, message: string, confirmText?: string, cancelText?: string }) => Promise<boolean>;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'YA, HAPUS',
  cancelText: 'BATAL',
  onConfirm: () => {},
  onCancel: () => {},
  showConfirm: ({ title, message, confirmText = 'YA', cancelText = 'BATAL' }) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          set({ isOpen: false });
          resolve(true);
        },
        onCancel: () => {
          set({ isOpen: false });
          resolve(false);
        }
      });
    });
  },
  closeConfirm: () => set({ isOpen: false }),
}));
