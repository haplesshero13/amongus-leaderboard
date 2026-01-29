'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RawAgentLog, GameSummary } from '../../types/game';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface UseGameStreamResult {
  logs: RawAgentLog[];
  summary: GameSummary | null;
  status: StreamStatus;
  error: string | null;
}

/**
 * Hook to stream live game logs via Server-Sent Events.
 *
 * @param gameId - The game ID to stream logs for
 * @param enabled - Whether to enable streaming (set to true when game is running)
 * @returns Object with logs array, summary, connection status, and error
 */
export function useGameStream(gameId: string, enabled: boolean): UseGameStreamResult {
  const [logs, setLogs] = useState<RawAgentLog[]>([]);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if we should reconnect
  const shouldReconnect = useRef(true);

  // Reset state when gameId changes
  useEffect(() => {
    setLogs([]);
    setSummary(null);
    setStatus('idle');
    setError(null);
  }, [gameId]);

  const connect = useCallback(() => {
    if (!API_BASE_URL || !enabled) {
      return null;
    }

    setStatus('connecting');
    setError(null);

    const eventSource = new EventSource(`${API_BASE_URL}/api/games/${gameId}/stream`);

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.addEventListener('log', (event) => {
      try {
        const logEntry = JSON.parse(event.data) as RawAgentLog;
        setLogs((prev) => [...prev, logEntry]);
      } catch (e) {
        console.error('Failed to parse log event:', e);
      }
    });

    eventSource.addEventListener('end', (event) => {
      try {
        const data = JSON.parse(event.data) as { summary: GameSummary | null };
        setSummary(data.summary);
        setStatus('ended');
      } catch (e) {
        console.error('Failed to parse end event:', e);
        setStatus('ended');
      }
      eventSource.close();
    });

    eventSource.onerror = (event) => {
      // EventSource will automatically try to reconnect on some errors
      // but we want to handle the case where the game is no longer streaming
      console.error('SSE error:', event);

      // Check if this is a connection close (game ended or not available)
      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus('error');
        setError('Connection closed');
        eventSource.close();
      }
    };

    return eventSource;
  }, [gameId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    shouldReconnect.current = true;
    const eventSource = connect();

    return () => {
      shouldReconnect.current = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [connect, enabled]);

  return { logs, summary, status, error };
}
