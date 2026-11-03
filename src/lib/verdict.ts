// The verdict sheet's words and colours, shared by the game (Player.tsx) and the website's sample decision.
export const VERDICT = {
  great: { title: "Great call!", color: "var(--color-green)", bg: "bg-[#0f2a10]", btn: "green", points: "+25 CEO points" },
  ok: { title: "Risky call", color: "var(--color-gold)", bg: "bg-[#2a2306]", btn: "gold", points: "+10 CEO points" },
  bad: { title: "Costly call", color: "var(--color-red)", bg: "bg-[#2d0f0f]", btn: "red", points: "−1 board trust" },
} as const;
