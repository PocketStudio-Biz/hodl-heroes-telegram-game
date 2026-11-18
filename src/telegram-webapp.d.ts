interface TelegramWebAppUser {
  id?: number;
  username?: string;
  first_name?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  headerColor?: string;
  backgroundColor?: string;
  disableClosingConfirmation?: () => void;
  viewportStableHeight?: number;
  initDataUnsafe?: { user?: TelegramWebAppUser };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (style: "success" | "warning" | "error") => void;
  };
  switchInlineQuery?: (query: string, chooseChatTypes?: string[]) => void;
  openTelegramLink?: (url: string) => void;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
