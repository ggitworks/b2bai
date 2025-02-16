import React from 'react';
import { Settings, MonitorUp, StopCircle, Copy, Download, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { useAudioCapture } from '../hooks/useAudioCapture';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

export const ControlPanel: React.FC = () => {
  const {
    isSharing,
    isRecording,
    toggleSettingsPanel,
    targetLanguage,
    setTargetLanguage,
    startSharing,
    stopSharing,
    transcriptions,
  } = useStore();

  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecording) {
        setIsPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPressed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording]);

  useAudioCapture();

  const handleShare = async () => {
    if (!isSharing) {
      try {
        console.log('🎥 Starting screen share with system audio...');
        await startSharing();
      } catch (error) {
        console.error('Failed to start screen share:', error);
        // Error handling is already done in the store
      }
    } else {
      console.log('🛑 Stopping screen share...');
      stopSharing();
    }
  };

  const handleCopyTranscription = () => {
    const text = transcriptions.map((t) => t.text).join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleExport = (format: 'txt' | 'srt') => {
    let content = '';
    if (format === 'txt') {
      content = transcriptions.map((t) => t.text).join('\n\n');
    } else {
      content = transcriptions
        .map((t, i) => {
          const time = new Date(t.timestamp).toISOString().slice(11, 23);
          return `${i + 1}\n${time} --> ${time}\n${t.text}\n\n`;
        })
        .join('');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A] p-4 rounded-lg shadow-lg flex items-center gap-4">
      <button
        title={isSharing ? 'Stop sharing' : 'Share screen with system audio'}
        onClick={handleShare}
        className={clsx(
          'p-2 rounded-full transition-colors',
          isSharing ? 'bg-red-500 hover:bg-red-600' : 'bg-[#7C4DFF] hover:bg-[#6B42E0]'
        )}
      >
        {isSharing ? <StopCircle className="w-6 h-6 text-white" /> : <MonitorUp className="w-6 h-6 text-white" />}
      </button>

      <button
        title="Press spacebar or click to generate summary"
        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))}
        className={clsx('px-6 py-3 rounded-lg text-white whitespace-nowrap transition-all duration-150 flex items-center gap-2',
          isRecording ? (
            isPressed ? 
            'bg-[#6B42E0] scale-95 shadow-inner' : 
            'bg-[#7C4DFF] hover:bg-[#6B42E0] shadow-lg'
          ) : 'bg-gray-700 hover:bg-gray-600 cursor-not-allowed'
        )}
        disabled={!isRecording}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium">Generate Summary</span>
      </button>

      <select
        value={targetLanguage}
        onChange={(e) => setTargetLanguage(e.target.value)}
        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent"
      >
        <option value="tr">Turkish</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="it">Italian</option>
        <option value="pt">Portuguese</option>
        <option value="ru">Russian</option>
        <option value="ja">Japanese</option>
        <option value="ko">Korean</option>
        <option value="zh">Chinese</option>
      </select>

      <button
        onClick={handleCopyTranscription}
        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
      >
        <Copy className="w-6 h-6 text-white" />
      </button>

      <div className="relative group">
        <button className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
          <Download className="w-6 h-6 text-white" />
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
          <div className="bg-[#1A1A1A] rounded-lg shadow-lg p-2 flex flex-col gap-2">
            <button
              onClick={() => handleExport('txt')}
              className="px-4 py-2 text-white hover:bg-[#2A2A2A] rounded"
            >
              Export as TXT
            </button>
            <button
              onClick={() => handleExport('srt')}
              className="px-4 py-2 text-white hover:bg-[#2A2A2A] rounded"
            >
              Export as SRT
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={toggleSettingsPanel}
        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
      >
        <Settings className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};