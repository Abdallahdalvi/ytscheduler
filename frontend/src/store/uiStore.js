import { create } from 'zustand'

export const useUiStore = create((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  globalSearch: '',
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
}))
