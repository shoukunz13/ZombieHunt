/**
 * Zombie Hunt - Lobby Manager Tests
 */

import {
    createLobby,
    getLobby,
    validateHostToken,
    validatePlayerToken,
    registerPlayerToken,
    getPlayerIdFromToken,
    deleteLobby,
    updateActivity,
    cleanupLobbies,
    clearAllLobbies,
    getLobbyCount,
    generateSecureToken,
    generateLobbyCode,
    MAX_LOBBIES,
    EMPTY_TTL_MS,
    ENDED_TTL_MS,
    WAITING_TTL_MS,
} from './lobbyManager';

describe('LobbyManager', () => {
    beforeEach(() => {
        // Clear all lobbies before each test
        clearAllLobbies();
    });

    describe('createLobby', () => {
        it('should create a lobby with unique code and host token', () => {
            const result = createLobby();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.lobbyCode).toHaveLength(6);
                expect(result.hostToken).toHaveLength(64); // 32 bytes hex
            }
        });

        it('should create lobbies with unique codes', () => {
            const codes = new Set<string>();

            for (let i = 0; i < 20; i++) {
                const result = createLobby();
                if (result.success) {
                    expect(codes.has(result.lobbyCode)).toBe(false);
                    codes.add(result.lobbyCode);
                }
            }
        });

        it('should reject lobby creation when MAX_LOBBIES reached', () => {
            // Create MAX_LOBBIES lobbies
            for (let i = 0; i < MAX_LOBBIES; i++) {
                const result = createLobby();
                expect(result.success).toBe(true);
            }

            // Next creation should fail
            const result = createLobby();
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('maximum');
            }
        });
    });

    describe('getLobby', () => {
        it('should return lobby by code', () => {
            const createResult = createLobby();
            expect(createResult.success).toBe(true);
            if (!createResult.success) return;

            const lobby = getLobby(createResult.lobbyCode);
            expect(lobby).toBeDefined();
            expect(lobby?.code).toBe(createResult.lobbyCode);
        });

        it('should return null for non-existent code', () => {
            const lobby = getLobby('NONEXISTENT');
            expect(lobby).toBeNull();
        });

        it('should be case-insensitive', () => {
            const createResult = createLobby();
            expect(createResult.success).toBe(true);
            if (!createResult.success) return;

            const lowerCode = createResult.lobbyCode.toLowerCase();
            const lobby = getLobby(lowerCode);
            expect(lobby).toBeDefined();
        });
    });

    describe('validateHostToken', () => {
        it('should validate correct host token', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const isValid = validateHostToken(result.lobbyCode, result.hostToken);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect host token', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const isValid = validateHostToken(result.lobbyCode, 'invalid-token');
            expect(isValid).toBe(false);
        });

        it('should reject for non-existent lobby', () => {
            const isValid = validateHostToken('NONEXISTENT', 'any-token');
            expect(isValid).toBe(false);
        });
    });

    describe('Player Tokens', () => {
        it('should register and validate player token', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const playerId = 'player-123';
            const token = registerPlayerToken(result.lobbyCode, playerId);

            expect(token).toHaveLength(64);

            const isValid = validatePlayerToken(result.lobbyCode, playerId, token);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect player token', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const playerId = 'player-123';
            registerPlayerToken(result.lobbyCode, playerId);

            const isValid = validatePlayerToken(result.lobbyCode, playerId, 'wrong-token');
            expect(isValid).toBe(false);
        });

        it('should get player ID from token', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const playerId = 'player-456';
            const token = registerPlayerToken(result.lobbyCode, playerId);

            const foundId = getPlayerIdFromToken(result.lobbyCode, token);
            expect(foundId).toBe(playerId);
        });

        it('should return null for invalid token lookup', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const foundId = getPlayerIdFromToken(result.lobbyCode, 'invalid-token');
            expect(foundId).toBeNull();
        });
    });

    describe('deleteLobby', () => {
        it('should delete existing lobby', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const deleted = deleteLobby(result.lobbyCode);
            expect(deleted).toBe(true);

            const lobby = getLobby(result.lobbyCode);
            expect(lobby).toBeNull();
        });

        it('should return false for non-existent lobby', () => {
            const deleted = deleteLobby('NONEXISTENT');
            expect(deleted).toBe(false);
        });
    });

    describe('updateActivity', () => {
        it('should update lastActivityAt timestamp', async () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const lobby = getLobby(result.lobbyCode);
            const originalTime = lobby?.lastActivityAt;

            // Small delay to ensure timestamp changes
            await new Promise(resolve => setTimeout(resolve, 10));

            updateActivity(result.lobbyCode);

            const updatedLobby = getLobby(result.lobbyCode);
            expect(updatedLobby?.lastActivityAt).toBeGreaterThan(originalTime!);
        });
    });

    describe('cleanupLobbies', () => {
        it('should clean up empty lobbies after TTL', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const lobby = getLobby(result.lobbyCode);
            if (!lobby) return;

            // Simulate old empty lobby
            lobby.lastActivityAt = Date.now() - EMPTY_TTL_MS - 1000;

            const cleaned = cleanupLobbies();
            expect(cleaned).toBe(1);
            expect(getLobby(result.lobbyCode)).toBeNull();
        });

        it('should clean up ended lobbies after TTL', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const lobby = getLobby(result.lobbyCode);
            if (!lobby) return;

            // Add a player so it's not considered empty
            lobby.state.players.set('p1', {} as any);
            lobby.status = 'ended';
            lobby.lastActivityAt = Date.now() - ENDED_TTL_MS - 1000;

            const cleaned = cleanupLobbies();
            expect(cleaned).toBe(1);
            expect(getLobby(result.lobbyCode)).toBeNull();
        });

        it('should clean up waiting lobbies after TTL', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const lobby = getLobby(result.lobbyCode);
            if (!lobby) return;

            // Add a player so it's not considered empty
            lobby.state.players.set('p1', {} as any);
            lobby.status = 'waiting';
            lobby.lastActivityAt = Date.now() - WAITING_TTL_MS - 1000;

            const cleaned = cleanupLobbies();
            expect(cleaned).toBe(1);
            expect(getLobby(result.lobbyCode)).toBeNull();
        });

        it('should not clean up active lobbies', () => {
            const result = createLobby();
            expect(result.success).toBe(true);
            if (!result.success) return;

            const lobby = getLobby(result.lobbyCode);
            if (!lobby) return;

            // Add a player and set as in_game
            lobby.state.players.set('p1', {} as any);
            lobby.status = 'in_game';
            lobby.lastActivityAt = Date.now(); // Recent activity

            const cleaned = cleanupLobbies();
            expect(cleaned).toBe(0);
            expect(getLobby(result.lobbyCode)).toBeDefined();
        });
    });

    describe('Lobby Isolation', () => {
        it('should isolate state between lobbies', () => {
            const result1 = createLobby();
            const result2 = createLobby();

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            if (!result1.success || !result2.success) return;

            const lobby1 = getLobby(result1.lobbyCode);
            const lobby2 = getLobby(result2.lobbyCode);

            // Modify lobby1 state
            if (lobby1) {
                lobby1.state.players.set('p1', { name: 'Player1' } as any);
                lobby1.status = 'in_game';
            }

            // Verify lobby2 is unaffected
            expect(lobby2?.state.players.size).toBe(0);
            expect(lobby2?.status).toBe('waiting');
        });

        it('should have independent host tokens', () => {
            const result1 = createLobby();
            const result2 = createLobby();

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            if (!result1.success || !result2.success) return;

            // Host token from lobby1 should not validate lobby2
            const crossValidation = validateHostToken(result2.lobbyCode, result1.hostToken);
            expect(crossValidation).toBe(false);
        });

        it('should have independent player tokens', () => {
            const result1 = createLobby();
            const result2 = createLobby();

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            if (!result1.success || !result2.success) return;

            const playerId = 'shared-player-id';
            const token1 = registerPlayerToken(result1.lobbyCode, playerId);

            // Token from lobby1 should not validate in lobby2
            const crossValidation = validatePlayerToken(result2.lobbyCode, playerId, token1);
            expect(crossValidation).toBe(false);
        });
    });

    describe('Token Generation', () => {
        it('should generate cryptographically secure tokens', () => {
            const token = generateSecureToken();
            expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
            expect(/^[a-f0-9]+$/.test(token)).toBe(true);
        });

        it('should generate unique tokens', () => {
            const tokens = new Set<string>();
            for (let i = 0; i < 100; i++) {
                const token = generateSecureToken();
                expect(tokens.has(token)).toBe(false);
                tokens.add(token);
            }
        });
    });

    describe('Lobby Code Generation', () => {
        it('should generate 6-character alphanumeric codes', () => {
            const code = generateLobbyCode();
            expect(code).toHaveLength(6);
            expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
        });

        it('should exclude confusing characters', () => {
            // Generate many codes and check none contain I, O, 0, 1
            for (let i = 0; i < 100; i++) {
                const code = generateLobbyCode();
                expect(code).not.toContain('I');
                expect(code).not.toContain('O');
                expect(code).not.toContain('0');
                expect(code).not.toContain('1');
            }
        });
    });

    describe('getLobbyCount', () => {
        it('should track lobby count', () => {
            expect(getLobbyCount()).toBe(0);

            createLobby();
            expect(getLobbyCount()).toBe(1);

            createLobby();
            expect(getLobbyCount()).toBe(2);
        });
    });
});
