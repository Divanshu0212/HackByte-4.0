/**
 * Component registry (Section 2.2) — semantic identifiers → React modules.
 * Root routing lives in EventBoard; this map documents the generative UI contract.
 */
import { NumericLeaderboard } from '../components/NumericLeaderboard';
import { FundraisingProgressBar } from '../components/FundraisingProgressBar';
import { QualifyingGrid } from '../components/QualifyingGrid';
import { TeamCard } from '../components/TeamCard';
import { RoundTimer } from '../components/RoundTimer';

export const ComponentRegistry = {
  numeric_list: NumericLeaderboard,
  goal_based: FundraisingProgressBar,
  pass_fail: QualifyingGrid,
  team_card: TeamCard,
  timer_widget: RoundTimer,
};

export type RegistryKey = keyof typeof ComponentRegistry;
