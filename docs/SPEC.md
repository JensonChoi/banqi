# Build a Premium 3D Banqi (Chinese Dark Chess) Web Game

You are an expert game developer, Three.js graphics engineer, and UI/UX designer.

Build a complete, polished, fully playable, browser-based **3D Banqi (暗棋 / Chinese Dark Chess)** game using **HTML, CSS, TypeScript, and Three.js**.

The goal is to create a visually stunning, smooth, and intuitive game that feels like a premium digital tabletop experience rather than a basic coding demo.

**Do not stop at creating a prototype or mockup. Implement the actual game logic, animations, user interactions, and gameplay.**

## 1. Technology Stack

Use:

- TypeScript for all game logic and application code
- Three.js for 3D rendering
- HTML5 and CSS3 for the interface
- Vite for development and building
- Web Audio API for sound effects
- Local browser storage for preferences

Avoid unnecessary dependencies. Do not use React unless there is a compelling architectural reason.

Organize the code into modular, maintainable components.

## 2. Visual Design

Create a beautiful, realistic 3D tabletop Banqi board.

### Board

- Traditional Chinese wooden chessboard with a 4×8 grid (32 playable positions).
- Dark walnut or mahogany wood material.
- Subtle wood grain, beveled edges, and realistic surface shading.
- Thin engraved grid lines.
- Slightly raised playing surface with a decorative wooden frame.
- Ambient lighting, soft shadows, and warm directional lighting.
- The board should sit on a dark, elegant tabletop or background.

### Chess Pieces

Create 32 individual 3D Chinese chess pieces.

Each piece should have:

- A cylindrical wooden body resembling traditional Chinese chess pieces.
- Smooth beveled edges.
- Realistic wood or ivory-inspired materials.
- Clearly visible red or black Chinese characters.
- A subtle engraved or embossed appearance.
- Realistic thickness and depth.
- Shadows cast onto the board.

Use proper Chinese chess characters.

| Rank | Red | Black | Count per color |
|---|---|---|---|
| General | 帥 | 將 | 1 |
| Advisor | 仕 | 士 | 2 |
| Elephant | 相 | 象 | 2 |
| Chariot | 俥 | 車 | 2 |
| Horse | 傌 | 馬 | 2 |
| Cannon | 炮 | 砲 | 2 |
| Soldier | 兵 | 卒 | 5 |

All pieces begin face down and are randomly shuffled across the board.

The backs should feature a decorative traditional Chinese geometric pattern.

### Camera

Use an orthographic or perspective camera with:

- A slightly tilted, top-down isometric viewpoint.
- Smooth camera transitions.
- Mouse-based orbit controls with constrained rotation.
- Scroll-wheel zoom with sensible limits.
- A reset-camera button.

The initial camera angle must keep all pieces easily readable.

## 3. Complete Banqi Game Rules

Implement standard Taiwanese-style Banqi rules as the default ruleset.

Separate the rule engine from the graphics and UI so different regional variants can be supported later.

### Initial Setup

- The board contains 4 rows and 8 columns.
- All 32 pieces are shuffled and placed face down.
- Two players take alternating turns.
- The first player reveals a piece on their first turn.
- The color of the first revealed piece determines the first player's color.
- The other player receives the opposite color.

### Actions

On each turn, the active player may:

1. Flip any face-down piece.
2. Move one of their revealed pieces.
3. Capture an opponent's revealed piece.

Each action consumes one turn.

### Movement

- Pieces generally move one square horizontally or vertically.
- Diagonal movement is not allowed.
- Pieces cannot move onto occupied squares unless performing a legal capture.
- Face-down pieces cannot move.
- Players cannot move opponent pieces.

### Capture Hierarchy

Implement the standard hierarchy:

General > Advisor > Elephant > Chariot > Horse > Soldier

The rules are:

- A piece can generally capture an enemy piece of equal or lower rank.
- Soldiers can capture Generals.
- Generals cannot capture Soldiers.
- Cannons have special capture mechanics.

### Cannons

