/**
 * Zombie Hunt - Lobby Manager
 * Manages multiple game lobbies with token-based authentication.
 */

import crypto from 'crypto';
import { GameState, GameSettings, DEFAULT_SETTINGS } from './types';

// ============ Constants ============

export const MAX_LOBBIES = 100;
export const MAX_PLAYERS_PER_LOBBY = 20;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;  // 5 min
export const EMPTY_TTL_MS = 30 * 60 * 1000;        // 30 min
export const ENDED_TTL_MS = 60 * 60 * 1000;        // 60 min
export const WAITING_TTL_MS = 2 * 60 * 60 * 1000;  // 2 hours

// ============ Types ============

export type LobbyStatus = 'waiting' | 'in_game' | 'ended';

export interface LobbyConfig {
    maxPlayers: number;
}

export interface LobbyInstance {
    code: string;
    hostToken: string;                    // Secret, never logged
    playerTokens: Map<string, string>;    // playerId → playerToken
    config: LobbyConfig;
    state: GameState;
    status: LobbyStatus;
    createdAt: number;
    lastActivityAt: number;
}

// ============ Lobby Storage ============

const lobbies = new Map<string, LobbyInstance>();
let cleanupInterval: NodeJS.Timeout | null = null;

// ============ Token Generation ============

/**
 * Generate a cryptographically secure token
 */
export function generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a 6-character alphanumeric lobby code
 * Collision-checked against existing lobbies
 */
export function generateLobbyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        attempts++;
        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique lobby code');
        }
    } while (lobbies.has(code));

    return code;
}

// ============ Lobby Management ============

/**
 * Create a new lobby
 * Returns lobby code and host token, or error
 */
export function createLobby(): { success: true; lobbyCode: string; hostToken: string } | { success: false; error: string } {
    // Check max lobbies
    if (lobbies.size >= MAX_LOBBIES) {
        return { success: false, error: 'Server is at maximum lobby capacity' };
    }

    const code = generateLobbyCode();
    const hostToken = generateSecureToken();

    // Create initial game state
    const state: GameState = {
        gameCode: code,
        phase: 'waiting',
        round: 0,
        settings: { ...DEFAULT_SETTINGS },
        players: new Map(),
        duels: new Map(),
        currentRoundDuels: [],
        events: [],
        createdAt: Date.now(),
    };

    const lobby: LobbyInstance = {
        code,
        hostToken,
        playerTokens: new Map(),
        config: {
            maxPlayers: MAX_PLAYERS_PER_LOBBY,
        },
        state,
        status: 'waiting',
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
    };

    lobbies.set(code, lobby);
    console.log(`[LOBBY] Created lobby ${code} (total: ${lobbies.size})`);

    return { success: true, lobbyCode: code, hostToken };
}

/**
 * Get a lobby by code
 */
export function getLobby(code: string): LobbyInstance | null {
    return lobbies.get(code.toUpperCase()) || null;
}

/**
 * Get all lobbies (for admin dashboard)
 */
export function getAllLobbies(): LobbyInstance[] {
    return Array.from(lobbies.values());
}

/**
 * Get lobby count
 */
export function getLobbyCount(): number {
    return lobbies.size;
}

/**
 * Validate host token for a lobby
 */
export function validateHostToken(code: string, token: string): boolean {
    const lobby = getLobby(code);
    if (!lobby) return false;
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(lobby.hostToken),
        Buffer.from(token)
    );
}

/**
 * Validate player token for a lobby
 */
export function validatePlayerToken(code: string, playerId: string, token: string): boolean {
    const lobby = getLobby(code);
    if (!lobby) return false;

    const storedToken = lobby.playerTokens.get(playerId);
    if (!storedToken) return false;

    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(storedToken),
            Buffer.from(token)
        );
    } catch {
        return false;
    }
}

/**
 * Register a player token for a lobby
 */
export function registerPlayerToken(code: string, playerId: string): string {
    const lobby = getLobby(code);
    if (!lobby) throw new Error('Lobby not found');

    const token = generateSecureToken();
    lobby.playerTokens.set(playerId, token);
    return token;
}

/**
 * Get player ID from token (for reconnection)
 */
export function getPlayerIdFromToken(code: string, token: string): string | null {
    const lobby = getLobby(code);
    if (!lobby) return null;

    for (const [playerId, storedToken] of lobby.playerTokens.entries()) {
        try {
            if (crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(token))) {
                return playerId;
            }
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Update lobby activity timestamp
 */
export function updateActivity(code: string): void {
    const lobby = getLobby(code);
    if (lobby) {
        lobby.lastActivityAt = Date.now();
    }
}

/**
 * Update lobby status based on game phase
 */
export function updateLobbyStatus(code: string): void {
    const lobby = getLobby(code);
    if (!lobby) return;

    const phase = lobby.state.phase;
    if (phase === 'waiting') {
        lobby.status = 'waiting';
    } else if (phase === 'ended') {
        lobby.status = 'ended';
    } else {
        lobby.status = 'in_game';
    }
}

/**
 * Delete a lobby
 */
export function deleteLobby(code: string): boolean {
    const deleted = lobbies.delete(code.toUpperCase());
    if (deleted) {
        console.log(`[LOBBY] Deleted lobby ${code} (remaining: ${lobbies.size})`);
    }
    return deleted;
}

// ============ Cleanup ============

/**
 * Clean up stale lobbies based on TTL rules
 */
export function cleanupLobbies(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, lobby] of lobbies.entries()) {
        const age = now - lobby.lastActivityAt;
        let shouldDelete = false;

        // Empty lobbies (no players) - 30 min TTL
        if (lobby.state.players.size === 0 && age > EMPTY_TTL_MS) {
            shouldDelete = true;
            console.log(`[CLEANUP] Removing empty lobby ${code} (age: ${Math.round(age / 60000)}min)`);
        }
        // Ended lobbies - 60 min TTL
        else if (lobby.status === 'ended' && age > ENDED_TTL_MS) {
            shouldDelete = true;
            console.log(`[CLEANUP] Removing ended lobby ${code} (age: ${Math.round(age / 60000)}min)`);
        }
        // Waiting lobbies (game never started) - 2 hour TTL
        else if (lobby.status === 'waiting' && age > WAITING_TTL_MS) {
            shouldDelete = true;
            console.log(`[CLEANUP] Removing stale waiting lobby ${code} (age: ${Math.round(age / 60000)}min)`);
        }

        if (shouldDelete) {
            lobbies.delete(code);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[CLEANUP] Removed ${cleaned} lobbies (remaining: ${lobbies.size})`);
    }

    return cleaned;
}

/**
 * Start the cleanup interval
 */
export function startCleanupInterval(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }

    cleanupInterval = setInterval(() => {
        cleanupLobbies();
    }, CLEANUP_INTERVAL_MS);

    console.log(`[LOBBY] Cleanup interval started (every ${CLEANUP_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the cleanup interval
 */
export function stopCleanupInterval(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('[LOBBY] Cleanup interval stopped');
    }
}

/**
 * Clear all lobbies (for testing)
 */
export function clearAllLobbies(): void {
    lobbies.clear();
    console.log('[LOBBY] All lobbies cleared');
}
