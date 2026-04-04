import { ComponentRegistry } from '../registry/componentRegistry';
import type { LiveState } from '../types';

const NumericLeaderboard = ComponentRegistry.numeric_list;
const FundraisingProgressBar = ComponentRegistry.goal_based;
const QualifyingGrid = ComponentRegistry.pass_fail;
const RoundTimer = ComponentRegistry.timer_widget;

/**
 * Component registry routing (Section 2.2) — layout swaps by scoring_mode.
 */
type Props = {
  state: LiveState;
  onLayoutRootComplete?: () => void;
};

export function EventBoard({ state, onLayoutRootComplete }: Props) {
  const goalTarget = state.goal_target ?? 1;
  const currentTotal = state.participants.reduce((s, p) => s + p.score, 0);

  return (
    <div className="event-board">
      {state.timer.state !== 'idle' && <RoundTimer timer={state.timer} />}

      {state.scoring_mode === 'numeric' && (
        <NumericLeaderboard
          participants={state.participants}
          onLayoutRootComplete={onLayoutRootComplete}
        />
      )}

      {state.scoring_mode === 'goal_based' && (
        <>
          <FundraisingProgressBar
            currentTotal={currentTotal}
            target={goalTarget}
            label={state.goal_label}
          />
          <NumericLeaderboard
            participants={state.participants}
            onLayoutRootComplete={onLayoutRootComplete}
          />
        </>
      )}

      {state.scoring_mode === 'pass_fail' && (
        <QualifyingGrid participants={state.participants} />
      )}
    </div>
  );
}