- Cannons move one square orthogonally into an empty adjacent square.
- To capture, a Cannon must move along the same row or column.
- Exactly one piece, called a screen, must exist between the Cannon and its target.
- The screen may be face up or face down, friendly or enemy.
- The target must be an opponent's face-up piece.
- Cannons can capture any opponent piece regardless of rank.

### Endgame

A player wins when the opponent has no remaining pieces capable of continuing play, including any unrevealed pieces belonging to that opponent.

Implement reasonable handling for:

- No legal moves.
- Repeated positions.
- Draw conditions.
- Resignation.
- Games with no remaining hidden pieces.

Make draw/repetition rules configurable, document the chosen defaults, and avoid incorrectly declaring a loss merely because a player has no legal movement while face-down pieces remain available to flip.

## 4. Gameplay Interaction

Make interactions exceptionally smooth and satisfying.

### Selecting Pieces

- Hovering over a piece should subtly highlight it.
- Clicking a face-down piece flips it.
- Clicking an owned face-up piece selects it.
- Show all valid movement and capture destinations.
- Clicking a highlighted destination moves or captures.
- Clicking elsewhere deselects the piece.

### Animations

Implement smooth, physically believable animations:

**Piece flipping**
- Piece lifts slightly off the board.
- Rotates 180 degrees in 3D.
- Lands softly with a subtle bounce.
- Chinese character becomes visible.

**Piece movement**
- Piece smoothly slides to its destination.
- Slight easing during movement.
- Avoid abrupt teleportation.

**Capturing**
- Attacking piece moves toward the captured piece.
- Captured piece rises, fades, or tumbles away.
- Attacking piece settles onto the destination.
- Brief visual emphasis on successful capture.

**Turn changes**
- Smoothly animate the active player indicator.
- Highlight the last move.
- Show subtle visual feedback for invalid actions.

Use delta-time-based animations rather than frame-count-dependent timing.

## 5. Game Modes

### Local Two-Player Mode

Two people can play on the same computer.

- Alternate turns using the same board.
- Display whose turn it is.
- Display assigned colors.
- Support restarting the game.

### Single Player vs AI

Create a playable AI opponent with three difficulty levels:

**Easy**
- Mostly random valid actions.
- Basic capture awareness.

**Medium**
- Prioritize favorable captures.
- Avoid obvious tactical losses.
- Consider piece values and nearby threats.

**Hard**
- Use an information-aware search or simulation strategy suitable for hidden-information games.
- Consider revealed pieces, remaining unseen piece counts, potential captures, and positional threats.
- Do not give the AI access to unrevealed piece identities that a human player could not know.
- Keep AI calculations responsive and avoid freezing the UI.

If full hidden-information search is too expensive, implement a robust heuristic AI rather than pretending to provide advanced AI.

## 6. Game Interface

Create a premium, modern game UI that complements the traditional board.

Use a dark visual theme with restrained gold accents, subtle borders, and elegant typography.

### Main Menu

Include:

- Game title: "BANQI"
- Subtitle: "Chinese Dark Chess"
- Play vs AI
- Local Multiplayer
- How to Play
- Settings

### In-Game HUD

Display:

- Active player
- Player colors
- Current turn number
- Number of captured pieces
- Remaining piece counts
- Move history
- AI difficulty (when applicable)
- Game status

### Controls

Include:

- New Game
- Restart
- Undo (configurable; avoid hidden-information leaks)
- Reset Camera
- Sound On/Off
- Settings
- Exit to Menu

### Captured Pieces

Show captured red and black pieces in dedicated trays beside the board.

The captured pieces should be represented by recognizable Chinese chess symbols.

### How to Play

Include a clear tutorial explaining:

- Piece flipping
- Movement
- Capture hierarchy
- Soldier versus General exception
- Cannon mechanics
- Winning conditions

Provide a visual piece hierarchy guide and highlight special cases.

## 7. Sound Design

Add subtle, satisfying audio feedback for:

- Piece selection
- Piece flipping
- Piece sliding
- Captures
- Invalid moves
- Game victory

