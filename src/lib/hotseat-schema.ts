// Zod schema for Hot Seat JSON. It mirrors hotseat-types.ts; the Eq check at the bottom fails the build if they drift.
// Loaded by Node in the hotseat CLI, so: type-only imports and no path aliases.
import { z } from "zod";
import type { DailyPool, HotSeat } from "./hotseat-types";

const Media = z.union([z.templateLiteral(["img:", z.string()]), z.templateLiteral(["vid:", z.string()])]);

const When = z.strictObject({
  flags: z.array(z.string()).optional(),
  notFlags: z.array(z.string()).optional(),
  minFuture: z.number().optional(),
  maxFuture: z.number().optional(),
  maxTrust: z.number().optional(),
});

const Text = z.union([z.string(), z.array(z.strictObject({ when: When.optional(), text: z.string() }))]);
const Route = z.strictObject({ when: When.optional(), to: z.string() });
const meterDelta = z.number().min(-100).max(100);

const Option = z.strictObject({
  id: z.string(),
  label: z.string(),
  grade: z.enum(["great", "ok", "bad"]),
  real: z.boolean().optional(),
  effect: z.strictObject({
    profit: meterDelta.optional(),
    future: meterDelta.optional(),
    trust: z.number().optional(),
    flags: z.array(z.string()).optional(),
  }),
  next: z.union([z.string(), z.array(Route)]),
  media: Media,
  outcome: Text,
  why: z.string(),
  better: z.string().optional(),
  takeaway: z.string(),
  traits: z.partialRecord(z.enum(["horizon", "risk", "disrupt"]), z.number()),
});

const Tier = z.enum(["legend", "survivor", "collapse", "fired"]);

const Node = z.discriminatedUnion("type", [
  z.strictObject({ id: z.string(), type: z.literal("scene"), year: z.string(), media: Media, text: Text, next: z.string() }),
  z.strictObject({
    id: z.string(),
    type: z.literal("decision"),
    year: z.string(),
    title: z.string(),
    media: Media,
    setup: Text,
    question: z.string(),
    advisor: Text,
    options: z.array(Option),
  }),
  z.strictObject({ id: z.string(), type: z.literal("ending"), tier: Tier, title: z.string(), media: Media, text: Text, bonus: z.number() }),
  z.strictObject({ id: z.string(), type: z.literal("route"), routes: z.array(Route) }),
]);

const Meter = z.enum(["profit", "future"]);

export const HotSeatSchema = z.strictObject({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  hook: z.string(),
  role: z.string(),
  years: z.string(),
  cover: Media,
  emblem: Media.optional(),
  draft: z.boolean().optional(),
  complexity: z.literal([1, 2, 3, 4, 5]),
  minutes: z.number(),
  start: z.string(),
  startMeters: z.record(Meter, z.number()),
  startTrust: z.number(),
  meters: z.record(Meter, z.strictObject({ label: z.string(), hint: z.string() })),
  nodes: z.record(z.string(), Node),
  realEnding: Tier,
  realHistory: z.string(),
  sources: z.array(z.strictObject({ label: z.string(), url: z.string() })),
  credits: z.string(),
});

const Source = z.strictObject({ label: z.string(), url: z.string() });

export const DailyPoolSchema = z.strictObject({
  startDay: z.iso.date(),
  calls: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      company: z.string(),
      year: z.string(),
      title: z.string(),
      media: Media.optional(),
      setup: z.string(),
      question: z.string(),
      advisor: z.string().optional(),
      options: z
        .array(
          z.strictObject({
            id: z.string(),
            label: z.string(),
            grade: z.enum(["great", "ok", "bad"]),
            real: z.boolean().optional(),
            outcome: z.string(),
            why: z.string(),
            better: z.string().optional(),
            takeaway: z.string(),
          }),
        )
        .length(3),
      realHistory: z.string(),
      sources: z.array(Source).min(1),
      draft: z.boolean().optional(),
    }),
  ),
});

// Exact type equality (optional fields included): a compile error here means the schema and hotseat-types.ts differ.
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const inSync: Eq<z.infer<typeof HotSeatSchema>, HotSeat> = true;
const dailyInSync: Eq<z.infer<typeof DailyPoolSchema>, DailyPool> = true;
void inSync;
void dailyInSync;
