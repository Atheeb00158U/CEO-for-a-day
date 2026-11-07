# Architecture Snapshot

## Repository Map

1316 modules, 27078 symbols, grouped by area. Every module is in `facts.jsonl`, or query_facts(kind="module").

| Area | Modules | Symbols | Languages |
|------|---------|---------|-----------|
| `.claude` | 1265 | 25868 | python, typescript |
| `src` | 48 | 1164 | typescript |
| `scripts` | 1 | 41 | python |
| `.` | 1 | 5 | typescript |
| `public` | 1 | 0 | typescript |

Largest modules:
- `.claude/worktrees/determined-chatelet-f3d9b3/src/lib` — 453 symbols (typescript)
- `.claude/worktrees/hotseat-story-rewrite-a630fa/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/trust-disclaimer-support-2490e5/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/unit-4-gates-4d67a2/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/unit-4-lessons-43a0be/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/unit-5-78770d/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/unit-6-e41884/src/lib` — 447 symbols (typescript)
- `.claude/worktrees/wolf-voice-expressive-e09ed1/src/lib` — 447 symbols (typescript)
- `src/lib` — 447 symbols (typescript)
- `.claude/worktrees/admin-payment-issues-8478f3/src/lib` — 445 symbols (typescript)
- `.claude/worktrees/brave-lehmann-b60742/src/lib` — 445 symbols (typescript)
- `.claude/worktrees/module-3-3-c81475/src/lib` — 445 symbols (typescript)
- `.claude/worktrees/uiux-ffd0fb/src/lib` — 443 symbols (typescript)
- `.claude/worktrees/xenodochial-kirch-4987b2/src/lib` — 443 symbols (typescript)
- `.claude/worktrees/frosty-blackburn-477c29/src/lib` — 440 symbols (typescript)
- `.claude/worktrees/agent-ade05e7b190665794/src/lib` — 425 symbols (typescript)
- `.claude/worktrees/agent-ade751ac5d6a0aef6/src/lib` — 415 symbols (typescript)
- `.claude/worktrees/agent-a4d9d328e222d4fb8/src/lib` — 413 symbols (typescript)
- `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server` — 353 symbols (typescript)
- `.claude/worktrees/hotseat-story-rewrite-a630fa/src/lib/server` — 353 symbols (typescript)

## Extraction Quality

- Files parsed: **6137** / 86229 seen (787 file(s) + 39 directory tree(s) skipped by ignore globs)
- Parse errors: 0

## Architecture Pattern

**Architecture pattern: nextjs** (confidence: 89%)

Recognised nextjs from directory names: 1165 of 1316 typescript modules classified. All 6286 imports between ordered layers run inward; none run against the order.

Layer mapping:
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/_global-error" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/_not-found" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/[id]" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/club" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/club/act" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/notify" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/notify/send" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/payments" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/admin/payments/resolve" maps to layer "pages"
- module ".claude/worktrees/admin-payment-issues-8478f3/.next/server/app/api/account" maps to layer "pages"
- … and 1153 more (query_insights(explainer="layers") for all)

## How to Add a Feature

This code is laid out as **nextjs**. A dependency runs from an outer layer to an inner one, so a feature is built inward:

1. **pages** — e.g. `.claude/worktrees/admin-payment-issues-8478f3/.next/server/app`
2. **components** — e.g. `.claude/worktrees/admin-payment-issues-8478f3/src/components`
3. **lib, types** — e.g. `.claude/worktrees/admin-payment-issues-8478f3/src/lib`

## Entry Points

