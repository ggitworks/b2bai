import { create } from 'zustand';
import { AppState, Transcription, TranscriptionGroup } from './types';
import { initializeGemini, initializeTranslationAPI, summarizeTranscripts, translateToTurkish } from './services/gemini';
import { generateSpeech } from './services/elevenlabs';

export const useStore = create<AppState>((set, get) => ({
  isSharing: false,
  isRecording: false,
  transcriptions: [],
  isSettingsPanelOpen: false,
  isDiagnosticPanelVisible: true,
  targetLanguage: 'tr',
  tabAudioVolume: 2.5,
  translationAudioVolume: 2.5,
  transcriptionGroups: [],
  errorLogs: [],
  audioLevel: 0,
  translations: {},
  isConnected: true,
  selectedLanguage: 'en-US',
  fontSize: 16,
  highContrast: false,
  activeStream: null,
  geminiApiKey: null,
  translationApiKey: null,
  selectedAudioDevice: 'default',
  selectedTranslationDevice: 'default',
  sharingError: null,

  setTargetLanguage: (language: string) => {
    set({ targetLanguage: language });
  },

  setSelectedAudioDevice: (deviceId: string) => {
    set({ selectedAudioDevice: deviceId });
  },

  setSelectedTranslationDevice: (deviceId: string) => {
    set({ selectedTranslationDevice: deviceId });
  },
  
  setTabAudioVolume: (volume: number) => {
    set({ tabAudioVolume: volume });
  },
  
  setTranslationAudioVolume: (volume: number) => {
    set({ translationAudioVolume: volume });
  },

  startSharing: async () => {
    // First ensure any existing streams are properly cleaned up
    get().stopSharing();

    try {
      console.log('🎥 Requesting screen share with real audio...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          // Explicitly configure for system audio only
          suppressLocalAudioPlayback: false,
          // Disable microphone-related features
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Ensure we only get system audio
          mediaSource: 'desktop'
        }
      });
      
      // Verify we have an audio track from screen share
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioTrack = audioTracks[0];
        
        if (audioTrack.enabled && audioTrack.readyState === 'live') {
          console.log('✅ Real audio track captured:', audioTrack.label);
          set({ isRecording: true });
        } else {
          console.warn('⚠️ Audio track is not from screen share:', audioTrack.label);
          set({ 
            isSharing: false,
            activeStream: null,
            sharingError: 'Please enable "Share system audio" when selecting your tab or window'
          });
          stream.getTracks().forEach(track => track.stop());
        }
      } else {
        console.warn('⚠️ No real audio track available');
        set({ 
          isSharing: false,
          activeStream: null,
          sharingError: 'No system audio detected. Please enable "Share system audio" when selecting your tab or window'
        });
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Handle stream ending
      stream.getVideoTracks()[0].onended = () => {
        console.log('📺 Screen share ended by user');
        get().stopSharing();
      };

      set({ 
        isSharing: true, 
        activeStream: stream,
        sharingError: null 
      });

      return stream;
    } catch (error) {
      let errorMessage = 'Failed to start screen sharing';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          errorMessage = 'Screen sharing was cancelled. Click "Try Again" when you\'re ready to share.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No screen sharing device found.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      console.error('Error starting screen share:', error);
      get().addErrorLog(errorMessage);
      set({ 
        isSharing: false, 
        activeStream: null,
        isRecording: false,
        sharingError: errorMessage
      });
      
      return null;
    }
  },

  stopSharing: () => {
    const { activeStream } = get();
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    set({ 
      isSharing: false, 
      isRecording: false,
      activeStream: null,
      sharingError: null
    });
  },

  startRecording: () => {
    const { isSharing, activeStream } = get();
    if (!isSharing || !activeStream) {
      console.warn('Cannot start recording without active screen share');
      return;
    }
    set({ isRecording: true });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  addTranscription: (text: string) => {
    const newTranscription: Transcription = {
      id: Date.now().toString(),
      text,
      translation: undefined,
      timestamp: Date.now()
    };
    
    set((state) => {
      // Add the new transcription
      const updatedTranscriptions = [...state.transcriptions, newTranscription];
      
      // Create a new group for this transcription
      const newGroup: TranscriptionGroup = {
        id: Date.now().toString(),
        transcriptions: [newTranscription],
        summary: null,
        timestamp: Date.now(),
      };
      
      // Get summary from Gemini
      summarizeTranscripts([text])
        .then(summary => {
          set(state => ({
            transcriptionGroups: state.transcriptionGroups.map(group =>
              group.id === newGroup.id
                ? { ...group, summary }
                : group
            ),
          }));
        })
        .catch(error => {
          console.error('Failed to get summary:', error);
          get().addErrorLog('Failed to summarize transcripts: ' + error.message, 'warning');
        });
      
      // Get Turkish translation
      translateToTurkish(text, get().targetLanguage)
        .then(translation => {
          const { targetLanguage } = get();
          const isError = translation.startsWith('Translation');

          if (isError) {
            // Only log actual errors, not temporary unavailability
            if (!translation.includes('temporarily')) {
              get().addErrorLog(translation, 'warning');
            }
            set(state => ({
              transcriptions: state.transcriptions.map(t =>
                t.id === newTranscription.id
                  ? { ...t, translation: 'Translation temporarily unavailable' }
                  : t
              ),
            }));
          } else {
            console.log('✅ Translation received:', translation);
            // Generate speech from translation
            generateSpeech(translation)
              .then(audioUrl => {
                set(state => ({
                  transcriptions: state.transcriptions.map(t =>
                    t.id === newTranscription.id
                      ? { ...t, translation, translationAudioUrl: audioUrl }
                      : t
                  ),
                }));
              })
              .catch(error => {
                console.error('Failed to generate speech:', error);
                get().addErrorLog('Failed to generate speech audio', 'warning');
              });

            set(state => ({
              transcriptions: state.transcriptions.map(t =>
                t.id === newTranscription.id
                  ? { ...t, translation }
                  : t
              ),
            }));
          }
        })
        .catch(error => {
          console.error('Failed to get translation:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unexpected translation error';
          get().addErrorLog(errorMessage, 'warning');
          set(state => ({
            transcriptions: state.transcriptions.map(t =>
              t.id === newTranscription.id
                ? { ...t, translation: 'Translation temporarily unavailable' }
                : t
            ),
          }));
        });
      
      return {
        transcriptions: updatedTranscriptions,
        transcriptionGroups: [...state.transcriptionGroups, newGroup],
      };
    });
  },

  addTranscriptionGroup: (group: TranscriptionGroup) => {
    set((state) => ({
      transcriptionGroups: [...state.transcriptionGroups, group]
    }));
  },

  updateTranscriptionAudio: (text: string, audioUrl: string) => {
    set((state) => ({
      transcriptions: state.transcriptions.map(t =>
        t.text === text ? { ...t, audioUrl } : t
      )
    }));
  },

  addErrorLog: (message: string, type: 'error' | 'warning' = 'error') => {
    const newError: ErrorLog = {
      id: Date.now().toString(),
      message,
      timestamp: Date.now(),
      type,
    };
    set((state) => ({
      errorLogs: [...state.errorLogs, newError],
    }));
  },

  setAudioLevel: (level: number) => {
    set({ audioLevel: level });
  },

  setLanguage: (language: string) => {
    set({ selectedLanguage: language });
  },

  setFontSize: (size: number) => {
    set({ fontSize: size });
  },

  toggleHighContrast: () => {
    set((state) => ({ highContrast: !state.highContrast }));
  },
  toggleSettingsPanel: () => {
    set((state) => ({ isSettingsPanelOpen: !state.isSettingsPanelOpen }));
  },
  
  toggleDiagnosticPanel: () => {
    set((state) => ({ isDiagnosticPanelVisible: !state.isDiagnosticPanelVisible }));
  },

  addTranslation: (id: string, translation: string) => {
    set(state => ({
      transcriptions: state.transcriptions.map(t =>
        t.id === id ? { ...t, translation } : t
      ),
    }));
  },

  setGeminiApiKey: (apiKey: string) => {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('Invalid API key format');
      }

      initializeGemini(apiKey);
      set({ geminiApiKey: apiKey });
      console.log('✅ Gemini API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid API configuration';
      get().addErrorLog(`Failed to initialize Gemini API: ${errorMessage}`);
      // Clear the API key if initialization failed
      set({ geminiApiKey: null });
    }
  },

  setTranslationApiKey: (apiKey: string) => {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('Invalid Translation API key format');
      }

      initializeTranslationAPI(apiKey);
      set({ translationApiKey: apiKey });
      console.log('✅ Translation API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Translation API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid Translation API configuration';
      get().addErrorLog(`Failed to initialize Translation API: ${errorMessage}`);
      // Clear the API key if initialization failed
      set({ translationApiKey: null });
    }
  },
}));