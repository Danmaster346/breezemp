// Состояние всплывающих боковых панелей (сообщения, избранное).
import { create } from "zustand";

interface PanelsState {
  messagesOpen: boolean;
  favoritesOpen: boolean;
  /** Открытый диалог внутри панели сообщений (null — список). */
  conversationId: string | null;
  openMessages: (conversationId?: string | null) => void;
  closeMessages: () => void;
  setConversation: (id: string | null) => void;
  openFavorites: () => void;
  closeFavorites: () => void;
}

export const usePanels = create<PanelsState>()((set) => ({
  messagesOpen: false,
  favoritesOpen: false,
  conversationId: null,
  openMessages: (conversationId = null) =>
    set({ messagesOpen: true, favoritesOpen: false, conversationId }),
  closeMessages: () => set({ messagesOpen: false, conversationId: null }),
  setConversation: (id) => set({ conversationId: id }),
  openFavorites: () => set({ favoritesOpen: true, messagesOpen: false }),
  closeFavorites: () => set({ favoritesOpen: false }),
}));
