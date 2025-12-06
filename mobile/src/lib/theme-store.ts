import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

const secureStorage: StateStorage = {
  getItem: async (name: string) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      console.warn('Failed to save theme preference');
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      console.warn('Failed to remove theme preference');
    }
  },
};

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      setMode: (mode: ThemeMode) => set({ mode }),
      toggleTheme: () => {
        const currentMode = get().mode;
        if (currentMode === 'light') {
          set({ mode: 'dark' });
        } else {
          set({ mode: 'light' });
        }
      },
      getEffectiveTheme: () => {
        const mode = get().mode;
        if (mode === 'system') {
          return Appearance.getColorScheme() || 'light';
        }
        return mode;
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
