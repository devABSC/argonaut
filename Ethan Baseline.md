# Ethan's new MD source file

This is Ethan's source file for replicating a Claude Code intelligence +
tooling setup on a new machine. Scope: **general dev on new/isolated projects
only** — no access to existing client memory.

Follow the sections in order. Each has a "verify" step. Don't skip verification.

---

## 1. Install Claude Code

```bash
brew install --cask claude-code
```

Sign in with your own Anthropic account.

**Verify:** `claude --version` prints a version.

---

## 2. Drop in the global CLAUDE.md

This is the file that shapes how Claude behaves in every session. Paste the
block below into `~/.claude/CLAUDE.md` on the new machine.

```markdown
# Global Claude Guidelines

Personal, machine-wide guidance that applies to every Claude Code session run
under this user account. Project-level CLAUDE.md files take precedence over
this when their guidance is more specific.

---

## Coding Principles (Karpathy Skills)

Behavioral guidelines to reduce common LLM coding mistakes. Source:
https://github.com/forrestchang/andrej-karpathy-skills (MIT).

Tradeoff: These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it
work") require constant clarification.

### 5. Test Before Committing

Typecheck passing is necessary but not sufficient. A type-clean function can
still crash at runtime — missing binary, wrong env var, RLS error, network
call to a service that isn't configured. Before `git commit`, the change
must have been *executed* in a way that proves it works:

- For pure-logic changes: run a unit test or a short Node script that
  exercises the function with realistic input.
- For server actions / API routes: hit the route from a running dev server
  (curl, browser, or preview tool) and check the response.
- For UI changes that affect rendering: actually load the page in a preview
  and look at it.
- For pipelines that depend on a binary / external service (ffmpeg,
  whisper, openai, supabase storage): test the integration in isolation
  before wiring it into the real flow.

If something can't be tested locally (deploy-only behavior, real prod data,
a webhook from an external system): say so explicitly in the response. Don't
push and assume — push and tell the user what you couldn't verify and what
they should watch for.

When a previous push failed in production, prefer to *reproduce the failure
locally first* before guessing at a fix. Speculation costs the user another
deploy cycle.

---

## Web / Frontend Builds

**Always add a favicon to every web app build.** Never ship with the default
framework favicon or a 404 at `/favicon.ico`. Derive the icon from the app's
brand mark (a simple SVG glyph or logo is fine), keep it on-brand, and confirm
it actually loads before calling the build done.

- **Next.js (App Router):** add `app/icon.(tsx|png|svg)` for the favicon and
  `app/apple-icon.(tsx|png)` for iOS. Also ensure `/favicon.ico` resolves — a
  static `app/favicon.ico`, or a rewrite to the generated icon
  (`rewrites: () => [{ source: "/favicon.ico", destination: "/icon" }]`).
- **Other stacks:** include `<link rel="icon">` (and apple-touch-icon) in the
  document head pointing at a real icon asset.
- **Verify:** the favicon endpoint returns 200 with an image content-type, and
  the tab shows the icon — don't assume, check.

---

## Git commit author

Vercel blocks deploys when the git commit-author email is invalid
(e.g. `user@local`). Before the first commit on a new machine, set:

    git config --global user.email "matrix425@gmail.com"
    git config --global user.name  "Ethan"
```

**Verify:** open a new Claude Code session in any directory and ask
"what coding principles should you follow?" — Claude should reference the
Karpathy rules by number.

---

## 2b. Design principles (append to `~/.claude/CLAUDE.md`)

These are earned design lessons. They normally live in memory files
and transfer per-user; codifying them here so a new machine inherits them
from day one. Append the block below to `~/.claude/CLAUDE.md` beneath the
"Web / Frontend Builds" section.

