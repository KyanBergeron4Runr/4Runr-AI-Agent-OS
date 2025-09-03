'use client';

import { useState } from 'react';
import { startAgent } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface StartStopButtonsProps {
  agentId: string;
  isRunning: boolean;
}

export function StartStopButtons({ agentId, isRunning }: StartStopButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await startAgent(agentId);
      // Navigate to logs with the run ID
      if (response && (response as any).runId) {
        router.push(`/agents/${agentId}/logs?runId=${(response as any).runId}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
      alert('Failed to start agent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleStart} 
        disabled={isLoading || isRunning} 
        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Starting...' : 'Run now'}
      </button>
      <button 
        disabled={!isRunning} 
        className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Stop
      </button>
    </div>
  );
}
