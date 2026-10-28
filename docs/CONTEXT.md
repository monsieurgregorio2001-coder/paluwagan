# Online Paluwagan: Local context

Updated: 2026-10-20 (Asia/Manila). Facts come from local README/layout inspection; historical app metrics were not rerun.

## Implementation

Browser portfolio demo with a money ledger. The prototype passbook is separate from this app. The app does not hold or move money, and reminder drafts do not send messages.

See [README](../README.md) for setup and detailed architecture.

## Current context

Keep ledger rules and money invariants explicit when changing behavior. The passbook redesign (phase 3b) joins house 2.0.1: set HOUSE_DIR to a hub checkout before building. See docs/MOTION.md for the room's animations.

[Shared current state](../../monsieurgregorio2001-coder.github.io/docs/portfolio/CURRENT-STATE.md) holds cross-project priorities. [Workflow](../../monsieurgregorio2001-coder.github.io/docs/portfolio/WORKFLOW.md) keeps documentation proportional. Formatting defaults are in .editorconfig. This checkpoint's documentation/config changes are local and uncommitted.

## Verification entry points

Use `npm test`, `npm run typecheck`, and `npm run build`. Verify ledger invariants when calculations change.

## Standalone checkout

Local facts are usable without sibling repositories. Shared context lives in the [portfolio hub repository](https://github.com/monsieurgregorio2001-coder/monsieurgregorio2001-coder.github.io), under docs/portfolio/. New files may not be committed there yet. Record unavailable context instead of inventing decisions. Update this file only when project facts change.
