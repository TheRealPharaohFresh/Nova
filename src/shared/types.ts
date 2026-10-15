export type ThemeName = "dark" | "light";

export type MicStatus = "off" | "listening" | "processing";

export type PermissionKey =
  | "microphone"
  | "screen"
  | "clipboard"
  | "browser"
  | "files"
  | "terminal"
  | "network"
  | "startup"
  | "notifications";

export type AiProviderId = "openai" | "anthropic" | "google" | "local" | "custom";

export interface HudSettings {
  alwaysOnTop: boolean;
  opacity: number;
  clickThrough: boolean;
  compact: boolean;
}

export interface StartupSettings {
  launchAtLogin: boolean;
  startMinimized: boolean;
  startInTray: boolean;
  openHud: boolean;
  startListening: boolean;
  greetUser: boolean;
}

export interface IdentitySettings {
  assistantName: string;
  userName: string;
}

export interface PersonalitySettings {
  preset: "professional" | "researcher" | "assistant" | "coach" | "custom";
  customInstructions: string;
}

export interface VoiceSettings {
  mute: boolean;
  autoSpeak: boolean;
  rate: number;
  volume: number;
  voiceURI: string;
  vadEnabled: boolean;
  vadRmsThreshold: number;
  requireWakePhrase: boolean;
  wakePhrase: string;
}

export interface HotkeySettings {
  toggleHud: string;
  toggleListen: string;
  pushToTalk: string;
  emergencyStop: string;
}

export type MemoryCategory =
  | "preferences"
  | "identity"
  | "personality"
  | "coding"
  | "projects"
  | "security"
  | "business"
  | "goals"
  | "instructions";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type HotkeyAction = "toggleHud" | "toggleListen" | "pushToTalk" | "emergencyStop";

export interface AppSettings {
  theme: ThemeName;
  hud: HudSettings;
  startup: StartupSettings;
  identity: IdentitySettings;
  personality: PersonalitySettings;
  voice: VoiceSettings;
  hotkeys: HotkeySettings;
  automationPaused: boolean;
  emergencyStopped: boolean;
  firstRunComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  hud: {
    alwaysOnTop: true,
    opacity: 0.92,
    clickThrough: false,
    compact: true
  },
  startup: {
    launchAtLogin: false,
    startMinimized: false,
    startInTray: false,
    openHud: true,
    startListening: false,
    greetUser: false
  },
  identity: {
    assistantName: "NOVA",
    userName: "there"
  },
  personality: {
    preset: "assistant",
    customInstructions: ""
  },
  voice: {
    mute: false,
    autoSpeak: true,
    rate: 1,
    volume: 1,
    voiceURI: "",
    vadEnabled: true,
    vadRmsThreshold: 0.04,
    requireWakePhrase: false,
    wakePhrase: "hey nova"
  },
  hotkeys: {
    toggleHud: "CommandOrControl+Shift+H",
    toggleListen: "CommandOrControl+Shift+L",
    pushToTalk: "CommandOrControl+Shift+Space",
    emergencyStop: "CommandOrControl+Shift+F12"
  },
  automationPaused: false,
  emergencyStopped: false,
  firstRunComplete: false
};

export const PERMISSION_CATALOG: Record<
  PermissionKey,
  { label: string; explanation: string }
> = {
  microphone: {
    label: "Microphone",
    explanation: "Lets NOVA hear you when listening is explicitly started. Never records secretly."
  },
  screen: {
    label: "Screen",
    explanation: "Lets NOVA capture a screenshot only when you request analysis."
  },
  clipboard: {
    label: "Clipboard",
    explanation: "Lets NOVA read clipboard text you ask it to use."
  },
  browser: {
    label: "Browser",
    explanation: "Lets NOVA use an authorized browser session for research you approve."
  },
  files: {
    label: "Files",
    explanation: "Lets NOVA read or propose edits in folders you select. No silent writes."
  },
  terminal: {
    label: "Terminal",
    explanation: "Lets NOVA run allowlisted commands you approve."
  },
  network: {
    label: "Network",
    explanation: "Lets NOVA call configured AI providers and authorized research targets."
  },
  startup: {
    label: "Startup",
    explanation: "Lets NOVA launch when you sign in to the computer."
  },
  notifications: {
    label: "Notifications",
    explanation: "Lets NOVA show system notifications you have enabled."
  }
};
