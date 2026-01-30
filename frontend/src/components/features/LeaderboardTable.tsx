import { useRouter } from 'next/navigation';
import { ModelRanking, getConservativeRating } from '../../types/leaderboard';
import { RankBadge } from '../ui/RankIndicator';

function WinRate({ rate, games }: { rate: number; games: number }) {
  if (games === 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span className={rate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}>
      {rate.toFixed(0)}%
    </span>
  );
}

interface LeaderboardTableProps {
  rankings: ModelRanking[];
}

export function LeaderboardTable({ rankings }: LeaderboardTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Model
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Rating
            </th>
            <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
              Impostor
            </th>
            <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
              Crewmate
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              W-L
            </th>
            <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
              Win%
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rankings.map((model) => {
            const totalWins = model.impostor_wins + model.crewmate_wins;
            const totalLosses = model.games_played - totalWins;
            
            return (
              <tr
                key={model.model_id}
                onClick={() => router.push(`/games?model=${model.model_id}`)}
                className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-4">
                  <RankBadge rank={model.current_rank} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white shadow-inner"
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
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {getConservativeRating(model.overall_rating, model.overall_sigma)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Avg: {model.overall_rating} ±{model.overall_sigma}
                    </span>
                  </div>
                </td>
                <td className="hidden px-4 py-4 text-center lg:table-cell">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {getConservativeRating(model.impostor_rating, model.impostor_sigma)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Avg: {model.impostor_rating} ±{model.impostor_sigma}
                    </span>
                    <span className="text-xs text-gray-400">
                      {model.impostor_wins}W-{model.impostor_games - model.impostor_wins}L
                    </span>
                  </div>
                </td>
                <td className="hidden px-4 py-4 text-center lg:table-cell">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {getConservativeRating(model.crewmate_rating, model.crewmate_sigma)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Avg: {model.crewmate_rating} ±{model.crewmate_sigma}
                    </span>
                    <span className="text-xs text-gray-400">
                      {model.crewmate_wins}W-{model.crewmate_games - model.crewmate_wins}L
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                    {totalWins}-{totalLosses}
                  </span>
                </td>
                <td className="hidden px-4 py-4 text-center md:table-cell">
                  <WinRate rate={model.win_rate} games={model.games_played} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
