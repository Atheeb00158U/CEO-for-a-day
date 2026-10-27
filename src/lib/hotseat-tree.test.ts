import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOTSEATS_DIR, readHotSeat } from "./content-files";
import { checkHotSeat } from "./hotseat-check";
import { walkTree, type TreeNode } from "./hotseat-tree";

const leaves = (n: TreeNode): TreeNode[] => (n.children.length ? n.children.flatMap(leaves) : [n]);

describe("walkTree", () => {
  const tree = walkTree(readHotSeat("kodak"));
  const stats = checkHotSeat(join(HOTSEATS_DIR, "kodak")).stats!;

  it("has one leaf per playthrough, with the same endings as hotseat:check", () => {
    expect(tree.leaves).toBe(stats.paths);
    const endings: Record<string, number> = {};
    for (const l of leaves(tree)) endings[l.ending!.id] = (endings[l.ending!.id] ?? 0) + 1;
    expect(endings).toEqual(stats.endings);
  });

  it("branches 3, 9, 27 deep and keeps the state before and after each call", () => {
    expect(tree.children).toHaveLength(3);
    expect(tree.children.flatMap((c) => c.children)).toHaveLength(9);
    const first = tree.children[0];
    expect(first.before).toBe(tree.state);
    expect(first.pick?.nodeId).toBe("d1");
    expect(first.key).toBe(`d1:${first.pick?.optionId}`);
  });

  it("ends the real Kodak path in collapse with a score of 9", () => {
    const real = leaves(tree).filter((l) => l.state.onRealPath);
    expect(real).toHaveLength(1);
    expect(real[0].ending?.id).toBe("collapse");
    expect(real[0].score).toBe(9);
  });
});
