// Every playthrough of a Hot Seat as a tree: one level per call, endings at the leaves. Pure: no Next or Node imports,
// so /admin can build it in the browser and Phase 3's server-side replay can reuse it.
import { choose, debriefKey, resolveNode, score, startRun, type Choice, type RunState } from "./engine";
import type { DecisionNode, EndingNode, HotSeat } from "./hotseat-types";

export interface TreeNode {
  /** debriefKey of the calls so far ("" for the start). */
  key: string;
  /** Calls made to reach this node. */
  depth: number;
  /** The call that led here, and the state just before it (used to resolve the setup and advisor text). */
  pick?: Choice;
  before?: RunState;
  /** State after the call. */
  state: RunState;
  /** The decision faced next, if the story goes on. */
  next?: DecisionNode;
  ending?: EndingNode;
  score?: number;
  children: TreeNode[];
  /** Playthroughs below this node, and which ending tiers they reach. */
  leaves: number;
  tiers: Set<EndingNode["tier"]>;
}

export function walkTree(hs: HotSeat): TreeNode {
  const build = (state: RunState, depth: number, pick?: Choice, before?: RunState): TreeNode => {
    let node = resolveNode(hs, state, state.nodeId);
    while (node.type === "scene") {
      state = { ...state, nodeId: node.next };
      node = resolveNode(hs, state, node.next);
    }
    const key = debriefKey(state.picks);
    const base = { key, depth, pick, before, state };
    if (node.type === "ending")
      return { ...base, ending: node, score: score(hs, state, node), children: [], leaves: 1, tiers: new Set([node.tier]) };
    if (node.type !== "decision") throw new Error(`${hs.id}: route ${node.id} did not resolve`);
    const decision = node;
    const children = decision.options.map((o) => {
      const after = choose(hs, state, decision, o);
      return build(after, depth + 1, after.picks[after.picks.length - 1], state);
    });
    return {
      ...base,
      next: decision,
      children,
      leaves: children.reduce((n, c) => n + c.leaves, 0),
      tiers: new Set(children.flatMap((c) => [...c.tiers])),
    };
  };
  return build(startRun(hs), 0);
}
