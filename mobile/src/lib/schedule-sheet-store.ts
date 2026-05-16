import { create } from 'zustand';

type ScheduleSheetState = {
  initialDate: Date;
  onConfirm: ((date: Date) => void | Promise<void>) | null;
  open: (initialDate: Date, onConfirm: (date: Date) => void | Promise<void>) => void;
  reset: () => void;
};

export const useScheduleSheetStore = create<ScheduleSheetState>((set) => ({
  initialDate: new Date(),
  onConfirm: null,
  open: (initialDate, onConfirm) => set({ initialDate, onConfirm }),
  reset: () => set({ onConfirm: null }),
}));
