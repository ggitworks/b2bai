import React from 'react';
import { useStore } from '../store';
import { Sparkles, Brain } from 'lucide-react';

export const GoogleAIHighlights: React.FC = () => {
  const { transcriptionGroups } = useStore();

  return (
    <div className="h-full bg-[#1A1A1A] p-4 overflow-y-auto">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-[#7C4DFF]" />
        Google AI Highlights
      </h3>

      {transcriptionGroups.length > 0 ? (
        <div className="space-y-4">
          {[...transcriptionGroups].reverse().map((group) => (
            <div
              key={group.id}
              className="p-3 rounded bg-[#2A2A2A] border border-[#3A3A3A] transition-all hover:border-[#7C4DFF]"
            >
              {group.summary ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#7C4DFF]" />
                    <span className="text-[#7C4DFF] text-sm font-medium">Key Point</span>
                  </div>
                  <p className="text-white text-sm">{group.summary}</p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-yellow-500">
                  <div className="w-4 h-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                  <span className="text-sm">Analyzing content...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 mt-8">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#7C4DFF] opacity-50" />
          <p>AI highlights will appear here as content is transcribed</p>
        </div>
      )}
    </div>
  );
};