Sounds should resemble wooden chess pieces being placed on a board.

Implement these using Web Audio API or locally generated audio without depending on unavailable external assets.

Sound must be optional and respect browser autoplay restrictions.

## 8. Rendering and Performance

Target a smooth 60 FPS on modern desktop browsers.

Implement:

- Antialiasing
- Soft shadows
- Physically reasonable lighting
- Device-pixel-ratio handling
- Responsive canvas resizing
- Efficient raycasting for piece interactions
- Geometry and material reuse
- Proper resource disposal
- Animation cleanup
- Sensible mobile performance limits

Ensure the entire board remains visible at common desktop and mobile screen sizes.

Support mouse and touch input.

## 9. Software Architecture

Separate responsibilities into modules such as:

- GameState
- BanqiRules
- BoardRenderer
- PieceRenderer
- InputController
- AnimationManager
- AIPlayer
- AudioManager
- UIManager

Use strict TypeScript types.

Keep the authoritative game state independent of the Three.js scene graph.

Represent actions explicitly, for example:

- FLIP
- MOVE
- CAPTURE
- RESIGN

The rules engine must expose functions for:

- Generating legal actions
- Validating actions
- Applying actions
- Detecting game termination
- Determining the current player

Animations must reflect committed game-state transitions, not independently modify the logical board.

Use deterministic, seedable shuffling for testing.

## 10. Testing

Add automated tests for the rules engine.

Cover at least:

- Correct initial piece counts
- Randomized setup
- First-flip color assignment
- Alternating turns
- Valid and invalid movement
- Capture rank restrictions
- Soldier capturing General
- General being unable to capture Soldier
- Cannon capture with exactly one screen
- Cannon capture across multiple empty squares
- Cannons being unable to capture without a screen
- Hidden pieces blocking ordinary movement
- Hidden pieces acting as Cannon screens
- Win conditions
- Draw handling
- Undo behavior

Ensure the game builds without TypeScript errors.

## 11. Polish and User Experience

Pay particular attention to small details:

- Beautiful opening camera animation
- Smooth transitions between menus and gameplay
- Clear indicators for selected pieces
- Elegant victory and defeat overlays
- Optional subtle particle effects after captures
- Animated hover states
- Polished buttons
- Attractive loading screen
- No distracting visual clutter

Add keyboard shortcuts where sensible.

Include accessibility considerations such as readable text, non-color-only indicators, and an option to reduce motion.

## 12. Deliverables

Produce a complete project that can be launched locally.

Include:

1. All required source files.
2. package.json and dependencies.
3. Vite configuration.
4. Clean project structure.
5. Full game implementation.
6. Automated rules tests.
7. README with setup instructions.
8. Production build instructions.

The application should run using:

```bash
npm install
npm run dev
```

## 13. Execution Requirements

Follow this development sequence:

**Phase 1: Foundation**
- Initialize the project.
- Implement board state, pieces, game turns, and rules.
- Write rules-engine tests.

**Phase 2: 3D Board**
- Render the board and pieces.
- Implement camera, lights, and shadows.
- Implement mouse and touch picking.

**Phase 3: Gameplay**
- Connect interactions to the rules engine.
- Implement selecting, flipping, moving, and capturing.
- Implement endgame logic.

**Phase 4: Game Modes**
- Implement local multiplayer.
- Implement the AI opponent.

**Phase 5: Polish**
- Add animations.
- Add sounds.
- Add UI, menus, tutorial, and settings.

**Phase 6: Verification**
- Run TypeScript checks.
- Run automated tests.
- Run a production build.
- Fix errors and broken interactions.
- Verify a complete game can be played from start to finish.

Prioritize functional correctness and polished interaction over excessive decoration.

If a feature proves difficult, simplify its implementation without leaving the game broken.

## Final Quality Bar

The finished result should feel like a small, commercially polished indie board game.

I want to open the browser and immediately see a beautiful Chinese chessboard with tactile wooden pieces, realistic lighting, fluid interactions, and a fully working Banqi game.

**Build the game. Do not just describe how to build it.**
