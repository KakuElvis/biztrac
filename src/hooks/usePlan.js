import { useMemo } from "react";
import {
  isProBusiness,
  canAccessFeature,
  getFeatureLimit,
  getDaysRemaining,
  PLANS,
  PLAN_LIMITS,
} from "../lib/plans.js";

export function usePlan(business) {
  const isPro = useMemo(() => isProBusiness(business), [business]);
  const tier = isPro ? (business?.plan_tier || PLANS.PRO) : PLANS.FREE;
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS[PLANS.FREE];
  const daysRemaining = useMemo(() => getDaysRemaining(business), [business]);

  const canAccess = (featureKey) => canAccessFeature(business, featureKey);
  const getLimit = (limitKey) => getFeatureLimit(business, limitKey);

  return {
    isPro,
    tier,
    planLabel: isPro ? "Pro" : "Free",
    limits,
    daysRemaining,
    expiresAt: business?.plan_expires_at || null,
    canAccess,
    getLimit,
  };
}
