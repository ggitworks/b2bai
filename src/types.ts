export interface Transcription {
  id: string;
  text: string;
  translation?: string;
  translationAudioUrl?: string;
  timestamp: number;
  audioUrl?: string;
}

export interface TranscriptionGroup {
  id: string;
  transcriptions: Transcription[];
  summary: string | null;
  timestamp: number;
}

export interface ErrorLog {
  id: string;
  message: string;
  timestamp: number;
  type: 'error' | 'warning';
}

export interface AppState {
  isSharing: boolean;
  isRecording: boolean;
  transcriptions: Transcription[];
  targetLanguage: string;
  errorLogs: ErrorLog[];
  audioLevel: number;
  isConnected: boolean;
  selectedLanguage: string;
  fontSize: number;
  isSettingsPanelOpen: boolean;
  tabAudioVolume: number;
  translationAudioVolume: number;
  transcriptionGroups: TranscriptionGroup[];
  highContrast: boolean;
  activeStream: MediaStream | null;
  translations: Record<string, string>;
  sharingError: string | null;
  isDiagnosticPanelVisible: boolean;
  geminiApiKey: string | null;
  translationApiKey: string | null;
  selectedAudioDevice: string;
  selectedTranslationDevice: string;
  startSharing: () => Promise<MediaStream>;
  stopSharing: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  addTranscription: (text: string) => void;
  addTranscriptionGroup: (group: TranscriptionGroup) => void;
  addErrorLog: (message: string, type?: 'error' | 'warning') => void;
  setAudioLevel: (level: number) => void;
  setLanguage: (language: string) => void;
  setFontSize: (size: number) => void;
  toggleHighContrast: () => void;
  toggleSettingsPanel: () => void;
  toggleDiagnosticPanel: () => void;
  setTargetLanguage: (language: string) => void;
  setSelectedAudioDevice: (deviceId: string) => void;
  setSelectedTranslationDevice: (deviceId: string) => void;
  setGeminiApiKey: (apiKey: string) => void;
  setTabAudioVolume: (volume: number) => void;
  setTranslationAudioVolume: (volume: number) => void;
  setTranslationApiKey: (apiKey: string) => void;
  addTranslation: (id: string, translation: string) => void;
}