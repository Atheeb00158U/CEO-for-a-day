export const TIER_COLOR: Record<string, string> = {
  legend: "var(--color-gold)",
  survivor: "var(--color-blue)",
  collapse: "var(--color-red)",
  fired: "var(--color-purple)",
};
export const TIER_LABEL: Record<string, string> = { legend: "Legend", survivor: "Survivor", collapse: "Collapse", fired: "Fired" };
export const GRADE_COLOR = { great: "var(--color-green)", ok: "var(--color-gold)", bad: "var(--color-red)" } as const;
export const GRADE_LABEL = { great: "Great call", ok: "Risky call", bad: "Costly call" } as const;
