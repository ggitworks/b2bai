import React from 'react';
import { Play } from 'lucide-react';
import clsx from 'clsx';
import { ScreenShare } from './components/ScreenShare';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { ControlPanel } from './components/ControlPanel';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { GoogleAIHighlights } from './components/GoogleAIHighlights';
import { SettingsPanel } from './components/SettingsPanel';
import { useStore } from './store';

function App() {
  const { transcriptions, isDiagnosticPanelVisible } = useStore();

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Section - Screen Share and AI Highlights */}
        <div className="h-[50vh] min-h-[400px] flex border-b border-[#2A2A2A]">
          {/* Screen Share */}
          <div className="flex-1 border-r border-[#2A2A2A]">
            <ScreenShare />
          </div>
          {/* Google AI Highlights */}
          <div className="w-96">
            <GoogleAIHighlights />
          </div>
        </div>
        {/* Bottom Section - Transcription Panel */}
        <div className="h-[50vh] flex">
          {/* Transcriptions */}
          <div className="flex-1 overflow-hidden">
          <TranscriptionPanel />
          </div>
        </div>
      </div>

      {/* Right Panel - Diagnostic Information */}
      <div className={clsx(
        "flex-shrink-0 transition-all duration-300",
        isDiagnosticPanelVisible ? "w-80" : "w-0"
      )}>
        <DiagnosticPanel />
      </div>

      {/* Floating Elements */}
      <ControlPanel />
      <SettingsPanel />
    </div>
  );
}

export default App;