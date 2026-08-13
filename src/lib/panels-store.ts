// Состояние всплывающих боковых панелей (сообщения, избранное, уведомления).
import { create } from "zustand";

interface PanelsState {
  messagesOpen: boolean;
  favoritesOpen: boolean;
  notificationsOpen: boolean;
  /** Открытый диалог внутри панели сообщений (null — список). */
  conversationId: string | null;
  openMessages: (conversationId?: string | null) => void;
  closeMessages: () => void;
  setConversation: (id: string | null) => void;
  openFavorites: () => void;
  closeFavorites: () => void;
  openNotifications: () => void;
  closeNotifications: () => void;
}

export const usePanels = create<PanelsState>()((set) => ({
  messagesOpen: false,
  favoritesOpen: false,
  notificationsOpen: false,
  conversationId: null,
  openMessages: (conversationId = null) =>
    set({ messagesOpen: true, favoritesOpen: false, notificationsOpen: false, conversationId }),
  closeMessages: () => set({ messagesOpen: false, conversationId: null }),
  setConversation: (id) => set({ conversationId: id }),
  openFavorites: () => set({ favoritesOpen: true, messagesOpen: false, notificationsOpen: false }),
  closeFavorites: () => set({ favoritesOpen: false }),
  openNotifications: () =>
    set({ notificationsOpen: true, messagesOpen: false, favoritesOpen: false }),
  closeNotifications: () => set({ notificationsOpen: false }),
}));
