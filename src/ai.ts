import { type Action, type Color, type GameState, type Piece, type Rank, applyAction, legalActions, pieces, random, positionKey } from './rules.ts';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Observation {
    board: (Omit<Piece, 'id'> | 'hidden' | null)[];
    turn: 0 | 1;
    colors: GameState['colors'];
    captured: Piece[];
    unseen: {
        color: Color;
        rank: Rank;
        count: number;
    }[];
    ply: number;
    quiet: number;
    config: GameState['config'];
    repetitions: Record<string, number>;
}
export function observe(s: GameState): Observation {
    const unseen = pieces().reduce<Observation['unseen']>((all, p) => {
        let row = all.find(x => x.color === p.color && x.rank === p.rank);
        if (!row) {
            row = {
                color: p.color, rank: p.rank, count: 0
            };
            all.push(row);
        }
        row.count++;
        return all;
    }, []);
    for (const p of [...s.board.filter((p): p is Piece => !!p?.revealed), ...s.captured])
        unseen.find(x => x.color === p.color && x.rank === p.rank)!.count--;
    return {
        board: s.board.map(p => !p ? null : p.revealed ? {
            color: p.color, rank: p.rank, revealed: true
        } : 'hidden'), turn: s.turn, colors: [...s.colors], captured: s.captured.map(p => ({
            ...p
        })), unseen, ply: s.ply, quiet: s.quiet, config: {
            ...s.config
        }, repetitions: {
            ...s.repetitions
        }
    };
}
const values: Record<Rank, number> = {
    general: 65, advisor: 45, elephant: 35, chariot: 28, horse: 22, cannon: 38, soldier: 15
};
function material(o: Observation, rng: () => number): GameState {
    const bag = o.unseen.flatMap(p => Array.from({
        length: p.count
    }, () => ({
        color: p.color, rank: p.rank, revealed: false
    })));
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return {
        ...o, board: o.board.map((p, i) => p ? {
            ...(p === 'hidden' ? bag.pop()! : p), id: `simulation-${i}`
        } : null), outcome: null
    };
}
function evaluate(s: GameState, side: 0 | 1): number {
    if (s.outcome)
        return s.outcome.winner === null ? 0 : s.outcome.winner === side ? 10000 : -10000;
    const color = s.colors[side];
    if (!color)
        return 0;
    let score = 0;
    s.board.forEach((p, i) => {
        if (p?.revealed)
            score += (p.color === color ? 1 : -1) * (values[p.rank] + (3.5 - Math.abs(i % 8 - 3.5)) * .4);
    });
    const actions = legalActions(s);
    const sign = s.turn === side ? 1 : -1;
    score += sign * actions.filter(a => a.type === 'MOVE').length * .15;
    const captures = actions.filter((a): a is Extract<Action, {
        type: 'MOVE' | 'CAPTURE';
    }> => a.type === 'CAPTURE');
    score += sign * Math.max(0, ...captures.map(a => values[s.board[a.to]!.rank] * .45));
    return score;
}
export function chooseAction(o: Observation, difficulty: Difficulty, seed = 1, budget = 600): Action {
    const rng = random(seed), base = material(o, rng), actions = legalActions(base);
    if (!actions.length)
        throw new Error('No AI action available');
    if (difficulty === 'easy') {
        const captures = actions.filter(a => a.type === 'CAPTURE');
        return captures.length && rng() < .7 ? captures[Math.floor(rng() * captures.length)] : actions[Math.floor(rng() * actions.length)];
    }
    const end = performance.now() + budget, side = o.turn;
    function outcomes(s: GameState, a: Action): GameState[] {
        if (a.type !== 'FLIP')
            return [applyAction(s, a)];
        const publicState = observe(s);
        return Array.from({
            length: 4
        }, () => applyAction(material(publicState, rng), a));
    }
    function immediate(s: GameState, a: Action): number {
        if (a.type === 'FLIP')
            return 1;
        const next = applyAction(s, a);
        return evaluate(next, side);
    }
    function search(s: GameState, depth: number): number {
        if (depth === 0 || s.outcome || performance.now() > end)
            return evaluate(s, side);
        const maximizing = s.turn === side;
        const candidates = legalActions(s).map(a => ({
            a, v: immediate(s, a)
        })).sort((a, b) => maximizing ? b.v - a.v : a.v - b.v).slice(0, 12);
        if (!candidates.length)
            return evaluate(s, side);
        return (maximizing ? Math.max : Math.min)(...candidates.map(({ a }) => {
            const ns = outcomes(s, a);
            return ns.reduce((v, n) => v + search(n, depth - 1), 0) / ns.length;
        }));
    }
    let best = actions[0];
    const ordered = actions.map(a => ({
        a, v: a.type === 'FLIP' ? 1 + rng() * .5 : immediate(base, a)
    })).sort((a, b) => b.v - a.v);
    best = ordered[0].a;
    if (difficulty === 'medium') {
        let score = -Infinity;
        for (const { a } of ordered) {
            const ns = outcomes(base, a);
            const v = ns.reduce((sum, n) => sum + search(n, 1), 0) / ns.length;
            if (v > score) {
                score = v;
                best = a;
            }
        }
        return best;
    }
    for (let depth = 1; depth <= 3; depth++) {
        let candidate = best, value = -Infinity, complete = true;
        for (const { a } of ordered) {
            if (performance.now() > end) {
                complete = false;
                break;
            }
            const ns = outcomes(base, a);
            const v = ns.reduce((sum, n) => sum + search(n, depth - 1), 0) / ns.length;
            if (v > value) {
                value = v;
                candidate = a;
            }
        }
        if (complete)
            best = candidate;
        else
            break;
    }
    return best;
}
