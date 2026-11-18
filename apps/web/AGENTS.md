# AGENTS.md — web app

Read the root [`AGENTS.md`](../../AGENTS.md) first. Before using UI SDK, read `node_modules/@ui-sdk/react/docs/llms.txt` and the docs for each component you use.

## Stack

- React 19 + TypeScript + Vite.
- `@ui-sdk/react` and `@ui-sdk/core` (beta, pinned).
- `react-icons/gi` for fantasy symbols.
- Plain CSS in `src/styles/global.css`; no Tailwind requirement.

## UI SDK rules

- There is no root import. Import each component from its entry:
  - `@ui-sdk/react/button`
  - `@ui-sdk/react/dialog`
  - `@ui-sdk/react/tabs`
  - `@ui-sdk/react/progress`
  - `@ui-sdk/react/collapsible`
  - `@ui-sdk/react/toast`
- Import `@ui-sdk/core/web.css` once in `src/main.tsx`.
- Components are unstyled and expose state through data attributes (`data-pending`, `data-pressed`, `data-state`, …). Style with app-owned classes.
- Return a Promise from `Button.onClick` to get pending state and prevent double submission.
- Every icon-only control needs an accessible name (`aria-label` or visible text).
- Pin UI SDK versions. Record meaningful upgrades in `CHANGELOG.md`.

## State rules

- All state-changing actions go through the API client in `src/lib/api.ts`.
- Never calculate authoritative rewards, damage, combat outcomes or world turns in the browser.
- Never show rewards before the server confirms them.
- Show fallback/generation status distinctly from game action status.
- Reuse an operation ID across retries of the same logical action; clear it only after success.
- Viewing screens, opening dialogs and changing local tab state never advance the world.

## Screens

World, Event board, Event detail, Party, Character detail, Battle report, Inventory, Journal, Diagnostics. Keep navigation accessible and responsive.

## Commands

```bash
bun run --cwd apps/web dev     # http://localhost:5173
bun run --cwd apps/web build   # production bundle
bun run typecheck              # from repo root
bun run lint                   # from repo root
```

`VITE_API_URL` defaults to `http://localhost:3001/api`; override it in the shell or a local `.env` file.

## Documentation checklist

Update this file for new conventions, `docs/GAME_DESIGN.md` for gameplay-facing UI behaviour, `docs/OPERATIONS.md` for configuration, and `CHANGELOG.md` for user-visible changes.
