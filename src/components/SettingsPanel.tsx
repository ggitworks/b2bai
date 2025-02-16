import React from 'react';
import { useStore } from '../store';
import { X, Speaker, Headphones } from 'lucide-react';
import { useEffect, useState } from 'react';

export const SettingsPanel: React.FC = () => {
  const {
    isSettingsPanelOpen,
    toggleSettingsPanel,
    selectedAudioDevice,
    selectedTranslationDevice,
    setSelectedAudioDevice,
    setSelectedTranslationDevice, 
    tabAudioVolume,
    translationAudioVolume,
    setTabAudioVolume,
    setTranslationAudioVolume
  } = useStore();

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputDevices = devices.filter(device => device.kind === 'audiooutput');
        setAudioDevices(outputDevices);

        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      } catch (error) {
        console.error('Error accessing audio devices:', error);
      }
    };
    getDevices();
  }, []);

  if (!isSettingsPanelOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1A1A1A] rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={toggleSettingsPanel}
            className="p-1 hover:bg-[#2A2A2A] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Audio Output Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400">Audio Output</h3>
            
            {/* Tab Audio Device */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Speaker className="w-4 h-4 text-[#7C4DFF]" />
                <label className="text-sm text-white">Tab Audio Output</label>
              </div>
              <div className="space-y-3">
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  className="w-full bg-[#2A2A2A] text-white text-sm rounded px-3 py-2 border border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#7C4DFF]"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId}`}
                    </option>
                  ))}
                </select>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Volume</span>
                    <span className="text-xs text-gray-400">{Math.round(tabAudioVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.01"
                    value={tabAudioVolume}
                    onChange={(e) => setTabAudioVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#7C4DFF]"
                  />
                </div>
              </div>
            </div>

            {/* Translation Audio Device */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#7C4DFF]" />
                <label className="text-sm text-white">Translation Audio Output</label>
              </div>
              <div className="space-y-3">
                <select
                  value={selectedTranslationDevice}
                  onChange={(e) => setSelectedTranslationDevice(e.target.value)}
                  className="w-full bg-[#2A2A2A] text-white text-sm rounded px-3 py-2 border border-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#7C4DFF]"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId}`}
                    </option>
                  ))}
                </select>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Volume</span>
                    <span className="text-xs text-gray-400">{Math.round(translationAudioVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.01"
                    value={translationAudioVolume}
                    onChange={(e) => setTranslationAudioVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#7C4DFF]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};