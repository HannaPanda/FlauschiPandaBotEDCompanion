import { EDState, SCOOPABLE_CLASSES } from './types';

export type ScoopWarningLevel = 'ok' | 'warning' | 'critical';

export interface ScoopStatus {
  level: ScoopWarningLevel;
  nextScoopableSystem: string | null;
  nearestScoopable: string | null;
  canReachNextScoop: boolean;
}

export function computeScoopStatus(state: EDState, threshold: number): ScoopStatus {
  const { fuelPercent, nextScoopableIn, estimatedFuelToNextScoop, route } = state;

  const nextScoopable = route.find((r) => r.scoopable);
  const nextScoopableSystem = nextScoopable?.system ?? null;

  const canReachNextScoop = estimatedFuelToNextScoop > 0;

  if (estimatedFuelToNextScoop < 0) {
    return {
      level: 'critical',
      nextScoopableSystem,
      nearestScoopable: nextScoopableSystem,
      canReachNextScoop: false,
    };
  }

  if (fuelPercent < threshold && nextScoopableIn >= 2) {
    return {
      level: 'warning',
      nextScoopableSystem,
      nearestScoopable: nextScoopableSystem,
      canReachNextScoop,
    };
  }

  return {
    level: 'ok',
    nextScoopableSystem,
    nearestScoopable: nextScoopableSystem,
    canReachNextScoop,
  };
}
