# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the strict TypeScript application:
- `rules.ts`: immutable game state, legal actions, outcomes, seeded shuffling, and undo.
- `ai.ts` and `ai.worker.ts`: public observations, difficulty policies, and background search.
- `renderer.ts` and `audio.ts`: Three.js rendering, animations, picking, and synthesized sound.
- `main.ts` and `style.css`: session coordination, menus, accessible controls, and responsive styling.

Tests live in `tests/rules.test.ts`. `docs/SPEC.md` describes the requested experience; `README.md` documents implemented rules and controls. Textures and audio are generated procedurally; there is no external asset directory. `dist/` is generated output and must not be edited manually.

## Build, Test, and Development Commands

Use Node.js 22.20+ and npm.

- `npm install`: install dependencies.
- `npm run dev`: start Vite on localhost; open its printed URL.
- `npm run typecheck`: check strict TypeScript without emitting files.
- `npm test`: run TypeScript tests using Node’s built-in test runner.
- `npm run build`: type-check and generate the production site in `dist/`.

Serve builds over HTTP(S); opening files directly breaks module scripts and workers.

## Coding Style & Naming Conventions

Follow surrounding code: four-space indentation in application TypeScript, two spaces in CSS/configuration, single-quoted TypeScript strings, and semicolons. Use camelCase for functions/variables, PascalCase for classes/types, and uppercase action discriminants such as `FLIP`. Keep filenames lowercase, using suffixes such as `.worker.ts` and `.test.ts`. No formatter or linter is configured; avoid unrelated formatting changes.

## Architecture Constraints

Keep authoritative state independent of Three.js. Animations reflect committed actions. Pass only public observations to AI workers; never expose hidden piece identities or shuffle seeds. Preserve safe undo boundaries: never cross a reveal, and restore a complete round against AI.

## Testing Guidelines

Use `node:test` and `node:assert/strict`, with descriptive behavior-based test names. Add regression tests for changed rules, undo, or AI information boundaries; use seeded scenarios. No numeric coverage threshold is configured. Run tests and the production build before submitting. For interface changes, check desktop/mobile gameplay, keyboard access, and reduced motion; disclose any unperformed browser checks.

## Commit & Pull Request Guidelines

No Git history is available in this checkout. Use concise imperative commit subjects, such as `Fix cannon screen validation`. PRs should explain the behavior change, link relevant issues, report validation, and include screenshots for visual changes. Update README documentation when rules or controls change.
