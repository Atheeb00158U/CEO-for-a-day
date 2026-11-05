/**
 * A word cloud of the named ideas on the course map (docs/CURRICULUM.md, the Concept column). Bright brass ones are
 * taught in lessons that are open now; faded ones are planned. Size is how well known the name is, not how much it
 * is taught. The order is set by hand so big and small words mix on every row. On a phone the smallest planned
 * words are left out so the cloud stays short.
 */
type Idea = [name: string, size: 1 | 2 | 3 | 4, open?: true];

const IDEAS: Idea[] = [
  ["Opportunity cost", 3, true],
  ["Decoy effect", 2],
  ["BATNA", 3],
  ["Cash runway", 2, true],
  ["Social proof", 3],
  ["Mirroring", 4],
  ["Loss aversion", 1],
  ["The Mom Test", 3, true],
  ["Framing", 4],
  ["Blue ocean strategy", 2],
  ["Unit economics", 3, true],
  ["Reciprocity", 4],
  ["Scarcity", 3],
  ["Sunk cost fallacy", 1, true],
  ["Game theory", 3],
  ["Winner's curse", 4],
  ["Beachhead market", 2, true],
  ["Endowment effect", 4],
  ["Porter's five forces", 3],
  ["Switching costs", 4],
  ["Anchoring", 1],
  ["Value-based pricing", 3, true],
  ["Streisand effect", 4],
  ["Outcome bias", 2, true],
  ["Status quo bias", 4],
  ["Customer lifetime value", 3],
  ["Disruptive innovation", 2],
  ["Selection bias", 4, true],
  ["Loss leader", 3, true],
  ["Network effects", 1],
  ["Tactical empathy", 4],
  ["Operating leverage", 3, true],
  ["Economies of scale", 4],
  ["Jobs to be done", 2, true],
  ["Escalation of commitment", 4],
  ["Pricing power", 3],
  ["Cash conversion cycle", 3, true],
  ["Foot-in-the-door", 4],
  ["Innovator's dilemma", 2],
  ["Sachet pricing", 4, true],
  ["Counter-positioning", 4],
  ["Price fairness", 3, true],
  ["Growth loops", 4],
  ["Marketing myopia", 4],
  ["Premature scaling", 3],
  ["Total cost of ownership", 4, true],
  ["Fighter brand", 4],
  ["Contribution margin", 4, true],
  ["Reactance", 4],
  ["Service recovery paradox", 4],
  ["Co-opetition", 4],
];

const SIZE = {
  1: "font-display text-[32px] leading-[1.05] md:text-[64px]",
  2: "font-display text-[22px] leading-[1.1] md:text-[42px]",
  3: "font-display text-[17px] leading-[1.2] md:text-[28px]",
  4: "text-[14px] font-semibold leading-[1.3] md:text-[19px]",
};

export function IdeaCloud() {
  return (
    <ul className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center md:gap-x-7 md:gap-y-3">
      {IDEAS.map(([name, size, open]) => (
        <li
          key={name}
          className={`${SIZE[size]} ${open ? "text-[var(--brass)]" : size < 3 ? "text-ink/55" : "text-ink/40"} ${!open && size === 4 ? "hidden md:list-item" : ""}`}
        >
          {name}
          {open && <span className="sr-only"> (open now)</span>}
        </li>
      ))}
    </ul>
  );
}
