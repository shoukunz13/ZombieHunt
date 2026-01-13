/**
 * Zombie Hunt - Persistence Layer
 * Optional JSON file persistence for crash recovery.
 */

import * as fs from 'fs';
import { GameState, Player, Duel, PublicEvent, GameSettings, DEFAULT_SETTINGS } from './types';
import { CONFIG } from './config';

interface SerializedGameState {
    gameCode: string;
    phase: string;
    round: number;
    phaseEndsAt?: number;
    settings?: GameSettings;
    players: Array<[string, Player]>;
    duels: Array<[string, Duel]>;
    currentRoundDuels: string[];
    events: PublicEvent[];
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
}

/**
 * Persist game state to JSON file
 */
export function persistState(game: GameState): void {
    if (!CONFIG.ENABLE_PERSISTENCE) return;

    try {
        const serialized: SerializedGameState = {
            gameCode: game.gameCode,
            phase: game.phase,
            round: game.round,
            phaseEndsAt: game.phaseEndsAt,
            settings: game.settings,
            players: Array.from(game.players.entries()),
            duels: Array.from(game.duels.entries()),
            currentRoundDuels: game.currentRoundDuels,
            events: game.events,
            createdAt: game.createdAt,
            startedAt: game.startedAt,
            endedAt: game.endedAt,
        };

        fs.writeFileSync(CONFIG.PERSISTENCE_FILE, JSON.stringify(serialized, null, 2));
    } catch (error) {
        console.error('Failed to persist game state:', error);
    }
}

/**
 * Load game state from JSON file
 */
export function loadPersistedState(gameCode: string): GameState | null {
    if (!CONFIG.ENABLE_PERSISTENCE) return null;

    try {
        if (!fs.existsSync(CONFIG.PERSISTENCE_FILE)) {
            return null;
        }

        const data = fs.readFileSync(CONFIG.PERSISTENCE_FILE, 'utf-8');
        const serialized: SerializedGameState = JSON.parse(data);

        if (serialized.gameCode !== gameCode) {
            return null;
        }

        const game: GameState = {
            gameCode: serialized.gameCode,
            phase: serialized.phase as GameState['phase'],
            round: serialized.round,
            phaseEndsAt: serialized.phaseEndsAt,
            settings: serialized.settings || { ...DEFAULT_SETTINGS },
            players: new Map(serialized.players),
            duels: new Map(serialized.duels),
            currentRoundDuels: serialized.currentRoundDuels,
            events: serialized.events,
            createdAt: serialized.createdAt,
            startedAt: serialized.startedAt,
            endedAt: serialized.endedAt,
        };

        console.log(`Loaded persisted game state for ${gameCode}`);
        return game;
    } catch (error) {
        console.error('Failed to load persisted state:', error);
        return null;
    }
}

/**
 * Clear persisted state
 */
export function clearPersistedState(): void {
    try {
        if (fs.existsSync(CONFIG.PERSISTENCE_FILE)) {
            fs.unlinkSync(CONFIG.PERSISTENCE_FILE);
        }
    } catch (error) {
        console.error('Failed to clear persisted state:', error);
    }
}