2478 handlers, 15 shown:
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib.checkHandle` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/community.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib.reservedName` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/community.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.accept` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.accessCheck` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/http.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.accessContext` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/membership.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.activity` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.addToGroup` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.afterSave` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.allowedLessonIds` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/http.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.alreadyCancelled` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/razorpay.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.answerOf` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/content.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.badge` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.block` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/club.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.broadcast` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/reminders.ts)
- **handler**: `.claude/worktrees/admin-payment-issues-8478f3/src/lib/server.buy` (.claude/worktrees/admin-payment-issues-8478f3/src/lib/server/game.ts)
- … and 2463 more (query_facts(kind="route") for all)
- **main**: `.claude/worktrees/admin-payment-issues-8478f3/scripts/make-sfx.main` (.claude/worktrees/admin-payment-issues-8478f3/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-a35e0a3e83241ef2e/scripts/make-sfx.main` (.claude/worktrees/agent-a35e0a3e83241ef2e/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-a4340a55cca69c31f/scripts/make-sfx.main` (.claude/worktrees/agent-a4340a55cca69c31f/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-a4d9d328e222d4fb8/scripts/make-sfx.main` (.claude/worktrees/agent-a4d9d328e222d4fb8/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-ade05e7b190665794/scripts/make-sfx.main` (.claude/worktrees/agent-ade05e7b190665794/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-ade751ac5d6a0aef6/scripts/make-sfx.main` (.claude/worktrees/agent-ade751ac5d6a0aef6/scripts/make-sfx.py)
- **main**: `.claude/worktrees/agent-af4175b265c7ce49c/scripts/make-sfx.main` (.claude/worktrees/agent-af4175b265c7ce49c/scripts/make-sfx.py)
- **main**: `.claude/worktrees/brave-lehmann-b60742/scripts/make-sfx.main` (.claude/worktrees/brave-lehmann-b60742/scripts/make-sfx.py)
- **main**: `.claude/worktrees/determined-chatelet-f3d9b3/scripts/make-sfx.main` (.claude/worktrees/determined-chatelet-f3d9b3/scripts/make-sfx.py)
- **main**: `.claude/worktrees/frosty-blackburn-477c29/scripts/make-sfx.main` (.claude/worktrees/frosty-blackburn-477c29/scripts/make-sfx.py)
- **main**: `.claude/worktrees/hotseat-story-rewrite-a630fa/scripts/make-sfx.main` (.claude/worktrees/hotseat-story-rewrite-a630fa/scripts/make-sfx.py)
- **main**: `.claude/worktrees/lesson-system-2025ab/scripts/make-sfx.main` (.claude/worktrees/lesson-system-2025ab/scripts/make-sfx.py)
- **main**: `.claude/worktrees/module-3-3-c81475/scripts/make-sfx.main` (.claude/worktrees/module-3-3-c81475/scripts/make-sfx.py)
- **main**: `.claude/worktrees/trust-disclaimer-support-2490e5/scripts/make-sfx.main` (.claude/worktrees/trust-disclaimer-support-2490e5/scripts/make-sfx.py)
- **main**: `.claude/worktrees/uiux-ffd0fb/scripts/make-sfx.main` (.claude/worktrees/uiux-ffd0fb/scripts/make-sfx.py)
- **main**: `.claude/worktrees/unit-4-gates-4d67a2/scripts/make-sfx.main` (.claude/worktrees/unit-4-gates-4d67a2/scripts/make-sfx.py)
- **main**: `.claude/worktrees/unit-4-lessons-43a0be/scripts/make-sfx.main` (.claude/worktrees/unit-4-lessons-43a0be/scripts/make-sfx.py)
- **main**: `.claude/worktrees/unit-5-78770d/scripts/make-sfx.main` (.claude/worktrees/unit-5-78770d/scripts/make-sfx.py)
- **main**: `.claude/worktrees/unit-6-e41884/scripts/make-sfx.main` (.claude/worktrees/unit-6-e41884/scripts/make-sfx.py)
- **main**: `.claude/worktrees/wolf-voice-expressive-e09ed1/scripts/make-sfx.main` (.claude/worktrees/wolf-voice-expressive-e09ed1/scripts/make-sfx.py)
- **main**: `.claude/worktrees/xenodochial-kirch-4987b2/scripts/make-sfx.main` (.claude/worktrees/xenodochial-kirch-4987b2/scripts/make-sfx.py)
- **main**: `scripts/make-sfx.main` (scripts/make-sfx.py)
1192 routes, 15 shown:
- **route** ALL `/admin/club/act` (.claude/worktrees/admin-payment-issues-8478f3/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/agent-ade05e7b190665794/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/agent-ade751ac5d6a0aef6/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/brave-lehmann-b60742/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/determined-chatelet-f3d9b3/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/frosty-blackburn-477c29/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/hotseat-story-rewrite-a630fa/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/module-3-3-c81475/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/trust-disclaimer-support-2490e5/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/uiux-ffd0fb/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/unit-4-gates-4d67a2/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/unit-4-lessons-43a0be/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/unit-5-78770d/src/app/admin/club/act/route.ts)
- **route** ALL `/admin/club/act` (.claude/worktrees/unit-6-e41884/src/app/admin/club/act/route.ts)
- … and 1177 more (query_facts(kind="route") for all)

## Routes

1192 routes, grouped by path prefix. query_facts(kind="route") for all of them.

| Prefix | Routes | Methods | Example |
|--------|--------|---------|----------|
| `/api` | 682 | ALL, GET, POST | `/api/account` |
| `/admin` | 236 | ALL, GET, POST | `/admin` |
| `/app#club` | 79 | GET | `/app#club/@` |
| `/` | 46 | GET | `/` |
| `/sfx` | 29 | GET | `/sfx/{}.mp3` |
| `/realtime` | 26 | POST | `/realtime/v1/api/broadcast` |
| `/app` | 23 | GET | `/app` |
| `/app#league` | 23 | GET | `/app#league` |
| `/privacy` | 22 | GET | `/privacy` |
| `/terms` | 22 | GET | `/terms` |
| `/i` | 4 | POST | `/i/v0/e/` |

## Dependency Rules

610 internal module dependencies. The modules that reach furthest; traverse() or query_facts(kind="dependency") for the edges themselves.

| Module | Depends on |
|--------|------------|
| `.claude/worktrees/admin-payment-issues-8478f3/src` | 3 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src` | 3 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src` | 3 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src` | 3 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src` | 3 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src` | 3 modules |
| `.claude/worktrees/agent-af4175b265c7ce49c/src` | 3 modules |
| `.claude/worktrees/brave-lehmann-b60742/src` | 3 modules |
| `.claude/worktrees/determined-chatelet-f3d9b3/src` | 3 modules |
| `.claude/worktrees/frosty-blackburn-477c29/src` | 3 modules |
| `.claude/worktrees/hotseat-story-rewrite-a630fa/src` | 3 modules |
| `.claude/worktrees/lesson-system-2025ab/src` | 3 modules |
| `.claude/worktrees/module-3-3-c81475/src` | 3 modules |
| `.claude/worktrees/trust-disclaimer-support-2490e5/src` | 3 modules |
| `.claude/worktrees/uiux-ffd0fb/src` | 3 modules |
| `.claude/worktrees/unit-4-gates-4d67a2/src` | 3 modules |
| `.claude/worktrees/unit-4-lessons-43a0be/src` | 3 modules |
| `.claude/worktrees/unit-5-78770d/src` | 3 modules |
| `.claude/worktrees/unit-6-e41884/src` | 3 modules |
| `.claude/worktrees/wolf-voice-expressive-e09ed1/src` | 3 modules |
| `.claude/worktrees/xenodochial-kirch-4987b2/src` | 3 modules |
| `src` | 3 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/admin` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/api` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/api/cron` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/api/daily` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/api/lesson` | 2 modules |
| `.claude/worktrees/admin-payment-issues-8478f3/src/app/api/run` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app/api` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app/api/cron` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app/api/daily` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app/api/lesson` | 2 modules |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src/app/api/run` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app/api` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app/api/cron` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app/api/daily` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app/api/lesson` | 2 modules |
| `.claude/worktrees/agent-a4340a55cca69c31f/src/app/api/run` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/admin` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/api` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/api/cron` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/api/daily` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/api/lesson` | 2 modules |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src/app/api/run` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/admin` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/api` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/api/cron` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/api/daily` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/api/lesson` | 2 modules |
| `.claude/worktrees/agent-ade05e7b190665794/src/app/api/run` | 2 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src/app` | 2 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src/app/admin` | 2 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src/app/api` | 2 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src/app/api/cron` | 2 modules |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src/app/api/daily` | 2 modules |

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `src/lib/server` | 654 | 0 | high |
| `src/lib` | 327 | 1 | high |
| `src/content` | 22 | 0 | high |
| `.claude/worktrees/admin-payment-issues-8478f3/src` | 0 | 5 | medium |
| `.claude/worktrees/agent-a35e0a3e83241ef2e/src` | 0 | 5 | medium |
| `.claude/worktrees/agent-a4340a55cca69c31f/src` | 0 | 5 | medium |
| `.claude/worktrees/agent-a4d9d328e222d4fb8/src` | 0 | 5 | medium |
| `.claude/worktrees/agent-ade05e7b190665794/src` | 0 | 5 | medium |
| `.claude/worktrees/agent-ade751ac5d6a0aef6/src` | 0 | 5 | medium |
| `.claude/worktrees/brave-lehmann-b60742/src` | 0 | 5 | medium |

## Risk Zones

- **Cyclic dependency detected (3 modules)** (confidence: 100%): The following modules form a dependency cycle: src/components -> src/components/club -> src/components/shadcn -> src/components. This can cause initialization issues, make refactoring harder, and indicates tight coupling.

---

*Generated at 2026-11-06T10:12:32Z in 3m11.424227084s. 72399 facts, 235 insights.*
