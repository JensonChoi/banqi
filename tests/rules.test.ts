import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, pieces, ranks, counts, applyAction, legalActions, isLegal, canCapture, termination, positionKey, undoCount, undoActions, type GameState, type Piece, type Rank, type Color, type Action } from '../src/rules.ts';
import { observe, chooseAction } from '../src/ai.ts';
function piece(rank: Rank, color: Color = 'red', revealed = true): Piece {
    return {
        id: `${color}-${rank}-${Math.random()}`, rank, color, revealed
    };
}
function board(entries: Record<number, Piece>): GameState {
    const s = createGame(1);
    s.board = Array(32).fill(null);
    for (const [i, p] of Object.entries(entries))
        s.board[Number(i)] = p;
    s.colors = ['red', 'black'];
    s.repetitions = {};
    return s;
}
test('initial deck has correct counts, unique ids, 32 hidden pieces', () => {
    const s = createGame(100);
    assert.equal(new Set(s.board.map(p => p!.id)).size, 32);
    for (const color of ['red', 'black'])
        ranks.forEach((rank, i) => assert.equal(s.board.filter(p => p!.color === color && p!.rank === rank).length, counts[i]));
    assert.ok(s.board.every(p => !p!.revealed));
    assert.equal(legalActions(s).length, 32);
});
test('shuffle is seeded and changes for different seeds', () => {
    assert.deepEqual(createGame(42), createGame(42));
    assert.notDeepEqual(createGame(42).board, createGame(43).board);
});
test('first flip assigns colors, preserves old state, alternates turns', () => {
    const s = createGame(7), n = applyAction(s, {
        type: 'FLIP', at: 9
    });
    assert.equal(n.colors[0], s.board[9]!.color);
    assert.notEqual(n.colors[0], n.colors[1]);
    assert.equal(n.turn, 1);
    assert.equal(n.ply, 1);
    assert.equal(s.board[9]!.revealed, false);
    assert.equal(applyAction(n, {
        type: 'FLIP', at: 8
    }).turn, 0);
});
test('orthogonal movement, board edges, and ownership', () => {
    const s = board({
        7: piece('horse'), 8: piece('horse', 'black'), 31: piece('soldier', 'black')
    });
    assert.ok(isLegal(s, {
        type: 'MOVE', from: 7, to: 6
    }));
    assert.ok(isLegal(s, {
        type: 'MOVE', from: 7, to: 15
    }));
    for (const a of [{
            type: 'MOVE', from: 7, to: 8
        }, {
            type: 'MOVE', from: 7, to: 14
        }, {
            type: 'MOVE', from: 8, to: 9
        }, {
            type: 'MOVE', from: 7, to: 9
        }] as Action[])
        assert.equal(isLegal(s, a), false);
});
test('all ordinary rank pairs follow hierarchy and exceptions', () => {
    for (const attacker of ranks.filter(r => r !== 'cannon'))
        for (const defender of ranks) {
            const s = board({
                0: piece(attacker), 1: piece(defender, 'black')
            });
            const expected = attacker === 'soldier' ? defender === 'soldier' || defender === 'general' : attacker === 'general' && defender === 'soldier' ? false : ranks.indexOf(attacker) <= ranks.indexOf(defender);
            assert.equal(canCapture(s, 0, 1), expected, `${attacker} captures ${defender}`);
        }
});
test('captures cannot take friendly or hidden pieces', () => {
    assert.equal(canCapture(board({
        0: piece('general'), 1: piece('horse')
    }), 0, 1), false);
    assert.equal(canCapture(board({
        0: piece('general'), 1: piece('horse', 'black', false)
    }), 0, 1), false);
});
test('hidden pieces block movement and cannot move', () => {
    const s = board({
        0: piece('general'), 1: piece('horse', 'black', false)
    });
    assert.equal(isLegal(s, {
        type: 'MOVE', from: 0, to: 1
    }), false);
    assert.equal(isLegal(s, {
        type: 'MOVE', from: 1, to: 2
    }), false);
    assert.equal(isLegal(s, {
        type: 'FLIP', at: 1
    }), true);
});
test('cannon captures along row and column over one screen and empty spaces', () => {
    for (const [target, screen] of [[7, 3], [24, 16]])
        for (const revealed of [true, false])
            for (const color of ['red', 'black'] as Color[]) {
                const s = board({
                    0: piece('cannon'), [screen]: piece('soldier', color, revealed), [target]: piece('general', 'black')
                });
                assert.equal(canCapture(s, 0, target), true);
                const n = applyAction(s, {
                    type: 'CAPTURE', from: 0, to: target
                });
                assert.equal(n.captured.length, 1);
                assert.equal(n.board[0], null);
                assert.equal(n.board[target]!.rank, 'cannon');
            }
});
test('cannon requires exactly one screen and a revealed enemy target', () => {
    assert.equal(canCapture(board({
        0: piece('cannon'), 7: piece('general', 'black')
    }), 0, 7), false);
    assert.equal(canCapture(board({
        0: piece('cannon'), 2: piece('soldier'), 4: piece('horse'), 7: piece('general', 'black')
    }), 0, 7), false);
    assert.equal(canCapture(board({
        0: piece('cannon'), 2: piece('soldier'), 7: piece('general', 'black', false)
    }), 0, 7), false);
    assert.equal(canCapture(board({
        0: piece('cannon'), 9: piece('general', 'black'), 1: piece('soldier')
    }), 0, 9), false);
});
test('cannon can move one step into empty squares but cannot capture adjacent target', () => {
    const s = board({
        0: piece('cannon'), 1: piece('soldier', 'black'), 31: piece('general', 'black')
    });
    assert.ok(isLegal(s, {
        type: 'MOVE', from: 0, to: 8
    }));
    assert.equal(canCapture(s, 0, 1), false);
    assert.equal(isLegal(s, {
        type: 'MOVE', from: 0, to: 16
    }), false);
});
test('elimination includes hidden pieces', () => {
    const s = board({
        0: piece('general'), 1: piece('horse', 'black'), 31: piece('soldier', 'black', false)
    });
    assert.equal(applyAction(s, {
        type: 'CAPTURE', from: 0, to: 1
    }).outcome, null);
    s.board[31] = null;
    assert.equal(applyAction(s, {
        type: 'CAPTURE', from: 0, to: 1
    }).outcome!.winner, 0);
});
test('no movement is not a loss while flips exist; no actions is a loss', () => {
    const s = board({
        0: piece('soldier'), 1: piece('horse', 'black'), 8: piece('horse', 'black'), 31: piece('soldier', 'black', false)
    });
    assert.equal(termination(s), null);
    s.board[31] = null;
    assert.equal(termination(s)!.winner, 1);
});
test('threefold repetition and quiet limits', () => {
    let s = board({
        0: piece('horse'), 31: piece('horse', 'black')
    });
    s.repetitions[positionKey(s)] = 1;
    const loop: Action[] = [{
            type: 'MOVE', from: 0, to: 1
        }, {
            type: 'MOVE', from: 31, to: 30
        }, {
            type: 'MOVE', from: 1, to: 0
        }, {
            type: 'MOVE', from: 30, to: 31
        }];
    for (let i = 0; i < 8; i++)
        s = applyAction(s, loop[i % 4]);
    assert.equal(s.outcome!.winner, null);
    assert.equal(s.outcome!.reason, 'Repeated position');
    const q = board({
        0: piece('horse'), 31: piece('horse', 'black')
    });
    q.quiet = 79;
    assert.equal(applyAction(q, {
        type: 'MOVE', from: 0, to: 1
    }).outcome!.winner, null);
    q.config = {
        repetition: 0, quietLimit: 0
    };
    assert.equal(applyAction(q, {
        type: 'MOVE', from: 0, to: 1
    }).outcome, null);
});
test('flips and captures reset quiet counter', () => {
    let s = board({
        0: piece('horse'), 1: piece('soldier', 'black'), 31: piece('horse', 'black', false)
    });
    s.quiet = 79;
    assert.equal(applyAction(s, {
        type: 'CAPTURE', from: 0, to: 1
    }).quiet, 0);
    assert.equal(applyAction(s, {
        type: 'FLIP', at: 31
    }).quiet, 0);
});
test('illegal actions do not mutate state; resignation ends game', () => {
    const s = createGame(10), copy = structuredClone(s);
    assert.throws(() => applyAction(s, {
        type: 'MOVE', from: 0, to: 1
    }));
    assert.deepEqual(s, copy);
    const n = applyAction(s, {
        type: 'RESIGN'
    });
    assert.equal(n.outcome!.winner, 1);
    assert.equal(legalActions(n).length, 0);
});
test('safe undo supports captures and complete AI rounds but never crosses a flip', () => {
    const s = createGame(10), move: Action = {
        type: 'MOVE', from: 0, to: 1
    }, capture: Action = {
        type: 'CAPTURE', from: 1, to: 2
    }, flip: Action = {
        type: 'FLIP', at: 3
    };
    assert.equal(undoCount([{
            before: s, action: move
        }], false), 1);
    assert.equal(undoCount([{
            before: s, action: move
        }], true), 0);
    assert.equal(undoCount([{
            before: s, action: move
        }, {
            before: s, action: capture
        }], true), 2);
    assert.equal(undoCount([{
            before: s, action: flip
        }, {
            before: s, action: move
        }], true), 0);
    assert.equal(undoCount([{
            before: s, action: flip
        }], false), 0);
});
test('AI observation excludes hidden identities and decisions depend only on public information', () => {
    const s = createGame(88), n = structuredClone(s);
    n.board.reverse();
    assert.deepEqual(observe(s), observe(n));
    assert.ok(observe(s).board.every(p => p === 'hidden'));
    for (const d of ['easy', 'medium', 'hard'] as const) {
        const a = chooseAction(observe(s), d, 42, 10000);
        assert.ok(isLegal(s, a));
        assert.deepEqual(a, chooseAction(observe(n), d, 42, 10000));
    }
});
test('AI returns legal moves at every difficulty after assignment', () => {
    const s = applyAction(createGame(5), {
        type: 'FLIP', at: 0
    });
    for (const difficulty of ['easy', 'medium', 'hard'] as const)
        assert.ok(isLegal(s, chooseAction(observe(s), difficulty, 3, 100)));
});
test('seeded complete games terminate with piece conservation', () => {
    for (let seed = 1; seed <= 6; seed++) {
        let s = createGame(seed, {
            repetition: 3, quietLimit: 40
        });
        let turns = 0;
        while (!s.outcome && turns < 2000) {
            const a = chooseAction(observe(s), 'easy', seed * 10000 + turns);
            s = applyAction(s, a);
            assert.equal(s.board.filter(Boolean).length + s.captured.length, 32);
            turns++;
        }
        assert.ok(s.outcome, `seed ${seed} did not finish`);
    }
});
test('action validation is independent of property insertion order', () => {
    const s = createGame(1);
    assert.ok(isLegal(s, {
        at: 0, type: 'FLIP'
    }));
});

