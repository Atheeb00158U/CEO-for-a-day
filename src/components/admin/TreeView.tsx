"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/shadcn/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { Icon } from "@/components/icons";
import { findOption, resolveText } from "@/lib/engine";
import type { HotSeat } from "@/lib/hotseat-types";
import { walkTree, type TreeNode } from "@/lib/hotseat-tree";
import { EndingsBar } from "./EndingsBar";
import { GRADE_COLOR, GRADE_LABEL, TIER_COLOR, TIER_LABEL } from "./tiers";

const COL_W = 250;
const PILL_W = 214;
const PILL_H = 36;
const ROW_H = 46;
const TOP = 44; // room for the column headers

type Focus = "all" | "real" | "legend" | "survivor" | "collapse" | "fired";
interface Placed {
  node: TreeNode;
  x: number;
  y: number;
  parent?: Placed;
  folded: boolean;
}

/** A tidy tree on a fixed column grid: leaves take one row each, a parent sits halfway between its first and last child. */
function layout(root: TreeNode, folded: Set<string>): { placed: Placed[]; rows: number } {
  const placed: Placed[] = [];
  let row = 0;
  const place = (node: TreeNode, parent?: Placed): Placed => {
    const p: Placed = { node, x: node.depth * COL_W, y: 0, parent, folded: node.children.length > 0 && folded.has(node.key) };
    placed.push(p);
    const kids = p.folded ? [] : node.children.map((c) => place(c, p));
    p.y = TOP + (kids.length ? (kids[0].y + kids[kids.length - 1].y) / 2 - TOP : row++ * ROW_H);
    return p;
  };
  place(root);
  return { placed, rows: row };
}

const keysAtDepth = (n: TreeNode, d: number): string[] => (n.depth === d ? [n.key] : n.children.flatMap((c) => keysAtDepth(c, d)));

