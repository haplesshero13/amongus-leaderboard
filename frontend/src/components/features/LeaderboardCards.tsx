import Link from 'next/link';
import posthog from 'posthog-js';
import { ModelRanking, getConservativeRating } from '../../types/leaderboard';
import { RankBadge } from '../ui/RankIndicator';
import { leaderboardColorClasses } from '../../lib/theme/amongUsPalette';

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
          <Link
            key={model.model_id}
            href={`/games?models=${model.model_id}`}
            onClick={() => {
              posthog.capture('model_card_clicked', {
                model_id: model.model_id,
                model_name: model.model_name,
                provider: model.provider,
                current_rank: model.current_rank,
                overall_rating: model.overall_rating,
                games_played: model.games_played,
              });
            }}
            className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
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
              <div className={`rounded-lg p-2 ${leaderboardColorClasses.overallCard}`}>
                <div className={`text-lg font-bold ${leaderboardColorClasses.overallValue}`}>
                  {getConservativeRating(model.overall_rating, model.overall_sigma)}
                </div>
                <div className={`text-xs ${leaderboardColorClasses.overallDetail}`}>
                  Avg: {model.overall_rating} ±{model.overall_sigma}
                </div>
              </div>
              <div className={`rounded-lg p-2 ${leaderboardColorClasses.impostorCard}`}>
                <div className={`text-lg font-bold ${leaderboardColorClasses.impostorValue}`}>
                  {getConservativeRating(model.impostor_rating, model.impostor_sigma)}
                </div>
                <div className={`text-xs ${leaderboardColorClasses.impostorDetail}`}>
                  Avg: {model.impostor_rating} ±{model.impostor_sigma}
                </div>
                <div className={`text-xs ${leaderboardColorClasses.impostorDetail}`}>
                  {model.impostor_wins}W-{model.impostor_games - model.impostor_wins}L
                </div>
              </div>
              <div className={`rounded-lg p-2 ${leaderboardColorClasses.crewmateCard}`}>
                <div className={`text-lg font-bold ${leaderboardColorClasses.crewmateValue}`}>
                  {getConservativeRating(model.crewmate_rating, model.crewmate_sigma)}
                </div>
                <div className={`text-xs ${leaderboardColorClasses.crewmateDetail}`}>
                  Avg: {model.crewmate_rating} ±{model.crewmate_sigma}
                </div>
                <div className={`text-xs ${leaderboardColorClasses.crewmateDetail}`}>
                  {model.crewmate_wins}W-{model.crewmate_games - model.crewmate_wins}L
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
