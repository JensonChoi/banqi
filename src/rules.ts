export type Color = 'red' | 'black';
export type Rank = 'general' | 'advisor' | 'elephant' | 'chariot' | 'horse' | 'cannon' | 'soldier';
export type Player = 0 | 1;
export interface Piece {
    id: string;
    color: Color;
    rank: Rank;
    revealed: boolean;
}
export type Action = {
    type: 'FLIP';
    at: number;
} | {
    type: 'MOVE' | 'CAPTURE';
    from: number;
    to: number;
} | {
    type: 'RESIGN';
};
export interface RulesConfig {
    repetition: number;
    quietLimit: number;
}
export interface Outcome {
    winner: Player | null;
    reason: string;
}
export interface GameState {
    board: (Piece | null)[];
    turn: Player;
    colors: [
        Color | null,
        Color | null
    ];
    ply: number;
    captured: Piece[];
    quiet: number;
    repetitions: Record<string, number>;
    config: RulesConfig;
    outcome: Outcome | null;
}
export const ranks: Rank[] = ['general', 'advisor', 'elephant', 'chariot', 'horse', 'cannon', 'soldier'];
export const counts = [1, 2, 2, 2, 2, 2, 5];
export const symbols: Record<Color, Record<Rank, string>> = {
    red: {
        general: '帥', advisor: '仕', elephant: '相', chariot: '俥', horse: '傌', cannon: '炮', soldier: '兵'
    }, black: {
        general: '將', advisor: '士', elephant: '象', chariot: '車', horse: '馬', cannon: '砲', soldier: '卒'
    }
};
export const opposite = (c: Color): Color => c === 'red' ? 'black' : 'red';
export function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a += 0x6D2B79F5;
        let t = a;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