```markdown
---

## Design Principles

### Match the archetype, not the brand

An "elegant boutique landing page" and an "MLM operator's back-office" are
opposite briefs — even for the same product. Diagnose the archetype first,
then pick the skin.

- **Elegant / editorial** (ad landing pages, boutique DTC, luxury RE):
  light ivory/neutral-dominant canvas; bold brand color used as a
  **signature** (hero + one or two bands + footer), NOT full-bleed
  everywhere; ONE restrained accent (antique gold, not neon); a refined
  serif display (Cormorant / Bodoni / Playfair) over a clean sans body;
  generous whitespace; hairline rules and soft shadows instead of thick
  borders; calm motion.
- **Bold earnings / operator app** (MLM back-office, dashboards, ops
  consoles): bold geometric sans (Space Grotesk / Sora / Plus Jakarta),
  heavy weights, tight tracking, BIG tabular numbers for money; cool clean
  app canvas + a rich saturated brand color + a vibrant money-gold accent;
  denser tactile cards, crisp elevation, filled nav icons, colorful stat
  tiles, progress/rank gamification, gradient earnings hero. Reframe Home
  as an earnings dashboard: huge available-balance number, "+₱X this
  month" gold chip, rank medal + "X to rank up — Go!".

Anti-pattern for elegance: kinetic-brutalist / discount-ad aesthetic —
saturated brand color full-bleed on every section, loud secondary accents,
uppercase mono eyebrows, marquees, heavy borders/glows. Reads as "shitty
ads" regardless of color accuracy.

Anti-pattern for operator apps: "premium wellness spa" skin (editorial
serif, warm ivory + sage, airy whitespace, thin accents). Reads as a zen
massage business, not a business-builder.

### Pull brand tokens from the LIVE site, not the logo

Before committing colors/fonts for a rebuild-or-align task, drive the live
site — never infer from a logo asset. A white/transparent wordmark carries
no color; guessing produces a whole wrong palette.

- `WebFetch` the site for cues, then use the connected Chrome MCP
  (`navigate` + `javascript_tool`) to read `getComputedStyle` on VISIBLE
  elements (`offsetParent !== null` — Wix/site builders inject hidden
  duplicate `<h1>`s and editor colors like `#116dff` that mislead raw hex
  greps).
- Sample: hero background/gradient, real CTA button background, heading
  font-family/style, active/accent colors.
- No live site? Ask the user for the hex/kit — do not infer.

### Kanban boards are draggable by default

Every kanban-style board is Trello-style draggable — cards move between
columns via drag; each drop calls the server action that flips the record's
status. Static kanbans read as unfinished.

- `@dnd-kit/core` + `@dnd-kit/sortable` (pure JS, works on Vercel, touch +
  keyboard supported).
- The board is a `"use client"` component that receives initial rows from
  the server component and manages local optimistic state.
- `onDragEnd` → derive new column from drop container → call server action
  via `useTransition` → revalidate.
- When the target status needs extra data (e.g. "Released → Liquidated"
  needs an amount), open a small modal on drop. Never silently no-op.
- Keep any existing per-card action buttons as a fallback for touch users
  who can't drag well.

### Never gate visibility on animation or IntersectionObserver

The Claude Code preview tool runs a headless/backgrounded browser: CSS
animations do NOT advance and IntersectionObserver callbacks NEVER fire.
Real users hit the same trap on backgrounded tabs and reduced-motion.

- Keep `opacity: 1` as the base state. The static (no-motion) render must
  already look correct and complete.
- Animate **transform only** (translate/scale) for entrances — worst case
  is "visible, slightly offset," never "invisible."
- Treat motion (and scroll-reveal via IO) as pure enhancement on top of a
  fully-visible base.
- If you must use IO for reveal, default the element visible and have IO
  *add* polish, plus a `setTimeout` fallback.
- You cannot visually verify motion in the preview — verify the correct
  **static** state via `getComputedStyle` (opacity 1, sane transform) and
  trust keyframes for the live animation.

### Favicon (already covered above, restated for design context)