export function TreeView({ hs }: { hs: HotSeat }) {
  const tree = useMemo(() => walkTree(hs), [hs]);
  const calls = useMemo(() => {
    const deepest = (n: TreeNode): number => Math.max(n.depth, ...n.children.map(deepest));
    return deepest(tree);
  }, [tree]);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [depthTab, setDepthTab] = useState("all");
  const [focus, setFocus] = useState<Focus>("all");
  const [selected, setSelected] = useState<TreeNode | null>(null);

  const { placed, rows } = useMemo(() => layout(tree, folded), [tree, folded]);
  const endX = (calls + 1) * COL_W;
  const width = endX + 170;
  const height = TOP + rows * ROW_H;

  const endings = useMemo(() => {
    const out: Record<string, number> = {};
    const walk = (n: TreeNode) => (n.ending ? (out[n.ending.tier] = (out[n.ending.tier] ?? 0) + 1) : n.children.forEach(walk));
    walk(tree);
    return out;
  }, [tree]);
  const scores = useMemo(() => {
    const all: number[] = [];
    const walk = (n: TreeNode) => (n.score !== undefined ? all.push(n.score) : n.children.forEach(walk));
    walk(tree);
    return [Math.min(...all), Math.max(...all)];
  }, [tree]);

  // Column headers: the decision faced at each depth (the first one found, if paths differ).
  const headers = useMemo(() => {
    const h: string[] = ["Start"];
    for (let d = 0; d < calls; d++) {
      const find = (n: TreeNode): TreeNode | undefined => (n.depth === d && n.next ? n : n.children.map(find).find(Boolean));
      const next = find(tree)?.next;
      h.push(next ? `${next.year} · ${next.title}` : `Call ${d + 1}`);
    }
    return h;
  }, [tree, calls]);

  const isDim = (n: TreeNode) => {
    if (n.depth === 0 || focus === "all") return false;
    if (focus === "real") return !n.state.onRealPath;
    return !n.tiers.has(focus);
  };

  const foldToDepth = (value: string) => {
    setDepthTab(value);
    setFolded(new Set(value === "all" ? [] : keysAtDepth(tree, Number(value))));
  };
  const toggle = (key: string) =>
    setFolded((f) => {
      const next = new Set(f);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[560px]">
          <p className="text-[12px] font-black tracking-[.12em] text-brand uppercase">
            {hs.company} · {hs.years}
            {hs.draft && " · draft"}
          </p>
          <h1 className="text-[28px] leading-tight font-black">{hs.title}</h1>
          <p className="mt-1 font-bold text-muted">
            {tree.leaves} playthroughs · up to {calls} calls · CEO score {scores.join("–")}
          </p>
          <div className="mt-3">
            <EndingsBar endings={endings} total={tree.leaves} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Tabs value={depthTab} onValueChange={foldToDepth}>
            <TabsList aria-label="How deep to open the tree">
              <TabsTrigger value="all">Open all</TabsTrigger>
              {Array.from({ length: calls - 1 }, (_, i) => (
                <TabsTrigger key={i} value={String(i + 1)}>
                  {i + 1} {i === 0 ? "call" : "calls"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={focus} onValueChange={(v) => setFocus(v as Focus)}>
            <TabsList aria-label="Highlight">
              <TabsTrigger value="all">Everything</TabsTrigger>
              <TabsTrigger value="real">★ Real path</TabsTrigger>
              {(["legend", "survivor", "collapse", "fired"] as const).map((t) => (
                <TabsTrigger key={t} value={t}>
                  <span className="size-2 rounded-full" style={{ background: TIER_COLOR[t] }} />
                  {TIER_LABEL[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border-2 border-line bg-surface/40">
        <div className="relative" style={{ width, height: height + 16 }}>
          {/* Column headers */}
          {headers.map((h, i) => (
            <p
              key={i}
              className="absolute top-3 truncate text-[11px] font-black tracking-wider text-muted uppercase"
              style={{ left: 12 + i * COL_W, width: PILL_W }}
            >
              {h}
            </p>
          ))}
          <p className="absolute top-3 text-[11px] font-black tracking-wider text-muted uppercase" style={{ left: 12 + endX }}>
            Ending
          </p>

          {/* Edges */}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height + 16} aria-hidden="true">
            {placed.map(({ node, x, y, parent }) => {
              const paths = [];
              if (parent) {
                const x1 = 12 + parent.x + PILL_W;
                const y1 = parent.y + PILL_H / 2;
                const x2 = 12 + x;
                const y2 = y + PILL_H / 2;
                const mx = (x1 + x2) / 2;
                const real = node.state.onRealPath;
                paths.push(
                  <path
                    key={node.key}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={real ? "var(--color-gold)" : GRADE_COLOR[node.pick!.grade]}
                    strokeWidth={real ? 3 : 1.5}
                    opacity={isDim(node) ? 0.1 : real ? 1 : 0.55}
                  />,
                );
              }
              if (node.ending)
                paths.push(
                  <line
                    key={node.key + ">end"}
                    x1={12 + x + PILL_W}
                    y1={y + PILL_H / 2}
                    x2={12 + endX}
                    y2={y + PILL_H / 2}
                    stroke={TIER_COLOR[node.ending.tier]}
                    strokeDasharray="3 5"
                    opacity={isDim(node) ? 0.1 : 0.6}
                  />,
                );
              return paths;
            })}
          </svg>

          {/* Nodes */}
          {placed.map(({ node, x, y, folded: isFolded }) => {
            const faded = isDim(node);
            const option = node.pick ? findOption(hs, node.pick).option : undefined;
            const label = option ? option.label : `Start · ${hs.years}`;
            return (
              <div key={node.key || "start"} className={faded ? "opacity-25" : undefined}>
                <div className="absolute flex" style={{ left: 12 + x, top: y, width: PILL_W, height: PILL_H }}>
                  <button
                    type="button"
                    onClick={() => setSelected(node)}
                    aria-label={`${label}${option ? `, ${GRADE_LABEL[option.grade]}` : ""}${option?.real ? ", what the real company did" : ""}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 bg-bg px-3 text-left text-[13px] font-extrabold transition-transform hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-brand/50 focus-visible:outline-none"
                    style={{
                      borderColor: option ? GRADE_COLOR[option.grade] : "var(--color-brand)",
                      boxShadow: node.depth > 0 && node.state.onRealPath ? "0 0 0 2px var(--color-gold)" : undefined,
                    }}
                  >
                    {option?.real && <span className="text-gold">★</span>}
                    <span className="truncate">{label}</span>
                  </button>
                  {node.children.length > 0 && node.depth > 0 && (
                    <button
                      type="button"
                      onClick={() => toggle(node.key)}
                      aria-label={isFolded ? `Open ${node.leaves} paths` : "Fold this branch"}
                      className="ml-1 grid min-w-8 place-items-center rounded-full bg-surface-2 px-1.5 text-[11px] font-black text-muted hover:text-ink"
                    >
                      {isFolded ? `+${node.leaves}` : "–"}
                    </button>
                  )}
                </div>
                {node.ending && (
                  <button
                    type="button"
                    onClick={() => setSelected(node)}
                    className="absolute flex items-center gap-2 rounded-lg px-2.5 text-[12px] font-black whitespace-nowrap"
                    style={{
                      left: 12 + endX,
                      top: y + 4,
                      height: PILL_H - 8,
                      background: `color-mix(in srgb, ${TIER_COLOR[node.ending.tier]} 18%, transparent)`,
                      color: TIER_COLOR[node.ending.tier],
                    }}
                  >
                    {TIER_LABEL[node.ending.tier]} · {node.score}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] font-bold text-muted">
        Border colour: <span style={{ color: GRADE_COLOR.great }}>great</span> · <span style={{ color: GRADE_COLOR.ok }}>risky</span> ·{" "}
        <span style={{ color: GRADE_COLOR.bad }}>costly</span>. <span className="text-gold">★ Gold</span> is what the real company did.
        Click any call to read that path.
      </p>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-line bg-surface sm:max-w-[520px]">
          {selected && <Detail hs={hs} node={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ hs, node }: { hs: HotSeat; node: TreeNode }) {
  if (!node.pick) {
    return (
      <SheetHeader>
        <SheetTitle className="text-[22px] font-black">{hs.title}</SheetTitle>
        <SheetDescription className="font-bold">{hs.role}</SheetDescription>
        <p className="mt-4 text-[15px] leading-snug font-bold">{hs.realHistory}</p>
        <ul className="mt-3 flex flex-col gap-1 text-[13px] font-bold text-muted">
          {hs.sources.map((s) => (
            <li key={s.url}>
              <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </SheetHeader>
    );
  }

  const { node: decision, option } = findOption(hs, node.pick);
  const before = node.before!;
  const realOption = decision.options.find((o) => o.real);
  const delta = (k: "profit" | "future") => node.state.meters[k] - before.meters[k];

  return (
    <div className="flex flex-col gap-5 p-4">
      <SheetHeader className="p-0">
        <SheetDescription className="text-[12px] font-black tracking-[.12em] text-brand uppercase">
          Call {node.depth} · {decision.year} · {decision.title}
        </SheetDescription>
        <SheetTitle className="text-[22px] leading-tight font-black">{decision.question}</SheetTitle>
      </SheetHeader>

      <Section label="Setup on this path">{resolveText(decision.setup, before)}</Section>
      <Section label="Advisor">{resolveText(decision.advisor, before)}</Section>

      <div className="rounded-2xl border-2 p-3" style={{ borderColor: GRADE_COLOR[option.grade] }}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge style={{ background: GRADE_COLOR[option.grade], color: "#0b1015" }}>{GRADE_LABEL[option.grade]}</Badge>
          {option.real ? (
            <Badge className="bg-gold text-[#0b1015]">★ Real history</Badge>
          ) : (
            <Badge variant="outline">Alternate history (estimate)</Badge>
          )}
        </div>
        <p className="mt-2 text-[17px] font-black">{option.label}</p>
        {!option.real && realOption && <p className="mt-1 text-[13px] font-bold text-muted">Real company: {realOption.label}</p>}
      </div>

      <Section label="What happened">{resolveText(option.outcome, node.state)}</Section>
      <Section label="Why">{option.why}</Section>
      {option.better && <Section label="What would have worked">{option.better}</Section>}

      <div className="grid grid-cols-3 gap-2 text-center">
        {(["profit", "future"] as const).map((k) => (
          <div key={k} className="rounded-lg bg-surface-2 p-2">
            <p className="text-[11px] font-black tracking-wider text-muted uppercase">{hs.meters[k].label}</p>
            <p className="text-[18px] font-black tabular-nums">
              {node.state.meters[k]}{" "}
              <span className="text-[12px]" style={{ color: delta(k) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                {delta(k) >= 0 ? "+" : ""}
                {delta(k)}
              </span>
            </p>
          </div>
        ))}
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-[11px] font-black tracking-wider text-muted uppercase">Board trust</p>
          <p className="flex justify-center gap-0.5 pt-1">
            {Array.from({ length: hs.startTrust }, (_, i) =>
              i < node.state.trust ? <Icon.heart key={i} className="size-5" /> : <Icon.heartOff key={i} className="size-5" />,
            )}
          </p>
        </div>
      </div>

      {node.ending && (
        <div className="rounded-2xl p-3" style={{ background: `color-mix(in srgb, ${TIER_COLOR[node.ending.tier]} 15%, transparent)` }}>
          <p className="text-[12px] font-black tracking-wider uppercase" style={{ color: TIER_COLOR[node.ending.tier] }}>
            Ending · {TIER_LABEL[node.ending.tier]} · CEO score {node.score}
          </p>
          <p className="mt-1 text-[17px] font-black">{node.ending.title}</p>
          <p className="mt-1 text-[15px] leading-snug font-bold">{resolveText(node.ending.text, node.state)}</p>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-black tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-1 text-[15px] leading-snug font-bold">{children}</p>
    </div>
  );
}
