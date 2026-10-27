// Prints a Mermaid flowchart of a Hot Seat's decision map. Paste into any Mermaid viewer.
// Run: npm run treemap -- kodak
import { kodak } from "../src/content/hotseats/kodak.ts";
const all = { kodak };
const hs = all[process.argv[2] || "kodak"];
const g = { great: ":::great", ok: ":::ok", bad: ":::bad" };
const out = [
  "flowchart TD",
  "classDef great fill:#58cc02,color:#000",
  "classDef ok fill:#ffc800,color:#000",
  "classDef bad fill:#ff4b4b,color:#fff",
];
const esc = (s) => String(s).replace(/"/g, "'");
for (const n of Object.values(hs.nodes)) {
  if (n.type === "scene") out.push(`${n.id}["${n.year} · scene"] --> ${n.next}`);
  if (n.type === "decision") {
    out.push(`${n.id}{"${n.year}: ${esc(n.question)}"}`);
    for (const o of n.options) {
      const oid = `${n.id}_${o.id}`;
      out.push(`${n.id} --> ${oid}["${esc(o.label)}${o.real ? " ★real" : ""}"]${g[o.grade]}`);
      const nexts = typeof o.next === "string" ? [o.next] : o.next.map((r) => r.to);
      for (const x of nexts) out.push(`${oid} --> ${x}`);
    }
  }
  if (n.type === "route")
    for (const r of n.routes) out.push(`${n.id}{{"final Future meter"}} -->|${r.when ? "Future ≥ " + r.when.minFuture : "else"}| ${r.to}`);
  if (n.type === "ending") out.push(`${n.id}(["END: ${esc(n.title)}"])`);
}
out.push(`anyloss(["Board trust hits 0 at any point"]) --> fired`);
console.log(out.join("\n"));
