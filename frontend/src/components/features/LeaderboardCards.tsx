import { ModelRanking } from '../../types/leaderboard';
import { RankBadge } from '../ui/RankIndicator';

interface LeaderboardCardsProps {
  rankings: ModelRanking[];
}

export function LeaderboardCards({ rankings }: LeaderboardCardsProps) {
  return (
    <div className="space-y-3">
      {rankings.map((model) => {
        const totalWins = model.impostor_wins + model.crewmate_wins;
        const totalLosses = model.games_played - totalWins;
        
        return (
          <div
            key={model.model_id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <RankBadge rank={model.current_rank} />
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white shadow-inner"
                  style={{ backgroundColor: model.avatar_color }}
                >
                  {model.model_name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {model.model_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {model.provider}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                  {totalWins}-{totalLosses}
                </div>
                <div className={`text-sm ${model.win_rate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                  {model.games_played > 0 ? `${model.win_rate.toFixed(0)}% win` : 'No games'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {model.overall_rating}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Rating</div>
              </div>
              <div className="rounded-lg bg-red-50 p-2 dark:bg-red-900/20">
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {model.impostor_rating}
                </div>
                <div className="text-xs text-red-600/70 dark:text-red-400/70">
                  {model.impostor_wins}W-{model.impostor_games - model.impostor_wins}L
                </div>
              </div>
              <div className="rounded-lg bg-cyan-50 p-2 dark:bg-cyan-900/20">
                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {model.crewmate_rating}
                </div>
                <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70">
                  {model.crewmate_wins}W-{model.crewmate_games - model.crewmate_wins}L
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
