import React from 'react';
import { useStore } from '../store';
import clsx from 'clsx';
import { Play, Pause, Languages, Speaker, Headphones } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export const TranscriptionPanel: React.FC = () => {
  const { 
    transcriptions, 
    fontSize, 
    highContrast, 
    targetLanguage,
    tabAudioVolume,
    translationAudioVolume,
    selectedAudioDevice,
    selectedTranslationDevice,
    setSelectedAudioDevice,
    setSelectedTranslationDevice
  } = useStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const translationAudioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isTranslationPlaying, setIsTranslationPlaying] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [playedTranslations, setPlayedTranslations] = useState<Set<string>>(new Set());
  const [pendingTranslations, setPendingTranslations] = useState<string[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission to access audio devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Get list of audio output devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputDevices = devices.filter(device => device.kind === 'audiooutput');
        setAudioDevices(outputDevices);

        // Listen for device changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      } catch (error) {
        console.error('Error accessing audio devices:', error);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (audioRef.current && 'setSinkId' in audioRef.current) {
      (audioRef.current as any).setSinkId(selectedAudioDevice)
        .catch((error: Error) => console.error('Error setting audio output device:', error));
      // Clamp volume between 0 and 1 for the audio element
      audioRef.current.volume = Math.min(1, tabAudioVolume);
    }
  }, [selectedAudioDevice, tabAudioVolume]);

  useEffect(() => {
    if (translationAudioRef.current && 'setSinkId' in translationAudioRef.current) {
      (translationAudioRef.current as any).setSinkId(selectedTranslationDevice)
        .catch((error: Error) => console.error('Error setting translation audio output device:', error));
      // Clamp volume between 0 and 1 for the audio element
      translationAudioRef.current.volume = Math.min(1, translationAudioVolume);
    }
  }, [selectedTranslationDevice, translationAudioVolume]);

  const loadAudioDuration = (url: string) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setAudioDurations(prev => ({
        ...prev,
        [url]: audio.duration
      }));
    });
  };

  const handlePlayAudio = (url: string) => {
    if (audioRef.current) {
      if (isPlaying === url) {
        // Stop current playback
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(null);
      } else {
        // Stop any current playback and translation playback
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        if (translationAudioRef.current) {
          translationAudioRef.current.pause();
          translationAudioRef.current.currentTime = 0;
          setIsTranslationPlaying(null);
        }
      
        // Play new audio
        audioRef.current.src = url;
        audioRef.current.play().then(() => {
          setIsPlaying(url);
        }).catch(console.error);
      }
    }
  };

  const playNextTranslation = () => {
    // Get all unplayed translations
    const unplayedTranslations = transcriptions
      .filter(t => t.translationAudioUrl && !playedTranslations.has(t.translationAudioUrl))
      .map(t => t.translationAudioUrl!)
      .reverse(); // Newest first

    if (unplayedTranslations.length > 0) {
      const nextUrl = unplayedTranslations[0];
      
      // Stop original audio playback if playing
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(null);
      }
      
      if (translationAudioRef.current) {
        translationAudioRef.current.pause();
        translationAudioRef.current.currentTime = 0;
        translationAudioRef.current.src = nextUrl;
        translationAudioRef.current.play().then(() => {
          setIsTranslationPlaying(nextUrl);
          setPlayedTranslations(prev => new Set([...prev, nextUrl]));
        }).catch(console.error);
      }
    } else {
      setIsTranslationPlaying(null);
    }
  };

  useEffect(() => {
    // Get new unplayed translations
    const unplayedTranslations = transcriptions
      .filter(t => t.translationAudioUrl)
      .filter(t => t.translationAudioUrl && !playedTranslations.has(t.translationAudioUrl))
      .map(t => t.translationAudioUrl!)
      .reverse(); // Newest first

    // Start playing if there are unplayed translations and nothing is currently playing
    if (unplayedTranslations.length > 0 && !isTranslationPlaying) {
      const nextUrl = unplayedTranslations[0];
      if (translationAudioRef.current) {
        translationAudioRef.current.src = nextUrl;
        translationAudioRef.current.play().then(() => {
          setIsTranslationPlaying(nextUrl);
          setPlayedTranslations(prev => new Set([...prev, nextUrl]));
        }).catch(console.error);
      }
    }

    setPendingTranslations(unplayedTranslations);
  }, [transcriptions, playedTranslations, isTranslationPlaying]);

  useEffect(() => {
    transcriptions.forEach(transcription => {
      if (transcription.audioUrl && !audioDurations[transcription.audioUrl]) {
        loadAudioDuration(transcription.audioUrl);
      }
    });
  }, [transcriptions, audioDurations]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(null);
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx('h-full overflow-y-auto p-6 bg-[#1A1A1A] relative scrollbar',
        highContrast ? 'text-yellow-300' : 'text-white'
      )}
      style={{ fontSize: `${fontSize}px` }}
    >
      {transcriptions.length === 0 && (
        <div className="text-center text-gray-400 mt-8">
          <p className="mb-4">Hold spacebar for at least 0.5 seconds to capture audio</p>
          <ul className="text-sm space-y-2">
            <li>• Share a tab or window with audio playing</li>
            <li>• Hold spacebar while audio is playing</li>
            <li>• Release spacebar to process the audio chunk</li>
            <li>• Wait for transcription before capturing next chunk</li>
          </ul>
        </div>
      )}
      {[...transcriptions].reverse().map((transcription) => (
        <div
          key={transcription.id}
          className="mb-4 p-4 rounded bg-[#2A2A2A] shadow-md"
        >
          <div className="flex flex-col space-y-4">
            {/* Original Text and Translation Row */}
            <div className="flex items-start gap-4">
              {/* Original Text Section */}
              <div className="flex-1">
                <div className="flex items-start gap-2 mb-2">
                <p className="flex-1">{transcription.text}</p>
                {transcription.audioUrl && (
                  <button
                    onClick={() => handlePlayAudio(transcription.audioUrl!)}
                    className={clsx(
                      "p-1.5 rounded-full transition-colors flex-shrink-0 mt-0.5",
                      isPlaying === transcription.audioUrl ? "bg-[#7C4DFF]" : "hover:bg-[#3A3A3A]"
                    )}
                    title={isPlaying === transcription.audioUrl ? "Pause audio" : "Play audio"}
                  >
                    {isPlaying === transcription.audioUrl ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className={clsx(
                      "w-4 h-4",
                      isPlaying === transcription.audioUrl ? "text-white" : "text-[#7C4DFF]"
                      )} />
                    )}
                  </button>
                )}
                </div>
              </div>
              
              {/* Translation Section */}
              <div className="flex-1 border-l border-[#3A3A3A] pl-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4 text-[#7C4DFF]" />
                  <span className="text-sm text-[#7C4DFF]">
                    {targetLanguage.toUpperCase()}
                  </span>
                    </div>
                    {transcription.translation ? (
                      <p className="text-gray-300">{transcription.translation}</p>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-500">
                        <div className="w-4 h-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                        <span>Translating...</span>
                      </div>
                    )}
                  </div>
                  {transcription.translation && transcription.translationAudioUrl && (
                    <button
                      onClick={() => {
                        const url = transcription.translationAudioUrl!;
                        if (!translationAudioRef.current) return;

                        // Stop original audio playback if playing
                        if (audioRef.current && isPlaying) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                          setIsPlaying(null);
                        }

                        if (isTranslationPlaying === url) {
                          // Pause current translation
                          translationAudioRef.current.pause();
                          translationAudioRef.current.currentTime = 0;
                          setIsTranslationPlaying(null);
                        } else {
                          // Stop any current translation playback
                          translationAudioRef.current.pause();
                          translationAudioRef.current.currentTime = 0;
                          
                          // Play this translation
                          translationAudioRef.current.src = url;
                          translationAudioRef.current.play().then(() => {
                            setIsTranslationPlaying(url);
                            // Only mark as played when it finishes
                          }).catch(console.error);
                        }
                      }}
                      className={clsx(
                        "p-1.5 rounded-full transition-colors flex-shrink-0 mt-0.5",
                        isTranslationPlaying === transcription.translationAudioUrl
                          ? "bg-[#7C4DFF]"
                          : "hover:bg-[#3A3A3A]"
                      )}
                      title={isTranslationPlaying === transcription.translationAudioUrl
                        ? "Pause translation"
                        : "Play translation"}
                    >
                      {isTranslationPlaying === transcription.translationAudioUrl ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className={clsx(
                          "w-4 h-4",
                          "text-[#7C4DFF]"
                        )} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <audio 
        ref={audioRef} 
        className="hidden" 
        preload="none"
        onError={(e) => console.error('Audio playback error:', e)}
        onPlay={() => {
          // Stop translation playback when original audio starts
          if (translationAudioRef.current && isTranslationPlaying) {
            translationAudioRef.current.pause();
            translationAudioRef.current.currentTime = 0;
            setIsTranslationPlaying(null);
          }
        }}
      />
      <audio 
        ref={translationAudioRef}
        className="hidden"
        preload="none"
        onEnded={() => {
          // Mark current translation as played
          if (isTranslationPlaying) {
            setPlayedTranslations(prev => new Set([...prev, isTranslationPlaying]));
          }
          setIsTranslationPlaying(null);
          // Continue with automatic playback
          playNextTranslation();
        }}
        onError={(e) => console.error('Translation audio playback error:', e)}
      />
    </div>
  );
};