export function pieces(): Piece[] {
    return (['red', 'black'] as Color[]).flatMap(color => ranks.flatMap((rank, i) => Array.from({
        length: counts[i]
    }, (_, n) => ({
        id: `${color}-${rank}-${n}`, color, rank, revealed: false
    }))));
}
export function positionKey(s: GameState): string {
    return `${s.turn}:${s.colors.join(',')}:` + s.board.map(p => !p ? '.' : !p.revealed ? '?' : `${p.color[0]}${ranks.indexOf(p.rank)}`).join('|');
}
export function createGame(seed: number, config: RulesConfig = {
    repetition: 3, quietLimit: 80
}): GameState {
    const board = pieces(), rng = random(seed);
    for (let i = 31; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [board[i], board[j]] = [board[j], board[i]];
    }
    const s: GameState = {
        board, turn: 0, colors: [null, null], ply: 0, captured: [], quiet: 0, repetitions: {}, config: {
            ...config
        }, outcome: null
    };
    s.repetitions[positionKey(s)] = 1;
    return s;
}
export function adjacent(a: number, b: number): boolean {
    return Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) + Math.abs(a % 8 - b % 8) === 1;
}
export function canCapture(s: GameState, from: number, to: number): boolean {
    const p = s.board[from], q = s.board[to];
    if (!p?.revealed || !q?.revealed || p.color === q.color)
        return false;
    if (p.rank === 'cannon') {
        if (from === to)
            return false;
        const step = Math.floor(from / 8) === Math.floor(to / 8) ? 1 : from % 8 === to % 8 ? 8 : 0;
        if (!step)
            return false;
        let screens = 0;
        for (let i = Math.min(from, to) + step; i < Math.max(from, to); i += step)
            if (s.board[i])
                screens++;
        return screens === 1;
    }
    if (!adjacent(from, to))
        return false;
    if (p.rank === 'soldier')
        return q.rank === 'soldier' || q.rank === 'general';
    if (p.rank === 'general' && q.rank === 'soldier')
        return false;
    return ranks.indexOf(p.rank) <= ranks.indexOf(q.rank);
}
export function legalActions(s: GameState): Action[] {
    if (s.outcome)
        return [];
    const actions: Action[] = [];
    s.board.forEach((p, from) => {
        if (!p)
            return;
        if (!p.revealed) {
            actions.push({
                type: 'FLIP', at: from
            });
            return;
        }
        if (p.color !== s.colors[s.turn])
            return;
        for (let to = 0; to < 32; to++) {
            if (!s.board[to] && adjacent(from, to))
                actions.push({
                    type: 'MOVE', from, to
                });
            else if (canCapture(s, from, to))
                actions.push({
                    type: 'CAPTURE', from, to
                });
        }
    });
    return actions;
}
export function isLegal(s: GameState, a: Action): boolean {
    return !s.outcome && (a.type === 'RESIGN' || legalActions(s).some(b => a.type === b.type && (a.type === 'FLIP' && b.type === 'FLIP' ? a.at === b.at : (a.type === 'MOVE' || a.type === 'CAPTURE') && (b.type === 'MOVE' || b.type === 'CAPTURE') && a.from === b.from && a.to === b.to)));
}
export function termination(s: GameState): Outcome | null {
    if (s.colors[0]) {
        for (const player of [0, 1] as Player[])
            if (!s.board.some(p => p?.color === s.colors[player]))
                return {
                    winner: (1 - player) as Player, reason: 'All opposing pieces captured'
                };
    }
    if (!legalActions({
        ...s, outcome: null
    }).length)
        return {
            winner: (1 - s.turn) as Player, reason: 'No legal actions remain'
        };
    if (s.config.repetition > 0 && (s.repetitions[positionKey(s)] ?? 0) >= s.config.repetition)
        return {
            winner: null, reason: 'Repeated position'
        };
    if (s.config.quietLimit > 0 && s.quiet >= s.config.quietLimit)
        return {
            winner: null, reason: `${s.config.quietLimit} turns without a capture or reveal`
        };
    return null;
}
export function applyAction(s: GameState, a: Action): GameState {
    if (!isLegal(s, a))
        throw new Error('Illegal action');
    const n: GameState = {
        ...s, board: s.board.map(p => p ? {
            ...p
        } : null), colors: [...s.colors], captured: [...s.captured], repetitions: {
            ...s.repetitions
        }, ply: s.ply + 1
    };
    if (a.type === 'RESIGN') {
        n.outcome = {
            winner: (1 - s.turn) as Player, reason: 'Resignation'
        };
        return n;
    }
    if (a.type === 'FLIP') {
        const p = n.board[a.at]!;
        p.revealed = true;
        if (!n.colors[0])
            n.colors = [p.color, opposite(p.color)];
        n.quiet = 0;
    }
    else {
        if (a.type === 'CAPTURE')
            n.captured.push(n.board[a.to]!);
        n.board[a.to] = n.board[a.from];
        n.board[a.from] = null;
        n.quiet = a.type === 'CAPTURE' ? 0 : s.quiet + 1;
    }
    n.turn = (1 - s.turn) as Player;
    const key = positionKey(n);
    n.repetitions[key] = (n.repetitions[key] ?? 0) + 1;
    n.outcome = termination(n);
    return n;
}
export interface Entry {
    before: GameState;
    action: Action;
}
export function undoCount(history: Entry[], ai: boolean): number {
    const count = ai ? 2 : 1;
    if (history.length < count)
        return 0;
    return history.slice(-count).some(e => e.action.type === 'FLIP' || e.action.type === 'RESIGN') ? 0 : count;
}
export function describe(a: Action, before: GameState): string {
    const coord = (n: number) => `${'ABCDEFGH'[n % 8]}${Math.floor(n / 8) + 1}`;
    if (a.type === 'RESIGN')
        return 'Resigned';
    if (a.type === 'FLIP') {
        const p = before.board[a.at]!;
        return `Revealed ${symbols[p.color][p.rank]} · ${coord(a.at)}`;
    }
    const p = before.board[a.from]!;
    return `${symbols[p.color][p.rank]} ${coord(a.from)} ${a.type === 'CAPTURE' ? '×' : '→'} ${coord(a.to)}`;
}
export const currentPlayer = (state: GameState): Player => state.turn;
export function undoActions(state: GameState, history: Entry[], ai: boolean): {
    state: GameState;
    history: Entry[];
} {
    const n = state.outcome ? 0 : undoCount(history, ai);
    return n ? {
        state: history[history.length - n].before, history: history.slice(0, -n)
    } : {
        state, history
    };
}
