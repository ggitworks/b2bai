import React from 'react';
import { Wifi } from 'lucide-react';
import { useStore } from '../store';
import clsx from 'clsx';

export const StatusBar: React.FC = () => {
  const { isConnected } = useStore();

  return (
    <div className="fixed top-4 right-4 flex items-center gap-4 bg-[#1A1A1A] p-2 rounded-lg">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="w-5 h-5 text-green-500" />
        ) : (
          <Wifi className="w-5 h-5 text-red-500" />
        )}
        <span
          className={clsx(
            'text-sm',
            isConnected ? 'text-green-500' : 'text-red-500'
          )}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
};