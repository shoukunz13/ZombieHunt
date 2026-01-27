/**
 * Zombie Hunt - Duel Resolution Tests
 * Unit tests for duel resolution logic.
 */

import {
    submitDuelAction, resolveDuel, isDuelReady, getDuelResultPrivate
} from './duelResolver';
import {
    createGameState, addPlayer, startGame, startDuelPhase, selectOpponent,
    getPlayer
} from './gameState';
import { GameState, Player, Duel, NumberCard } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper to create a test game with 6 players
function createTestGame(): GameState {
    const game = createGameState('TEST');

    // Add 6 players
    for (let i = 1; i <= 6; i++) {
        addPlayer(game, `Player${i}`, `socket${i}`);
    }

    startGame(game);
    return game;
}

// Helper to get two players and pair them
function pairPlayers(game: GameState): [Player, Player] {
    const players = Array.from(game.players.values()).filter(p => p.status === 'alive');
    const p1 = players[0];
    const p2 = players[1];

    selectOpponent(game, p1.id, p2.id);
    return [p1, p2];
}

// Helper to create a duel between two players
function createTestDuel(game: GameState, p1: Player, p2: Player): Duel {
    const duel: Duel = {
        id: uuidv4(),
        round: game.round,
        player1Id: p1.id,
        player2Id: p2.id,
        status: 'in_progress',
    };

    game.duels.set(duel.id, duel);
    p1.currentDuelId = duel.id;
    p2.currentDuelId = duel.id;

    return duel;
}

