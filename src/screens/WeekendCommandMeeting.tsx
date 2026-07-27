import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import type { AdvisorRecommendation } from '../types/phase18Types';
import type { WeekendRecommendationResolution } from '../types/weekendLeadershipTypes';

export function WeekendCommandMeeting({
  recommendations,
  onResolve,
  onContinue,
}: {
  recommendations: AdvisorRecommendation[];
  onResolve: (
    recommendation: AdvisorRecommendation,
    resolution: WeekendRecommendationResolution,
  ) => void;
  onContinue: () => void;
}) {
  const pending = recommendations.filter((recommendation) => recommendation.status === 'Pending').length;
  const conflicting = recommendations.some(
    (recommendation) =>
      recommendation.targetPhase === 'race-instructions'
      && recommendation.recommendedOptionId === 'ProtectCar',
  ) && recommendations.some(
    (recommendation) =>
      recommendation.targetPhase === 'race-strategy'
      && recommendation.recommendedOptionId === 'AggressiveTwoStop',
  );

  return (
    <Panel
      title="Weekend Command Meeting"
      actions={(
        <Button variant="primary" onClick={onContinue}>
          {pending > 0 ? `Continue with ${pending} pending →` : 'Continue to Track Briefing →'}
        </Button>
      )}
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className="text-sm text-neutral-300">
            Your senior staff have reduced the weekend to the decisions with the clearest evidence.
            Advice changes the working plan only when you accept or delegate it.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Modify keeps the issue open for your later decision. Decline keeps the current plan.
            Every trust effect is shown before you act.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-xs ${conflicting ? 'border-orange-500/30 bg-orange-500/5 text-orange-200' : 'border-neutral-800 bg-neutral-950/35 text-neutral-400'}`}>
          <div className="font-semibold uppercase tracking-wide">
            {conflicting ? 'Staff disagreement' : 'Council alignment'}
          </div>
          <div className="mt-1">
            {conflicting
              ? 'Strategy sees an attacking opportunity while Technical recommends protecting the car. Both positions remain visible.'
              : 'No direct conflict is present in the current recommendations.'}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {recommendations.map((recommendation) => {
          const resolved = recommendation.status !== 'Pending';
          return (
            <article
              key={recommendation.id}
              className={`rounded-lg border p-4 ${resolved ? 'border-neutral-800 bg-neutral-950/30' : 'border-amber-500/25 bg-amber-500/5'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    {recommendation.advisorName ?? recommendation.advisorRole}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-neutral-100">
                    {recommendation.recommendation}
                  </h3>
                </div>
                <span className="rounded bg-neutral-950/65 px-2 py-1 text-[10px] font-semibold text-neutral-300">
                  {recommendation.confidence}% confidence
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-neutral-400">{recommendation.rationale}</p>
              <div className="mt-3 space-y-1.5">
                {(recommendation.evidence ?? []).map((item) => (
                  <div key={item} className="rounded bg-neutral-950/45 px-2 py-1 text-[11px] text-neutral-400">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 text-[11px]">
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-emerald-200">
                  <span className="font-semibold">Expected benefit:</span> {recommendation.expectedBenefit}
                </div>
                <div className="rounded border border-orange-500/20 bg-orange-500/5 px-2 py-1.5 text-orange-200">
                  <span className="font-semibold">Risk:</span> {recommendation.risk}
                </div>
              </div>

              {resolved ? (
                <div className="mt-4 rounded border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
                  <div className="font-semibold">{recommendation.resolutionMode ?? recommendation.status}</div>
                  <div className="mt-1 text-neutral-500">{recommendation.resolutionNote}</div>
                  <div className={recommendation.trustChange && recommendation.trustChange < 0 ? 'mt-1 text-orange-300' : 'mt-1 text-emerald-300'}>
                    Department trust {signed(recommendation.trustChange ?? 0)}
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button onClick={() => onResolve(recommendation, 'Accepted')} className="px-2 py-1 text-[11px]">
                    Accept · trust +1
                  </Button>
                  <Button onClick={() => onResolve(recommendation, 'Delegated')} className="px-2 py-1 text-[11px]">
                    Delegate · trust +2
                  </Button>
                  <Button variant="ghost" onClick={() => onResolve(recommendation, 'Modified')} className="px-2 py-1 text-[11px]">
                    Modify {recommendation.confidence >= 85 ? '· trust -1' : '· no trust change'}
                  </Button>
                  <Button variant="ghost" onClick={() => onResolve(recommendation, 'Declined')} className="px-2 py-1 text-[11px]">
                    Decline · trust {recommendation.confidence >= 75 ? '-2' : '-1'}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}
