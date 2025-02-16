import React from 'react';
import { useStore } from '../store';
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Sparkles, ChevronRight, ChevronLeft, Wifi } from 'lucide-react';
import clsx from 'clsx';

export const DiagnosticPanel: React.FC = () => {
  const { 
    isSharing, 
    isRecording, 
    isConnected,
    activeStream, 
    audioLevel, 
    errorLogs, 
    transcriptions, 
    transcriptionGroups,
    isDiagnosticPanelVisible,
    toggleDiagnosticPanel
  } = useStore();

  const getAudioTracks = () => activeStream?.getAudioTracks() || [];
  const getVideoTracks = () => activeStream?.getVideoTracks() || [];

  const getAudioStatus = () => {
    if (!isSharing) return { status: 'No screen share active', color: 'text-gray-400' };
    if (!isRecording) return { status: 'Recording not started', color: 'text-yellow-500' };
    if (getAudioTracks().length === 0) return { status: 'No system audio detected', color: 'text-red-500' };
    if (audioLevel > 1) return { status: 'System audio detected', color: 'text-green-500' };
    return { status: 'Waiting for system audio...', color: 'text-yellow-500' };
  };

  const audioStatus = getAudioStatus();

  return (
    <div className="relative flex h-screen">
      {/* Toggle Button */}
      <button
        onClick={toggleDiagnosticPanel}
        className="absolute -left-8 top-4 p-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-l-md transition-colors"
        title={isDiagnosticPanelVisible ? "Hide diagnostic panel" : "Show diagnostic panel"}
      >
        {isDiagnosticPanelVisible ? (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Main Panel */}
      <div className={clsx(
        "h-screen overflow-y-auto bg-[#1A1A1A] p-4 border-l border-[#2A2A2A] transition-all duration-300",
        isDiagnosticPanelVisible ? "w-80" : "w-0 opacity-0 overflow-hidden"
      )}>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Diagnostic Information
        </h3>
      
        <div className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Connection:</span>
          <div className="flex items-center gap-2">
            <Wifi className={clsx("w-4 h-4", isConnected ? "text-green-500" : "text-red-500")} />
            <span className={isConnected ? "text-green-500" : "text-red-500"}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Screen Share Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Screen Share:</span>
          <div className="flex items-center gap-2">
            {isSharing ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={isSharing ? "text-green-500" : "text-red-500"}>
              {isSharing ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Recording Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Recording:</span>
          <div className="flex items-center gap-2">
            {isRecording ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={isRecording ? "text-green-500" : "text-red-500"}>
              {isRecording ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Stream Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Video Tracks:</span>
            <span className="text-white">{getVideoTracks().length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Real Audio Tracks:</span>
            <span className="text-white">{getAudioTracks().length}</span>
          </div>
          {getAudioTracks().map((track, index) => (
            <div key={index} className="text-xs text-gray-400 pl-4">
              • {track.label || 'Real Audio'} ({track.enabled ? 'enabled' : 'disabled'})
            </div>
          ))}
        </div>

        {/* Audio Status */}
        <div className="p-3 rounded bg-[#2A2A2A] border border-[#3A3A3A]">
          <div className={`text-sm ${audioStatus.color} flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {audioStatus.status}
          </div>
        </div>

        {/* Audio Level */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Real Audio Level:</span>
            <span className="text-white">{Math.round(audioLevel)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        </div>

        {/* Error Logs */}
        {errorLogs.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Error Logs
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {errorLogs.slice().reverse().map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded text-sm ${
                    log.type === 'error'
                      ? 'bg-red-900/20 border border-red-500/50'
                      : 'bg-yellow-900/20 border border-yellow-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {log.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="text-gray-300 text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={`${
                    log.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {log.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript Groups */}
        {transcriptionGroups.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Summarized Groups
            </h4>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {[...transcriptionGroups].reverse().map((group) => (
                <div
                  key={group.id}
                  className="p-3 rounded bg-[#2A2A2A] border border-[#3A3A3A]"
                >
                  {group.summary ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-purple-400 text-sm font-medium">Summary</span>
                      </div>
                      <p className="text-white mb-4">{group.summary}</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-500 mb-3">
                      <div className="w-4 h-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                      <span className="text-sm">Generating summary...</span>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t border-[#3A3A3A]">
                    <div className="text-xs text-gray-400 mb-2">
                      Original Transcripts
                    </div>
                    <div className="space-y-2">
                      {group.transcriptions.map((transcript) => (
                        <div key={transcript.id} className="text-sm">
                          <p className="text-gray-300">{transcript.text}</p>
                          <time className="text-xs text-gray-500">
                            {new Date(transcript.timestamp).toLocaleTimeString()}
                          </time>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};