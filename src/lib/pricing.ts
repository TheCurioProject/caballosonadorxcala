type PricingRule = {
  id: number;
  date: Date;
  priceOverride: number;
  propertyId: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Expands a list of PricingRules so that past prices for a specific month/day
 * are inherited by future years, up to `yearsAhead` from the current year.
 * If a future year has an explicit price, it overrides the inherited one.
 */
export function expandRecurringPricing(rules: PricingRule[], yearsAhead = 2): PricingRule[] {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + yearsAhead;

  // Group rules by month-day (e.g. "08-15")
  const rulesByDay: Record<string, PricingRule[]> = {};

  for (const rule of rules) {
    // Important: Use UTC to extract the true assigned month/day regardless of timezone offset
    // since dates are stored at 00:00:00 UTC
    const d = new Date(rule.date);
    const monthDay = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    if (!rulesByDay[monthDay]) {
      rulesByDay[monthDay] = [];
    }
    rulesByDay[monthDay].push(rule);
  }

  const expandedRules: PricingRule[] = [];
  let virtualIdCounter = -1;

  for (const [monthDay, dayRules] of Object.entries(rulesByDay)) {
    // Sort descending by year
    dayRules.sort((a, b) => new Date(b.date).getUTCFullYear() - new Date(a.date).getUTCFullYear());

    // For each year from currentYear up to maxYear
    for (let year = currentYear; year <= maxYear; year++) {
      // Find the most recent rule for this year or earlier
      const applicableRule = dayRules.find(r => new Date(r.date).getUTCFullYear() <= year);

      if (applicableRule) {
        const ruleYear = new Date(applicableRule.date).getUTCFullYear();
        
        if (ruleYear === year) {
          // Explicit rule for this year
          expandedRules.push(applicableRule);
        } else {
          // Inherited rule from a past year (create virtual rule)
          const [monthStr, dayStr] = monthDay.split('-');
          // Create UTC date matching the inherited month/day for this specific year
          const virtualDate = new Date(Date.UTC(year, parseInt(monthStr) - 1, parseInt(dayStr), 0, 0, 0, 0));
          
          if (virtualDate.getUTCMonth() !== parseInt(monthStr) - 1 || virtualDate.getUTCDate() !== parseInt(dayStr)) continue;
          expandedRules.push({
            ...applicableRule,
            id: virtualIdCounter--,
            date: virtualDate,
          });
        }
      }
    }
  }

  return expandedRules;
}