describe('Duel Resolution', () => {
    describe('Number Card Duels', () => {
        test('higher value wins', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            // Give p1 a high card and p2 a low card of same suit
            const highCard: NumberCard = { id: 'high', type: 'number', suit: 'hearts', value: 10 };
            const lowCard: NumberCard = { id: 'low', type: 'number', suit: 'hearts', value: 3 };

            p1.numberCards = [highCard];
            p2.numberCards = [lowCard];

            submitDuelAction(game, duel, p1.id, 'number', 'high');
            submitDuelAction(game, duel, p2.id, 'number', 'low');

            expect(isDuelReady(duel)).toBe(true);

            const result = resolveDuel(game, duel);

            expect(result.winnerId).toBe(p1.id);
            expect(result.loserId).toBe(p2.id);
        });

        test('draw when equal values', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            const card1: NumberCard = { id: 'c1', type: 'number', suit: 'hearts', value: 5 };
            const card2: NumberCard = { id: 'c2', type: 'number', suit: 'hearts', value: 5 };

            p1.numberCards = [card1];
            p2.numberCards = [card2];

            submitDuelAction(game, duel, p1.id, 'number', 'c1');
            submitDuelAction(game, duel, p2.id, 'number', 'c2');

            const result = resolveDuel(game, duel);

            expect(result.winnerId).toBeNull();
            expect(result.loserId).toBeNull();
        });
    });

    describe('Zombie Card', () => {
        test('zombie card beats number card and infects opponent', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            // Make p1 a zombie with zombie card
            p1.role = 'zombie';
            p1.zombieCard = { id: 'zombie', type: 'zombie' };

            const numCard: NumberCard = { id: 'num', type: 'number', suit: 'hearts', value: 13 };
            p2.numberCards = [numCard];

            submitDuelAction(game, duel, p1.id, 'zombie');
            submitDuelAction(game, duel, p2.id, 'number', 'num');

            const result = resolveDuel(game, duel);

            expect(result.winnerId).toBe(p1.id);
            expect(result.infections).toContain(p2.id);
            expect(p2.role).toBe('zombie');
        });
    });

    describe('Vaccine Card', () => {
        test('vaccine cures zombie who played zombie card', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            // p2 is zombie with zombie card
            p2.role = 'zombie';
            p2.zombieCard = { id: 'zombie', type: 'zombie' };

            // p1 has vaccine
            p1.vaccineCard = { id: 'vaccine', type: 'vaccine' };

            submitDuelAction(game, duel, p1.id, 'vaccine');
            submitDuelAction(game, duel, p2.id, 'zombie');

            const result = resolveDuel(game, duel);

            expect(result.cures).toContain(p2.id);
            expect(p2.role).toBe('human');
        });
    });

    describe('Shotgun', () => {
        test('shotgun kills zombie opponent', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            // p2 is zombie
            p2.role = 'zombie';

            // p1 has shotgun
            p1.hasShotgun = true;

            submitDuelAction(game, duel, p1.id, 'shotgun');
            submitDuelAction(game, duel, p2.id, 'number', p2.numberCards[0]?.id);

            const result = resolveDuel(game, duel);

            expect(result.shotgunKills).toContain(p2.id);
            expect(result.eliminations).toContain(p2.id);
            expect(p2.status).toBe('eliminated');
        });

        test('shotgun is wasted on human', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            // p2 is human
            p2.role = 'human';

            // p1 has shotgun
            p1.hasShotgun = true;

            submitDuelAction(game, duel, p1.id, 'shotgun');
            submitDuelAction(game, duel, p2.id, 'number', p2.numberCards[0]?.id);

            const result = resolveDuel(game, duel);

            expect(result.shotgunKills).not.toContain(p2.id);
            expect(p2.status).toBe('alive');
            expect(p1.hasShotgun).toBe(false); // Shotgun used up
        });
    });

    describe('Action Validation', () => {
        test('cannot play card not in hand', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            const result = submitDuelAction(game, duel, p1.id, 'number', 'nonexistent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Card not in hand');
        });

        test('cannot play zombie card without having one', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            p1.zombieCard = null;

            const result = submitDuelAction(game, duel, p1.id, 'zombie');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No zombie card');
        });

        test('cannot use shotgun twice', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            p1.hasShotgun = false;

            const result = submitDuelAction(game, duel, p1.id, 'shotgun');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No shotgun');
        });
    });

    describe('Duel Result Private View', () => {
        test('returns correct outcome for winner', () => {
            const game = createTestGame();
            const [p1, p2] = pairPlayers(game);
            const duel = createTestDuel(game, p1, p2);

            const highCard: NumberCard = { id: 'high', type: 'number', suit: 'hearts', value: 10 };
            const lowCard: NumberCard = { id: 'low', type: 'number', suit: 'hearts', value: 3 };

            p1.numberCards = [highCard, { id: 'extra', type: 'number', suit: 'spades', value: 5 }];
            p2.numberCards = [lowCard, { id: 'extra2', type: 'number', suit: 'spades', value: 6 }];

            submitDuelAction(game, duel, p1.id, 'number', 'high');
            submitDuelAction(game, duel, p2.id, 'number', 'low');
            resolveDuel(game, duel);

            const p1Result = getDuelResultPrivate(game, duel, p1.id);
            const p2Result = getDuelResultPrivate(game, duel, p2.id);

            expect(p1Result?.outcome).toBe('win');
            expect(p2Result?.outcome).toBe('lose');
        });
    });
});

describe('Game State', () => {
    test('creates game with correct initial state', () => {
        const game = createGameState('TEST123');

        expect(game.gameCode).toBe('TEST123');
        expect(game.phase).toBe('waiting');
        expect(game.round).toBe(0);
        expect(game.players.size).toBe(0);
    });

    test('adds players correctly', () => {
        const game = createGameState('TEST');

        const p1 = addPlayer(game, 'Alice', 'socket1');
        const p2 = addPlayer(game, 'Bob', 'socket2');

        expect(game.players.size).toBe(2);
        expect(p1?.name).toBe('Alice');
        expect(p2?.name).toBe('Bob');
    });

    test('starts game with correct role distribution', () => {
        const game = createTestGame();

        expect(game.phase).toBe('lobby');
        expect(game.round).toBe(1);

        // Check each player has cards
        for (const player of game.players.values()) {
            expect(player.numberCards.length).toBeGreaterThan(0);
            expect(player.hasShotgun).toBe(true);
        }

        // Check zombie count (1 per team)
        const zombies = Array.from(game.players.values()).filter(p => p.role === 'zombie');
        expect(zombies.length).toBeGreaterThan(0);
    });
});