test('undo restores captures, turn, quiet counters, and repetition state exactly', () => {
    const initial = board({0: piece('horse'), 1: piece('soldier', 'black'), 31: piece('general', 'black')});
    initial.quiet = 12;
    initial.repetitions[positionKey(initial)] = 2;
    const action: Action = {type: 'CAPTURE', from: 0, to: 1};
    const after = applyAction(initial, action);
    const undone = undoActions(after, [{before: initial, action}], false);
    assert.deepEqual(undone.state, initial);
    assert.deepEqual(undone.history, []);
    assert.equal(after.captured.length, 1);
    assert.equal(undone.state.captured.length, 0);
});

test('full AI-round undo restores both moves, but terminal games cannot be undone', () => {
    const initial = board({0: piece('horse'), 31: piece('horse', 'black')});
    const human: Action = {type: 'MOVE', from: 0, to: 1};
    const ai: Action = {type: 'MOVE', from: 31, to: 30};
    const middle = applyAction(initial, human);
    const after = applyAction(middle, ai);
    const history = [{before: initial, action: human}, {before: middle, action: ai}];
    assert.deepEqual(undoActions(after, history, true).state, initial);
    const terminal = applyAction(after, {type: 'RESIGN'});
    assert.equal(undoActions(terminal, history, true).state, terminal);
});

test('position keys distinguish side to move and ignore inaccessible identities', () => {
    const s = createGame(1), other = createGame(2);
    assert.equal(positionKey(s), positionKey(other));
    other.turn = 1;
    assert.notEqual(positionKey(s), positionKey(other));
});
