# BANQI · Chinese Dark Chess

A browser-based 3D Banqi game: a procedural walnut board, wooden pieces, animated flips and captures, local two-player play, and three AI difficulties. Built with TypeScript, Three.js, Vite, and Web Audio; no backend, account, or external runtime assets.

## Run locally

Requires Node.js 22.20+ (or Node.js 24+).

```sh
npm install
npm run dev
```

Open the local URL Vite prints. A WebGL-capable browser is required. The first screen opens the main menu over the board. Choose **Play vs AI** or **Local multiplayer**. The human plays first against the AI; the first revealed piece assigns colors.

```sh
npm run typecheck
npm test
npm run build
```

The production site is generated in `dist/`; serve that directory using any static HTTP server. Do not open `index.html` directly with `file://`: module scripts and AI workers require HTTP(S). The relative Vite base supports hosting under a subdirectory.

## CI/CD and GitHub Pages

`.github/workflows/pages.yml` runs on every branch push, pull requests targeting `main`, and manual dispatches. It installs locked dependencies with `npm ci`, checks TypeScript, runs tests, and builds using Node.js 24. Only successful pushes or manual runs on `main` upload `dist/` and deploy it to GitHub Pages. Feature branches and pull requests run checks without deploying.

One-time setup:

1. Open the repository’s **Settings → Pages** and select **GitHub Actions** under **Build and deployment → Source**.
2. Merge the workflow into `main` and push. Alternatively, select **Actions → CI and GitHub Pages → Run workflow**, choosing `main`.
3. Find the published URL in the deployment job’s `github-pages` environment. For this repository, the default URL is `https://jensonchoi.github.io/banqi/`.

The workflow uses GitHub’s built-in token; no personal access token or deployment secret is needed. Keep the `github-pages` environment’s deployment branches restricted to `main`. GitHub Pages availability depends on repository visibility and your GitHub plan; private repositories require a supported paid plan. See [GitHub’s custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Vite’s relative `base: './'` keeps script, stylesheet, and AI worker URLs compatible with `/banqi/` and custom domains. To roll back, revert the unwanted change on `main`; the next successful workflow redeploys it. Configure branch protection to require **Test and build** before merging if checks should be mandatory.

## Playing

- Click/tap any hidden piece to reveal it. This consumes your turn.
- Select one of your revealed pieces, then select a marked destination.
- Drag to orbit; scroll/pinch to zoom; **Reset view** restores the camera.
- Keyboard: Tab to the accessible board, arrow keys to navigate, Enter/Space to act. Escape clears the selection or closes a dialog.
- Settings include difficulty, sound, reduced motion, safe undo, and draw thresholds. Preferences persist locally; games are not saved across reloads.
- **Restart** reshuffles a fresh game in the current mode. **New game** opens mode selection. Leaving an active game requires confirmation.

The tutorial includes the hierarchy, piece symbols, and a cannon diagram. The HUD shows assigned colors, remaining and captured counts, turn number, and public move history.

## Rule choices

The board is four rows by eight columns. Ordinary pieces move one orthogonal square into an empty cell. Ordinary captures require adjacency and follow:

**General > Advisor > Elephant > Chariot > Horse > Cannon > Soldier**

Soldiers capture Soldiers and Generals only. Generals cannot capture Soldiers. Cannons move one square into empty space but capture a revealed enemy of any rank along a row or column over **exactly one occupied square**. The screen may be hidden or revealed and of either color. Hidden targets cannot be captured.

Elimination counts unrevealed pieces. A player without legal actions loses, but any remaining hidden square is a legal flip. Resignation awards the game to the opponent.

Default automatic draws: **threefold repetition** or **80 consecutive individual turns without a capture or flip**. Settings offer fivefold repetition, 120 quiet turns, or disabling each rule; changes take effect next game. Position keys include public board arrangement, reveal status, color assignments, and side to move. Captures and reveals reset the quiet counter; wins take precedence over draw thresholds.

Safe undo is **off by default**. When enabled, local play takes back the last move/capture. AI play takes back a full human/AI round. Neither can cross a reveal or resignation. Undo is unavailable during animation/AI thinking and after game completion. Restoring a snapshot also restores captures, turn, history, quiet counter, and repetition counts.

## AI and hidden information

- **Easy:** random legal actions with a preference for captures.
- **Medium:** material, threats, mobility, and a shallow opponent-response search.
- **Hard:** sampled public-information expectimax, iterative deepening to three plies, up to 12 candidate actions per interior node, and four sampled outcomes per flip. A 600 ms computation budget keeps the last completed iteration.

AI runs in a module Web Worker. Its observation contains hidden-square markers and aggregate unseen counts, never the authoritative hidden identities or seed. Every simulated reveal is sampled from remaining counts. It is a bounded, approximate search, not an optimal hidden-information solver; strength varies with the position. Worker failures fall back to a legal action.

## Source layout

- `src/rules.ts`: authoritative immutable state, actions, legal moves, outcomes, seedable shuffle, and undo.
- `src/ai.ts`, `src/ai.worker.ts`: public observations, difficulty policies, and worker boundary.
- `src/renderer.ts`: geometry, textures, lighting, camera, picking, state synchronization, and delta-time animations.
- `src/audio.ts`: short synthesized wooden tones; audio starts only following interaction.
- `src/main.ts`: session lifecycle, menus/HUD, accessible board, settings, and turn coordination.
- `src/style.css`: responsive interface, dialogs, and reduced-motion styling.
- `tests/rules.test.ts`: rules, undo, AI information boundaries, and complete seeded games using Node's test runner.

Materials and geometry are reused. Pixel ratio and shadow resolution are capped on small displays. UI text uses installed system fonts; Chinese characters use Songti SC / Noto Serif CJK SC / SimSun / serif fallbacks. Reduced motion removes piece and camera animations.

## Verification

Type checking, automated tests, and production builds can be run with the commands above. Tests cover rank pairs, cannon screens, hidden pieces, turn assignment, draws, resignation, seeded setup, AI legality and information isolation, and seeded games to termination.

Browser visual and end-to-end verification was not completed in the implementation environment: its sandbox denied local port binding and Chromium process startup. Before release, check desktop and mobile layouts, touch picking vs orbit gestures, audio after interaction, full games in both modes, settings/undo, and transitions while AI is thinking in a normal browser. A 60 FPS target is not yet measured on hardware.
