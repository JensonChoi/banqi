import './style.css';
import { createGame, legalActions, applyAction, describe, undoCount, undoActions, symbols, ranks, counts, type GameState, type Action, type Entry } from './rules';
import { observe, type Difficulty } from './ai';
import { BoardRenderer } from './renderer';
import { AudioManager } from './audio';
interface Preferences {
    sound: boolean;
    motion: boolean;
    difficulty: Difficulty;
    undo: boolean;
    repetition: number;
    quietLimit: number;
}
const defaults: Preferences = {
    sound: true, motion: matchMedia('(prefers-reduced-motion: reduce)').matches, difficulty: 'medium', undo: false, repetition: 3, quietLimit: 80
};
let prefs = {
    ...defaults
};
try {
    const stored = JSON.parse(localStorage.getItem('banqi.preferences') ?? '{}');
    for (const key of ['sound', 'motion', 'undo'] as const)
        if (typeof stored[key] === 'boolean')
            prefs[key] = stored[key];
    if (['easy', 'medium', 'hard'].includes(stored.difficulty))
        prefs.difficulty = stored.difficulty;
    if ([0, 3, 5].includes(stored.repetition))
        prefs.repetition = stored.repetition;
    if ([0, 80, 120].includes(stored.quietLimit))
        prefs.quietLimit = stored.quietLimit;
}
catch {
}
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header class="topbar"><a class="brand" href="#" aria-label="Banqi main menu"><span class="brand-seal">暗</span><span>BANQI<small>CHINESE DARK CHESS</small></span></a><div class="edition">THE TABLETOP COLLECTION <span>／ 01</span></div><div class="top-actions"><button id="help" class="icon-button" aria-label="How to play">?</button><button id="settings" class="icon-button" aria-label="Settings">⚙</button></div></header>
<main><section class="game-heading"><div><div class="eyebrow" id="mode-label">A GAME OF REVELATION</div><h1 id="headline">Every piece holds a possibility.</h1></div><div class="table-label"><span class="status-dot"></span> <span id="status">YOUR TABLE IS READY</span></div></section>
<div class="play-layout"><aside class="player-panel"><div class="player-card" id="player-1"></div><div class="tray-section"><div class="eyebrow">CAPTURED RED</div><div id="red-tray" class="tray"></div></div><div class="sidebar-note"><span>暗棋</span><p>A little strategy.<br>A little mystery.</p></div></aside><section class="board-column"><div id="board" aria-label="Three-dimensional Banqi board"><div class="board-corner top-left">八 · FOUR BY EIGHT</div><div class="board-corner bottom-right">知己知彼</div><div id="loading">Preparing your table…</div></div><div class="board-caption"><span id="hint">32 pieces. Two colors. An unfolding story.</span><button id="camera" class="text-button">↻ Reset view</button></div><div class="turn-strip"><span class="turn-dash"></span><span id="turn-message" aria-live="polite">Choose a game to begin</span><span id="turn-count">TURN 01</span></div><div id="keyboard-board" class="sr-only" role="group" aria-label="Keyboard game board. Use arrow keys and Enter to play."></div></section><aside class="right-panel"><div class="player-card" id="player-0"></div><div class="tray-section"><div class="eyebrow">CAPTURED BLACK</div><div id="black-tray" class="tray"></div></div><div class="history-header"><span class="eyebrow">THE STORY SO FAR</span><span id="history-count">0</span></div><ol id="history"><li class="history-empty">Every game begins<br>with a little unknown.</li></ol></aside></div>
<footer class="game-controls"><div><button id="new-game">＋ New game</button><button id="restart">↻ Restart</button><button id="undo" disabled>↶ Undo</button></div><div><button id="sound">♪ Sound on</button><button id="resign">Resign</button><button id="exit">Exit to menu ↗</button></div></footer><div class="bottom-note"><span>TAKE YOUR TIME. MAKE YOUR MOVE.</span><span>Crafted for a quieter kind of competition.</span></div></main>
<div id="toast" role="status"></div><dialog id="dialog"><div id="dialog-content"></div></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let state = createGame(crypto.getRandomValues(new Uint32Array(1))[0]), history: Entry[] = [], mode: 'ai' | 'local' = 'ai', active = false, busy = false, selected: number | null = null, last: number | null = null, generation = 0, worker: Worker | null = null, pending = false;
document.documentElement.dataset.reduceMotion = String(prefs.motion);
const audio = new AudioManager();
audio.enabled = prefs.sound;
let renderer: BoardRenderer | null = null;
try {
    renderer = new BoardRenderer($('board'), pick, prefs.motion);
    renderer.reduced = prefs.motion;
    renderer.sync(state);
    $('loading').remove();
}
catch {
    $('loading').textContent = 'This game needs WebGL. Enable hardware acceleration or try another browser.';
}
const dialog = $<HTMLDialogElement>('dialog');
function save() {
    document.documentElement.dataset.reduceMotion = String(prefs.motion);
    try {
        localStorage.setItem('banqi.preferences', JSON.stringify(prefs));
    }
    catch {
    }
    audio.enabled = prefs.sound;
    if (renderer)
        renderer.reduced = prefs.motion;
    render();
}
function toast(message: string) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    setTimeout(() => $('toast').classList.remove('visible'), 2600);
}
function cancelAI() {
    worker?.terminate();
    worker = null;
    pending = false;
}
function show(content: string) {
    $('dialog-content').innerHTML = content;
    if (!dialog.open)
        dialog.showModal();
    $('dialog-content').querySelectorAll<HTMLElement>('[data-close]').forEach(b => b.onclick = () => dialog.close());
}
function close() {
    dialog.close();
}
function playerName(p: number) {
    return mode === 'local' ? `Player ${p + 1}` : p === 0 ? 'You' : 'The house';
}
function menu() {
    show(`<div class="menu-content"><div class="eyebrow">THE ART OF THE UNKNOWN</div><div class="menu-symbol">暗棋</div><h2 class="menu-title">BANQI</h2><p class="menu-subtitle">Chinese Dark Chess</p><p class="menu-copy">Reveal your fortune.<br>Find your next move.</p><button class="primary wide" id="play-ai">Play vs AI <span>→</span></button><button class="secondary wide" id="play-local">Local multiplayer <span>↗</span></button><div class="menu-links"><button id="menu-help">How to play</button><span>·</span><button id="menu-settings">Settings</button>${active ? '<button data-close>Resume</button>' : ''}</div><div class="menu-foot">TWO PLAYERS · THIRTY-TWO POSSIBILITIES</div></div>`);
    $('play-ai').onclick = () => {
        mode = 'ai';
        start();
    };
    $('play-local').onclick = () => {
        mode = 'local';
        start();
    };
    $('menu-help').onclick = () => help(true);
    $('menu-settings').onclick = () => settings(true);
}
function confirmAbandon(next: () => void) {
    if (busy) {
        toast('Let the piece settle before leaving the table.');
        return;
    }
    if (active && !state.outcome && state.ply > 0) {
        show(`<div class="eyebrow">LEAVE THIS GAME?</div><h2>A new beginning?</h2><p>Your current game will be lost.</p><div class="dialog-actions"><button data-close>Keep playing</button><button id="confirm" class="primary">Continue</button></div>`);
        $('confirm').onclick = () => {
            close();
            next();
        };
    }
    else
        next();
}
function start() {
    generation++;
    cancelAI();
    renderer?.cancelAnimation();
    state = createGame(crypto.getRandomValues(new Uint32Array(1))[0], {
        repetition: prefs.repetition, quietLimit: prefs.quietLimit
    });
    history = [];
    selected = null;
    last = null;
    active = true;
    busy = false;
    close();
    renderer?.sync(state);
    renderer?.reset();
    render();
    audio.play('select');
}
function render() {
    const actions = selected === null ? [] : legalActions(state).filter(a => (a.type === 'MOVE' || a.type === 'CAPTURE') && a.from === selected);
    renderer?.highlight(selected, actions, last);
    for (const p of [0, 1] as const) {
        const color = state.colors[p], remaining = state.board.filter(x => x && (!color || x.color === color)).length;
        const card = $(`player-${p}`);
        card.className = `player-card ${active && !state.outcome && state.turn === p ? 'active' : ''}`;
        card.innerHTML = `<div class="player-meta"><span>${p === 0 ? '01' : '02'} / ${mode === 'ai' && p === 1 ? 'OPPONENT' : 'PLAYER'}</span><span class="player-active">${active && state.turn === p && !state.outcome ? '● ACTIVE' : '○'}</span></div><div class="player-identity"><div class="avatar ${color ?? ''}">${color ? (color === 'red' ? '帥' : '將') : '?'}</div><div><h3>${playerName(p)}</h3><p>${color ? `${color[0].toUpperCase() + color.slice(1)} pieces` : 'Color unrevealed'}</p></div></div><div class="player-stats"><span>${color ? `${remaining} remaining` : 'Awaiting first flip'}</span><span>${mode === 'ai' && p === 1 ? prefs.difficulty.toUpperCase() : color ? '● ' + color.toUpperCase() : '—'}</span></div>`;
    }
    for (const color of ['red', 'black'] as const) {
        const captured = state.captured.filter(p => p.color === color);
        $(`${color}-tray`).previousElementSibling!.textContent = `CAPTURED ${color.toUpperCase()} · ${captured.length}`;
        $(`${color}-tray`).innerHTML = captured.length ? captured.map(p => `<span class="mini-piece ${color}" title="${color} ${p.rank}">${symbols[color][p.rank]}</span>`).join('') : '<span class="empty-tray">— &nbsp; None yet &nbsp; —</span>';
    }
    $('mode-label').textContent = active ? mode === 'ai' ? `SOLO TABLE / ${prefs.difficulty.toUpperCase()}` : 'LOCAL TABLE / TWO PLAYERS' : 'A GAME OF REVELATION';
    $('headline').textContent = active ? 'The next move is yours.' : 'Every piece holds a possibility.';
    $('status').textContent = state.outcome ? 'GAME COMPLETE' : active ? pending ? 'THE HOUSE IS THINKING' : 'GAME IN PROGRESS' : 'YOUR TABLE IS READY';
    $('turn-count').textContent = `TURN ${String(state.ply + 1).padStart(2, '0')}`;
    $('turn-message').textContent = state.outcome ? state.outcome.winner === null ? 'A well-played draw.' : `${playerName(state.outcome.winner)} won the game.` : !active ? 'Choose a game to begin' : pending ? 'The house is considering its move…' : `${playerName(state.turn)} to play${state.colors[state.turn] ? ` · ${state.colors[state.turn]}` : ' · reveal a piece to find your color'}`;
    $('hint').textContent = selected !== null ? 'Choose a marked square to move or capture.' : active ? 'Tap to reveal. Select your piece to move. Drag to look around.' : '32 pieces. Two colors. An unfolding story.';
    $('history-count').textContent = String(history.length);
    $('history').innerHTML = history.length ? history.map((e, i) => `<li><span class="move-number">${String(i + 1).padStart(2, '0')}</span><span>${describe(e.action, e.before)}</span><span class="history-dot ${e.before.colors[e.before.turn] ?? ''}"></span></li>`).reverse().join('') : '<li class="history-empty">Every game begins<br>with a little unknown.</li>';
    $<HTMLButtonElement>('undo').disabled = !active || busy || pending || !prefs.undo || !undoCount(history, mode === 'ai') || !!state.outcome;
    $('undo').title = !prefs.undo ? 'Enable safe undo in Settings' : 'Undo cannot cross a reveal or resignation';
    for (const id of ['restart', 'resign'])
        $<HTMLButtonElement>(id).disabled = !active || busy || pending || !!state.outcome;
    $('sound').textContent = prefs.sound ? '♪ Sound on' : '♪ Sound off';
    const kb = $('keyboard-board');
    if (!kb.children.length) {
        for (let i = 0; i < 32; i++) {
            const b = document.createElement('button');
            b.onclick = () => pick(i);
            b.onfocus = () => {
                if (active && !busy) {
                    renderer?.highlight(selected, selected === null ? [] : legalActions(state).filter(a => (a.type === 'MOVE' || a.type === 'CAPTURE') && a.from === selected), i);
                }
            };
            b.onkeydown = e => {
                const d: Record<string, number> = {
                    ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8
                };
                if (e.key in d) {
                    e.preventDefault();
                    const to = Math.max(0, Math.min(31, i + d[e.key]));
                    (kb.children[to] as HTMLElement).focus();
                }
            };
            kb.append(b);
        }
    }
    state.board.forEach((p, i) => {
        const b = kb.children[i] as HTMLButtonElement;
        b.textContent = `${'ABCDEFGH'[i % 8]}${Math.floor(i / 8) + 1}: ${!p ? 'empty' : !p.revealed ? 'hidden piece' : `${p.color} ${p.rank}`}`;
        b.setAttribute('aria-pressed', String(i === selected));
        b.tabIndex = i === 0 ? 0 : -1;
    });
}
function pick(i: number) {
    if (!active || busy || pending || state.outcome || dialog.open)
        return;
    if (i < 0) {
        selected = null;
        render();
        return;
    }
    const p = state.board[i], actions = legalActions(state);
    if (selected !== null) {
        const a = actions.find(a => (a.type === 'MOVE' || a.type === 'CAPTURE') && a.from === selected && a.to === i);
        if (a) {
            void commit(a);
            return;
        }
    }
    if (p && !p.revealed) {
        void commit({
            type: 'FLIP', at: i
        });
        return;
    }
    if (p && p.color === state.colors[state.turn]) {
        selected = selected === i ? null : i;
        audio.play('select');
        render();
        return;
    }
    selected = null;
    audio.play('invalid');
    toast(p ? 'Choose one of your own revealed pieces.' : 'Select a piece before choosing a destination.');
    render();
}
async function commit(a: Action) {
    if (busy)
        return;
    const token = generation;
    busy = true;
    selected = null;
    const before = state;
    try {
        state = applyAction(before, a);
    }
    catch {
        busy = false;
        toast('That move is not available.');
        return;
    }
    history.push({
        before, action: a
    });
    last = a.type === 'FLIP' ? a.at : a.type === 'RESIGN' ? null : a.to;
    render();
    audio.play(a.type === 'FLIP' ? 'flip' : a.type === 'CAPTURE' ? 'capture' : 'move');
    if (renderer)
        await renderer.animate(before, state, a);
    if (token !== generation) {
        renderer?.sync(state);
        return;
    }
    busy = false;
    render();
    if (state.outcome) {
        audio.play('win');
        showOutcome();
    }
    else
        scheduleAI();
}
function scheduleAI() {
    if (!active || mode !== 'ai' || state.turn !== 1 || state.outcome || pending)
        return;
    pending = true;
    render();
    const token = generation;
    const fallback = () => {
        if (token !== generation)
            return;
        cancelAI();
        toast('The house is using a quick fallback move.');
        const action = legalActions(state)[0];
        if (action)
            void commit(action);
    };
    try {
        worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {
            type: 'module'
        });
    }
    catch {
        fallback();
        return;
    }
    worker.onerror = fallback;
    worker.onmessage = e => {
        if (token !== generation)
            return;
        const action = e.data.action as Action | undefined;
        cancelAI();
        if (action)
            void commit(action);
        else
            fallback();
    };
    worker.postMessage({
        observation: observe(state), difficulty: prefs.difficulty, seed: crypto.getRandomValues(new Uint32Array(1))[0]
    });
}
function showOutcome() {
    const o = state.outcome!;
    show(`<div class="outcome-symbol">${o.winner === null ? '和' : '勝'}</div><div class="eyebrow">THE TABLE FALLS QUIET</div><h2>${o.winner === null ? 'An honorable draw.' : `${playerName(o.winner)} ${mode === 'ai' && o.winner === 0 ? 'win' : 'wins'}.`}</h2><p>${o.reason}.<br>${state.ply} turns. A story well played.</p><div class="dialog-actions"><button data-close>Review board</button><button class="primary" id="again">Play again →</button></div>`);
    $('again').onclick = start;
}
function settings(fromMenu = false) {
    show(`<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>Your table, your way.</h2><label class="setting">Sound effects<input id="setting-sound" type="checkbox" ${prefs.sound ? 'checked' : ''}></label><label class="setting">Reduce motion<input id="setting-motion" type="checkbox" ${prefs.motion ? 'checked' : ''}></label><label class="setting">Safe undo<input id="setting-undo" type="checkbox" ${prefs.undo ? 'checked' : ''}></label><p class="setting-note">Undo never crosses a reveal. Against AI, it takes back a full round. No undo after the game ends.</p><label class="setting">AI difficulty<select id="setting-difficulty">${['easy', 'medium', 'hard'].map(x => `<option ${prefs.difficulty === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="setting">Repeated positions<select id="setting-repetition">${[3, 5, 0].map(x => `<option value="${x}" ${prefs.repetition === x ? 'selected' : ''}>${x ? `${x} repetitions` : 'Disabled'}</option>`).join('')}</select></label><label class="setting">Turns without capture or reveal<select id="setting-quiet">${[80, 120, 0].map(x => `<option value="${x}" ${prefs.quietLimit === x ? 'selected' : ''}>${x || 'Disabled'}</option>`).join('')}</select></label><p class="setting-note">Draw settings apply to the next game. Hard AI searches possibilities using only public information.</p><button class="primary wide" id="save-settings">Save settings</button>`);
    $('save-settings').onclick = () => {
        prefs.sound = $<HTMLInputElement>('setting-sound').checked;
        prefs.motion = $<HTMLInputElement>('setting-motion').checked;
        prefs.undo = $<HTMLInputElement>('setting-undo').checked;
        prefs.difficulty = $<HTMLSelectElement>('setting-difficulty').value as Difficulty;
        prefs.repetition = Number($<HTMLSelectElement>('setting-repetition').value);
        prefs.quietLimit = Number($<HTMLSelectElement>('setting-quiet').value);
        save();
        close();
        if (fromMenu)
            menu();
    };
}
function help(fromMenu = false) {
    show(`<div class="eyebrow">A MOMENT TO LEARN. A LIFETIME TO MASTER.</div><h2>The art of Banqi.</h2><p>Two players share 32 hidden pieces. The first reveal assigns your color. Each turn, reveal any hidden piece, move, or capture.</p><div class="guide-grid"><section><h3>01 / Reveal</h3><p>Tap a face-down piece. Either player may reveal any hidden piece, even one belonging to the other color.</p></section><section><h3>02 / Move</h3><p>Move a revealed piece one square horizontally or vertically into an empty square. Never diagonally.</p></section></div><h3>The capture hierarchy</h3><div class="hierarchy">${ranks.map((r, i) => `<div><span>${symbols.red[r]}</span><b>${r}</b><small>× ${counts[i]}</small></div>`).join('')}</div><p>A piece captures an adjacent enemy of equal or lower rank. <strong>Soldiers capture Generals; Generals cannot capture Soldiers.</strong> Soldiers cannot capture Cannons.</p><div class="cannon-example"><span>炮</span><i>—</i><span class="screen-piece">?</span><i>— —</i><span>將</span></div><h3>The Cannon’s exception</h3><p>Cannons capture any revealed enemy along a row or column by jumping over <strong>exactly one piece</strong>. The screen may be hidden or revealed, of either color. Without a screen, a Cannon cannot capture.</p><h3>Finding the finish</h3><p>Win by capturing all opposing pieces, including those still hidden, or leaving your opponent without a legal action. Hidden pieces always remain available to flip. Repetition and quiet-turn limits can end a game in a draw.</p><p class="setting-note">Drag to orbit · Scroll or pinch to zoom · Arrow keys navigate the accessible board · Enter to act · Escape to deselect</p><button class="primary wide" id="help-done">Back to the table</button>`);
    $('help-done').onclick = () => {
        close();
        if (fromMenu)
            menu();
    };
}
$('new-game').onclick = () => confirmAbandon(menu);
$('restart').onclick = () => confirmAbandon(start);
$('exit').onclick = () => confirmAbandon(() => {
    generation++;
    cancelAI();
    active = false;
    render();
    menu();
});
document.querySelector<HTMLAnchorElement>('.brand')!.onclick = e => {
    e.preventDefault();
    confirmAbandon(menu);
};
$('undo').onclick = () => {
    const n = undoCount(history, mode === 'ai');
    if (!prefs.undo || !n || busy || pending || state.outcome)
        return;
    const restored = undoActions(state, history, mode === 'ai');
    state = restored.state;
    history = restored.history;
    last = null;
    selected = null;
    renderer?.sync(state);
    render();
    toast('Move taken back. No hidden information changed.');
};
$('camera').onclick = () => renderer?.reset();
$('sound').onclick = () => {
    prefs.sound = !prefs.sound;
    save();
    audio.play('select');
};
$('help').onclick = () => help();
$('settings').onclick = () => settings();
$('resign').onclick = () => {
    show(`<div class="eyebrow">CONCEDE THE TABLE</div><h2>Resign this game?</h2><p>${playerName(1 - state.turn)} will win.</p><div class="dialog-actions"><button data-close>Keep playing</button><button class="primary" id="confirm-resign">Resign</button></div>`);
    $('confirm-resign').onclick = () => {
        close();
        void commit({
            type: 'RESIGN'
        });
    };
};
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        selected = null;
        render();
    }
});
window.addEventListener('beforeunload', () => {
    cancelAI();
    renderer?.dispose();
    audio.dispose();
});
render();
menu();
