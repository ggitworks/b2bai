import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { AlertCircle, MonitorUp } from 'lucide-react';

export const ScreenShare: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isSharing, startSharing, stopSharing, activeStream, sharingError } = useStore();

  useEffect(() => {
    if (isSharing && !activeStream) {
      const initializeSharing = async () => {
        try {
          const stream = await startSharing();
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Failed to start sharing:', error);
          stopSharing();
        }
      };

      initializeSharing();
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isSharing, startSharing, stopSharing, activeStream]);

  useEffect(() => {
    if (videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream;
    }
  }, [activeStream]);

  return (
    <div className="h-full bg-[#1A1A1A] flex items-center justify-center relative">
      {isSharing ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="text-center p-8 max-w-lg">
          {sharingError ? (
            <div className="space-y-6">
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Screen Share Error</span>
                </div>
                <p className="text-red-400">{sharingError}</p>
              </div>
              <button
                onClick={() => startSharing()}
                className="px-6 py-3 bg-[#7C4DFF] hover:bg-[#6B42E0] rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <MonitorUp className="w-5 h-5" />
                Try Again
              </button>
            </div>
          ) : (
            <>
              <p className="text-xl mb-4">No tab being shared</p>
              <p className="text-gray-400">Click the share button in the control panel to start sharing a browser tab or window</p>
              <div className="mt-6 text-sm text-gray-500 space-y-4">
                <p>Important:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Enable "Share system audio" when selecting your tab/window</li>
                  <li>Select the specific tab or window that's playing audio</li>
                  <li>Your device's microphone and speakers can be muted</li>
                  <li>Only the shared tab/window audio will be transcribed</li>
                </ul>
                <div className="pt-4">
                  <button
                    onClick={() => startSharing()}
                    className="px-6 py-3 bg-[#7C4DFF] hover:bg-[#6B42E0] rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <MonitorUp className="w-5 h-5" />
                    Start Sharing
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};