Every web app ships with an on-brand favicon derived from the brand mark.
No framework defaults, no `/favicon.ico` 404s. Verify the endpoint returns
200 with an image content-type.
```

**Verify:** ask Claude in a new session "how should I approach an elegant
landing page vs. an MLM back-office?" — it should distinguish the two
archetypes and reference the specific token choices above.

---

## 3. Install the Superpowers plugin

This adds every skill listed under `superpowers:*` — brainstorming,
systematic-debugging, TDD, code-review flow, executing-plans, etc. This is
the single biggest lift in "chat intelligence."

Inside a Claude Code session:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

**Verify:** run `/superpowers:using-superpowers` — the skill body should load.

---

## 4. Install the standalone skills

These live directly under `~/.claude/skills/`. Three to install:

| Skill               | Purpose                                              | Source |
|---------------------|------------------------------------------------------|--------|
| `frontend-design`   | Distinctive, production-grade frontend UI            | anthropic-skills |
| `ui-ux-pro-max`     | Full UI/UX design system (palettes, fonts, styles)   | anthropic-skills |
| `graphify`          | Turn any codebase/input into a queryable knowledge graph | `pipx install graphifyy` + skill install |

Install all three — copy the skill folders from an existing setup, or fetch
from source:

```bash
mkdir -p ~/.claude/skills
# frontend-design + ui-ux-pro-max: copy an existing folder or grab from the anthropic-skills repo
# graphify:
pipx install graphifyy
# then symlink or copy the graphify skill folder into ~/.claude/skills/graphify
```

**Verify:** run `/frontend-design` — the skill loads.

---

## 5. Settings.json

Drop this into `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "superpowers-marketplace": {
      "source": {
        "source": "github",
        "repo": "obra/superpowers-marketplace"
      }
    }
  },
  "skipWorkflowUsageWarning": true,
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true
  }
}
```

No hooks, no custom permissions — this runs with defaults. If you
want fewer permission prompts later, invoke the
`fewer-permission-prompts` skill inside a session.

---

## 6. MCP connectors

These MCPs are wired in the source setup. Add only the ones you need — each
one requires authenticating on your own account; never share tokens.

| MCP                    | Purpose                                          | Priority |
|------------------------|--------------------------------------------------|----------|
| Claude Browser         | In-app browser (built-in, no setup)              | built-in |
| Claude in Chrome       | Drive your real Chrome (needs extension)         | high     |
| Computer Use           | Native macOS app automation                      | high     |
| iOS Simulator          | Run/test iOS apps                                | medium   |
| Higgsfield             | Image / video / audio / 3D generation + upscale  | medium   |
| MCP Registry           | Discover new MCP connectors                      | low      |
| Scheduled Tasks        | Cron-style scheduled Claude runs                 | low      |
| Meta Ads               | Manage Meta ad accounts                          | skip (account-specific) |
| CCD Session Mgmt       | Comes with Claude Code                           | built-in |

Add via `/mcp` inside a Claude Code session, or through the Claude.ai
connector settings — you walk through the OAuth flow on your own
account.

**Verify:** `/mcp` lists each server as `connected`.

---

## 7. Memory system — DO NOT copy the source machine's memory

Claude Code has a persistent memory system at
`~/.claude/projects/<project-dir>/memory/`. The source machine's memory contains ~90
project files with client names, DB project IDs, deploy URLs, and internal
decisions.

**Do not copy those files to the new machine.** Reasons:
- Contains client-specific credentials references and infrastructure IDs.
- Memories decay — the source snapshots reflect the source machine's state,
  not the new one's.
- The system is designed to build up organically per user.

Instead, understand how the system works:

- Memory files are auto-written when Claude learns facts about the user,
  their projects, feedback, or external references.
- Types: `user`, `feedback`, `project`, `reference`.
- Index lives in `MEMORY.md`; each entry is a one-line pointer.
- You can invoke `/consolidate-memory` periodically to merge/prune.

If the new machine inherits an ongoing project, hand over ONE
targeted project memory file (not the whole directory), or write a short
project CLAUDE.md at the project root.

---

## 8. Model + fast-mode preferences

Run Opus 4.7 with fast mode toggled per session (`/fast`). No forced
model setting — Claude Code picks per task tier.

---

## 9. Final smoke test

New session in an empty directory. Ask:

> "I want to build a Next.js landing page for a fictional local coffee shop.
> Where do you start?"

Expected behavior:
- Claude invokes `superpowers:brainstorming` before writing any code.
- Asks about audience, brand voice, must-have sections.
- References the favicon rule when scaffolding.
- After code, invokes `superpowers:verification-before-completion`.

If any of that is missing, re-check steps 2–4.

---

## What's intentionally NOT included

- **The source machine's memory files** (`~/.claude/projects/.../memory/`) — client data.
- **The source machine's session history** (`~/.claude/sessions/`) — private transcripts.
- **`bosslabs-weekly-rollover` skill** — hardcoded to specific clients.
- **Meta Ads MCP tokens** — specific ad accounts.
- **Vercel / Supabase / ConexMail credentials** — issue your own.

---

## Handover checklist

- [ ] Claude Code installed and signed in on your account
- [ ] `~/.claude/CLAUDE.md` populated (step 2)
- [ ] Superpowers plugin installed and verified (step 3)
- [ ] frontend-design, ui-ux-pro-max, graphify skills installed (step 4)
- [ ] `settings.json` in place (step 5)
- [ ] MCP connectors added on your own accounts (step 6)
- [ ] Memory system understood, source files not copied (step 7)
- [ ] Smoke test passes (step 9)
- [ ] `git config --global user.email` set to a real address (step 2 footer)
