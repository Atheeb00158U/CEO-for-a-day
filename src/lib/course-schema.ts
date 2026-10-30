// Zod schema for course JSON. It mirrors course-types.ts; the Eq check at the bottom fails the build if they drift.
// Loaded by Node in the hotseat CLI, so: type-only imports and no path aliases.
import { z } from "zod";
import type { Course, Lesson } from "./course-types";

const Id = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Media = z.union([z.templateLiteral(["img:", z.string()]), z.templateLiteral(["vid:", z.string()])]);
const Option = z.strictObject({ id: z.string(), label: z.string() });

const Screen = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("explain"), id: z.string(), title: z.string().optional(), text: z.string(), media: Media.optional() }),
  z.strictObject({
    kind: z.literal("choice"),
    id: z.string(),
    prompt: z.string(),
    media: Media.optional(),
    options: z.array(Option).min(2).max(4),
    answer: z.string(),
    why: z.string(),
    wrong: z.record(z.string(), z.string()).optional(),
    guess: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal("gap"),
    id: z.string(),
    text: z.string(),
    bank: z.array(z.string()).min(2).max(6),
    answer: z.array(z.string()).min(1),
    why: z.string(),
  }),
  z.strictObject({
    kind: z.literal("order"),
    id: z.string(),
    prompt: z.string(),
    steps: z.array(z.string()).min(3).max(6),
    why: z.string(),
  }),
  z.strictObject({
    kind: z.literal("sort"),
    id: z.string(),
    prompt: z.string(),
    buckets: z.array(z.string()).length(2),
    items: z
      .array(z.strictObject({ text: z.string(), bucket: z.number().int().min(0).max(1) }))
      .min(3)
      .max(8),
    why: z.string(),
  }),
  z.strictObject({
    kind: z.literal("scenario"),
    id: z.string(),
    year: z.string().optional(),
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
          outcome: z.string(),
          why: z.string(),
          better: z.string().optional(),
        }),
      )
      .length(3),
  }),
]);

export const LessonSchema = z.strictObject({
  id: Id,
  title: z.string(),
  principle: z.string(),
  minutes: z.number().int().min(1).max(10),
  draft: z.boolean().optional(),
  screens: z.array(Screen).min(3),
  summary: z.array(z.string()).min(1),
  cards: z.array(
    z.strictObject({
      id: Id,
      front: z.string(),
      options: z.array(z.string()).min(2).max(3),
      answer: z.number().int().min(0),
      back: z.string(),
    }),
  ),
  sources: z.array(z.strictObject({ label: z.string(), url: z.url() })).optional(),
});

export const CourseSchema = z.strictObject({
  units: z.array(
    z.strictObject({
      id: Id,
      title: z.string(),
      goal: z.string(),
      modules: z
        .array(z.strictObject({ id: Id, title: z.string(), goal: z.string(), lessons: z.array(Id).min(1), gates: z.array(Id) }))
        .min(1),
      draft: z.boolean().optional(),
    }),
  ),
});

// Exact type equality (optional fields included): a compile error here means the schema and course-types.ts differ.
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const lessonInSync: Eq<z.infer<typeof LessonSchema>, Lesson> = true;
const courseInSync: Eq<z.infer<typeof CourseSchema>, Course> = true;
void lessonInSync;
void courseInSync;
