import { Game, GameLogsResponse } from '../../types/game';
import { runWithInFlightDedup } from './inFlightRequestCache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchGames(
  status?: string,
  limit: number = 20,
  modelId?: string,
  engineVersion?: number | null
): Promise<Game[]> {
  if (!API_BASE_URL) {
    return [];
  }

  const params = new URLSearchParams({ limit: limit.toString() });
  if (status) {
    params.set('status', status);
  }
  if (modelId) {
    params.set('model_id', modelId);
  }
  if (engineVersion != null) {
    params.set('engine_version', engineVersion.toString());
  }

  const url = `${API_BASE_URL}/api/games?${params}`;

  return runWithInFlightDedup(url, async () => {
    const response = await fetch(url, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.statusText}`);
    }

    return response.json();
  });
}

export async function fetchGame(gameId: string): Promise<Game> {
  if (!API_BASE_URL) {
    throw new Error('API URL not configured');
  }

  const response = await fetch(`${API_BASE_URL}/api/games/${gameId}`, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Game not found');
    }
    throw new Error(`Failed to fetch game: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchGameLogs(gameId: string): Promise<GameLogsResponse> {
  if (!API_BASE_URL) {
    throw new Error('API URL not configured');
  }

  const response = await fetch(`${API_BASE_URL}/api/games/${gameId}/logs`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Game logs not available');
    }
    throw new Error(`Failed to fetch game logs: ${response.statusText}`);
  }

  return response.json();
}
