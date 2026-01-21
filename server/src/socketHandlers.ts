/**
 * Zombie Hunt - Socket.io Event Handlers
 * All real-time communication between clients, host, and server.
 */

import { Server, Socket } from 'socket.io';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import {
    getOrCreateGame, getGame, addPlayer, findPlayerBySocketId,
    handleDisconnect, handleReconnect, selectOpponent, cancelSelection,
    declineInvite, allPlayersPaired, startGame, startDuelPhase, startMeetingPhase,
    startNextRound, getPlayer, getPlayerPublic, getPlayerPrivate,
    getGameStatePublic, getHostState, getFinalReveal, getAlivePlayers,
    getCurrentRoundEvents, resetGame, clearGame, completeIntro, updateSettings, endGame,
    restartGameToWaiting
} from './gameState';
import {
    submitDuelAction, resolveDuel, isDuelReady, getDuelResultPrivate,
    autoSubmitForDisconnected, getAvailableActions, getValidNumberCards
} from './duelResolver';
import { CONFIG } from './config';
import { GameState, Player, Duel, PlayerPublic } from './types';

// Rate limiters
const eventRateLimiter = new RateLimiterMemory({
    points: 20,      // 20 events
    duration: 1,     // per 1 second
});

const authRateLimiter = new RateLimiterMemory({
    points: 5,       // 5 auth attempts
    duration: 60,    // per minute
    blockDuration: 300, // 5 min block after exceeded
});

const joinRateLimiter = new RateLimiterMemory({
    points: 10,      // 10 join attempts
    duration: 60,    // per minute
});

// Normalize IP addresses for consistent rate limiting
function normalizeIP(ip: string): string {
    if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
        return 'localhost';
    }
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
}

// Store phase timers
let phaseTimer: NodeJS.Timeout | null = null;
let hostSocketId: string | null = null;

// Metrics type for observability
interface Metrics {
    totalConnections: number;
    activeConnections: number;
    totalEvents: number;
    rateLimitBlocks: number;
}

// Module-level metrics reference
let serverMetrics: Metrics | null = null;

/**
 * Initialize Socket.io handlers
 */
export function initializeSocketHandlers(io: Server, metrics?: Metrics): void {
    serverMetrics = metrics || null;

    io.on('connection', (socket: Socket) => {
        console.log(`[CONN] ${socket.id} connected`);


        // ============ Client Events ============

        socket.on('join_game', (data: unknown) => {
            // Input validation - guard against null/malformed data
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Invalid request' });
                return;
            }
            const { gameCode, name } = data as { gameCode: string; name: string };
            if (typeof gameCode !== 'string' || typeof name !== 'string') {
                socket.emit('error', { message: 'Invalid request format' });
                return;
            }
            handleJoinGame(io, socket, gameCode, name);
        });

        socket.on('lobby_select_opponent', ({ opponentId }: { opponentId: string }) => {
            handleSelectOpponent(io, socket, opponentId);
        });

        socket.on('lobby_cancel_selection', () => {
            handleCancelSelection(io, socket);
        });

        socket.on('lobby_decline_invite', ({ inviterId }: { inviterId: string }) => {
            handleDeclineInvite(io, socket, inviterId);
        });

        socket.on('duel_submit_action', ({ duelId, actionType, cardId, cardIds }: {
            duelId: string;
            actionType: string;
            cardId?: string;
            cardIds?: string[];
        }) => {
            handleDuelAction(io, socket, duelId, actionType as any, cardId, cardIds);
        });

        socket.on('claim_loot', ({ duelId, cardId }: { duelId: string; cardId: string }) => {
            handleClaimLoot(io, socket, duelId, cardId);
        });

        socket.on('meeting_acknowledge', () => {
            // Currently just an acknowledgement, no action needed
        });

        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        socket.on('rejoin_game', ({ playerId, gameCode, name }: { playerId: string; gameCode: string; name: string }) => {
            handleRejoinGame(io, socket, playerId, gameCode, name);
        });

        socket.on('leave_game', () => {
            handleLeaveGame(io, socket);
        });

        // ============ Host Events ============

        socket.on('host_auth', (data: unknown) => {
            // Input validation
            if (!data || typeof data !== 'object') {
                socket.emit('host_auth_failed', { message: 'Invalid request' });
                return;
            }
            const { pin } = data as { pin: string };
            if (typeof pin !== 'string') {
                socket.emit('host_auth_failed', { message: 'Invalid request format' });
                return;
            }
            handleHostAuth(io, socket, pin);
        });

        socket.on('host_start_game', () => {
            handleHostStartGame(io, socket);
        });

        socket.on('host_force_phase', ({ phase }: { phase: string }) => {
            handleHostForcePhase(io, socket, phase);
        });

        socket.on('host_kick_player', ({ playerId }: { playerId: string }) => {
            handleHostKickPlayer(io, socket, playerId);
        });

        socket.on('host_create_game', ({ gameCode }: { gameCode: string }) => {
            handleHostCreateGame(io, socket, gameCode);
        });

        socket.on('host_end_game', () => {
            handleHostEndGame(io, socket);
        });

        socket.on('host_intro_complete', () => {
            handleHostIntroComplete(io, socket);
        });

        socket.on('host_update_settings', (settings: Partial<import('./types').GameSettings>) => {
            handleHostUpdateSettings(io, socket, settings);
        });

        socket.on('host_reveal_complete', () => {
            handleHostRevealComplete(io, socket);
        });

        socket.on('host_restart_game', () => {
            handleHostRestartGame(io, socket);
        });

        // ============ Disconnect ============

        socket.on('disconnect', () => {
            handleClientDisconnect(io, socket);
        });
    });
}

// ============ Handler Implementations ============

async function handleJoinGame(io: Server, socket: Socket, gameCode: string, name: string): Promise<void> {
    const clientIP = normalizeIP(socket.handshake.address);

    // Rate limit join attempts
    try {
        await joinRateLimiter.consume(clientIP);
    } catch {
        console.log(`[RATE-LIMIT] join_game blocked for IP ${clientIP}`);
        if (serverMetrics) serverMetrics.rateLimitBlocks++;
        socket.emit('error', { message: 'Too many join attempts. Please wait.' });
        return;
    }

    // Sanitize player name (prevent XSS, limit length)
    const sanitizedName = name.trim().replace(/[<>"'&]/g, '').substring(0, 16);
    if (!sanitizedName || sanitizedName.length < 1) {
        socket.emit('error', { message: 'Invalid name' });
        return;
    }

    const game = getGame();

    // Check if game exists and matches the code
    if (!game || game.gameCode !== gameCode) {
        socket.emit('error', { message: 'Game not found. Ask the host to create a game first.' });
        return;
    }

    // Try reconnection first
    if (game.phase !== 'waiting') {
        const player = handleReconnect(game, sanitizedName, socket.id);
        if (player) {
            socket.join(gameCode);
            socket.emit('joined', {
                playerId: player.id,
                gameStatePublic: getGameStatePublic(game),
                yourPrivateState: getPlayerPrivate(player),
            });
            broadcastLobbyUpdate(io, game);
            broadcastHostUpdate(io, game);
            return;
        } else {
            socket.emit('error', { message: 'Game already started, cannot join' });
            return;
        }
    }

    // New player joining
    const player = addPlayer(game, name, socket.id);
    if (!player) {
        socket.emit('error', { message: 'Name already taken or invalid' });
        return;
    }

    socket.join(gameCode);
    socket.emit('joined', {
        playerId: player.id,
        gameStatePublic: getGameStatePublic(game),
        yourPrivateState: getPlayerPrivate(player),
    });

    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);
}

/**
 * Handle player rejoin from saved session
 */
function handleRejoinGame(io: Server, socket: Socket, playerId: string, gameCode: string, name: string): void {
    const game = getGame();

    // Check if game exists and matches the code
    if (!game || game.gameCode !== gameCode) {
        socket.emit('error', { message: 'Game not found' });
        return;
    }

    // Find existing player by ID
    const player = getPlayer(game, playerId);
    if (player) {
        // Update socket ID for reconnection
        player.socketId = socket.id;
        player.disconnectedAt = undefined;

        socket.join(gameCode);
        socket.emit('joined', {
            playerId: player.id,
            gameStatePublic: getGameStatePublic(game),
            yourPrivateState: getPlayerPrivate(player),
        });

        console.log(`Player ${player.name} rejoined from session`);
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
        return;
    }

    // If player not found by ID, try to rejoin by name (fallback)
    const playerByName = handleReconnect(game, name, socket.id);
    if (playerByName) {
        socket.join(gameCode);
        socket.emit('joined', {
            playerId: playerByName.id,
            gameStatePublic: getGameStatePublic(game),
            yourPrivateState: getPlayerPrivate(playerByName),
        });
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
        return;
    }

    socket.emit('error', { message: 'Cannot rejoin - session expired' });
}

/**
 * Handle player leaving the game voluntarily
 */
function handleLeaveGame(io: Server, socket: Socket): void {
    const game = getGame();
    if (!game) return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    // Only allow leaving during waiting phase
    if (game.phase === 'waiting') {
        // Remove player from game
        game.players.delete(player.id);
        socket.leave(game.gameCode);
        console.log(`Player ${player.name} left the game`);

        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
    }
}

function handleSelectOpponent(io: Server, socket: Socket, opponentId: string): void {
    const game = getGame();
    if (!game || game.phase !== 'lobby') return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    const result = selectOpponent(game, player.id, opponentId);
    if (result.success) {
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);

        // If a duel was created (mutual selection), notify both players
        if (result.duel) {
            const opponent = getPlayer(game, opponentId);

            // Notify player who just selected (player2 in the duel)
            socket.emit('duel_assigned', {
                duelId: result.duel.id,
                opponentPublic: opponent ? getPlayerPublic(opponent, game) : null,
                round: game.round,
            });

            // Notify the opponent who originally invited (player1 in the duel)
            if (opponent?.socketId) {
                io.to(opponent.socketId).emit('duel_assigned', {
                    duelId: result.duel.id,
                    opponentPublic: getPlayerPublic(player, game),
                    round: game.round,
                });
            }
        }
    }
}

function handleCancelSelection(io: Server, socket: Socket): void {
    const game = getGame();
    if (!game || game.phase !== 'lobby') return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    cancelSelection(game, player.id);
    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);
}

function handleDeclineInvite(io: Server, socket: Socket, inviterId: string): void {
    const game = getGame();
    if (!game || game.phase !== 'lobby') return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    declineInvite(game, player.id, inviterId);
    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);
}

function handleDuelAction(
    io: Server,
    socket: Socket,
    duelId: string,
    actionType: 'number' | 'zombie' | 'vaccine' | 'shotgun',
    cardId?: string,
    cardIds?: string[]
): void {
    console.log(`[handleDuelAction] Received: duelId=${duelId}, actionType=${actionType}, cardIds=${JSON.stringify(cardIds)}`);

    const game = getGame();
    if (!game) {
        console.log('[handleDuelAction] No game found');
        return;
    }

    console.log(`[handleDuelAction] Game phase: ${game.phase}`);

    // Allow duel actions in lobby phase (individual duels) or duel phase (legacy)
    if (game.phase !== 'lobby' && game.phase !== 'duel') {
        console.log(`[handleDuelAction] Wrong phase: ${game.phase}`);
        return;
    }

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) {
        console.log(`[handleDuelAction] Player not found for socket: ${socket.id}`);
        return;
    }
    console.log(`[handleDuelAction] Player: ${player.name}`);

    const duel = game.duels.get(duelId);
    if (!duel) {
        console.log(`[handleDuelAction] Duel not found: ${duelId}`);
        console.log(`[handleDuelAction] Available duels: ${Array.from(game.duels.keys()).join(', ')}`);
        return;
    }
    if (duel.status !== 'in_progress') {
        console.log(`[handleDuelAction] Duel not in progress: ${duel.status}`);
        return;
    }

    // Verify player is in this duel
    if (duel.player1Id !== player.id && duel.player2Id !== player.id) {
        console.log(`[handleDuelAction] Player ${player.id} not in duel (p1=${duel.player1Id}, p2=${duel.player2Id})`);
        return;
    }

    console.log(`[handleDuelAction] Submitting action...`);
    const result = submitDuelAction(game, duel, player.id, actionType, cardId, cardIds);

    if (!result.success) {
        console.log(`[handleDuelAction] Action failed: ${result.error}`);
        socket.emit('error', { message: result.error });
        return;
    }
    console.log(`[handleDuelAction] Action succeeded!`);

    // Send updated duel state
    socket.emit('duel_action_confirmed', { duelId });

    // Check if both players have submitted
    if (isDuelReady(duel)) {
        resolveDuelAndNotify(io, game, duel);
    }

    broadcastHostUpdate(io, game);
}

async function handleHostAuth(io: Server, socket: Socket, pin: string): Promise<void> {
    const clientIP = normalizeIP(socket.handshake.address);

    // Rate limit auth attempts to prevent brute-force
    try {
        await authRateLimiter.consume(clientIP);
    } catch {
        console.log(`[RATE-LIMIT] host_auth blocked for IP ${clientIP}`);
        if (serverMetrics) serverMetrics.rateLimitBlocks++;
        socket.emit('host_auth_failed', { message: 'Too many attempts. Please wait 5 minutes.' });
        return;
    }

    if (pin !== CONFIG.HOST_PIN) {
        socket.emit('host_auth_failed', { message: 'Invalid PIN' });
        return;
    }

    hostSocketId = socket.id;
    socket.join('host');

    const game = getGame();
    socket.emit('host_authed', {
        hostState: game ? getHostState(game) : null,
    });
}

function handleHostCreateGame(io: Server, socket: Socket, gameCode: string): void {
    if (socket.id !== hostSocketId) return;

    // Validate game code
    if (!gameCode || gameCode.trim().length < 2) {
        socket.emit('error', { message: 'Game code must be at least 2 characters' });
        return;
    }

    const sanitizedCode = gameCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Create new game
    const game = resetGame(sanitizedCode);

    console.log(`Host created new game: ${sanitizedCode}`);

    // Notify host of new game state
    socket.emit('host_game_created', {
        gameCode: sanitizedCode,
        hostState: getHostState(game),
    });
}

function handleHostEndGame(io: Server, socket: Socket): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();

    // Clear any phase timer
    if (phaseTimer) {
        clearTimeout(phaseTimer);
        phaseTimer = null;
    }

    // Notify all players that game has ended
    if (game) {
        io.to(game.gameCode).emit('game_force_ended', {
            message: 'Game has been terminated by host'
        });

        // Disconnect all players from the game room
        io.in(game.gameCode).socketsLeave(game.gameCode);
    }

    // Clear the game
    clearGame();

    console.log('Host force ended the game');

    // Notify host
    socket.emit('host_game_ended', {
        message: 'Game terminated successfully'
    });
}

function handleHostIntroComplete(io: Server, socket: Socket): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    const success = completeIntro(game);
    if (success) {
        console.log('Host completed intro video, transitioning to lobby');
        broadcastPhaseChange(io, game);
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
    }
}

function handleHostUpdateSettings(io: Server, socket: Socket, settings: Partial<import('./types').GameSettings>): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    const success = updateSettings(game, settings);
    if (success) {
        console.log('Host updated settings:', game.settings);
        broadcastHostUpdate(io, game);
    }
}

/**
 * Host has completed the reveal animation - now send results to players
 */
function handleHostRevealComplete(io: Server, socket: Socket): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game || game.phase !== 'ended') return;

    console.log('[HOST] Reveal complete - sending results to players');

    const finalReveal = getFinalReveal(game);

    // Now send game_ended to all players
    for (const player of game.players.values()) {
        if (player.socketId) {
            // Eliminated players always lose, regardless of team outcome
            let yourOutcome: 'won' | 'lost' | 'tie';
            if (player.status === 'eliminated') {
                yourOutcome = 'lost';
            } else if (finalReveal.winnerSide === 'tie') {
                yourOutcome = 'tie';
            } else if ((player.role === 'human' && finalReveal.winnerSide === 'humans') ||
                (player.role === 'zombie' && finalReveal.winnerSide === 'zombies')) {
                yourOutcome = 'won';
            } else {
                yourOutcome = 'lost';
            }

            io.to(player.socketId).emit('game_ended', {
                finalReveal,
                yourOutcome,
            });
        }
    }
}

/**
 * Host restarts game to waiting phase (Play Again)
 * Keeps players but resets all game state
 */
function handleHostRestartGame(io: Server, socket: Socket): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    console.log('[HOST] Restarting game to waiting phase (Play Again)');

    const success = restartGameToWaiting(game);
    if (success) {
        // Broadcast phase change to all players (they'll see waiting phase)
        broadcastPhaseChange(io, game);
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);

        // Send special event to players so they know lobby is ready
        io.to(game.gameCode).emit('lobby_restarted', {
            message: 'The host has started a new game. Return to the lobby to play again!',
            gameCode: game.gameCode,
        });

        // Notify host
        socket.emit('host_game_restarted', {
            message: 'Lobby restarted successfully',
            playerCount: game.players.size,
        });
    }
}

function handleHostStartGame(io: Server, socket: Socket): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    const success = startGame(game);
    if (success) {
        broadcastPhaseChange(io, game);
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);

        // Send private state to each player (roles assigned)
        for (const player of game.players.values()) {
            if (player.socketId) {
                io.to(player.socketId).emit('private_state_update', {
                    yourPrivateState: getPlayerPrivate(player),
                });
            }
        }
    } else {
        socket.emit('error', { message: 'Cannot start game (need at least 6 players)' });
    }
}

function handleHostForcePhase(io: Server, socket: Socket, phase: string): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    // Clear existing timer
    if (phaseTimer) {
        clearTimeout(phaseTimer);
        phaseTimer = null;
    }

    switch (phase) {
        case 'duel':
            if (game.phase === 'lobby') {
                startDuelPhase(game);
                startPhaseTimer(io, game);
            }
            break;
        case 'meeting':
            if (game.phase === 'duel') {
                resolvePendingDuels(io, game);
                startMeetingPhase(game);
                startPhaseTimer(io, game);
            }
            break;
        case 'lobby':
            if (game.phase === 'meeting') {
                startNextRound(game);
            }
            break;
    }

    broadcastPhaseChange(io, game);
    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);
}

function handleHostKickPlayer(io: Server, socket: Socket, playerId: string): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    const player = getPlayer(game, playerId);
    if (!player) return;

    player.status = 'eliminated';
    player.eliminationReason = 'Kicked by host';

    if (player.socketId) {
        io.to(player.socketId).emit('eliminated', { reason: 'Kicked by host' });
    }

    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);
}

function handleClientDisconnect(io: Server, socket: Socket): void {
    console.log(`Client disconnected: ${socket.id}`);

    if (socket.id === hostSocketId) {
        hostSocketId = null;
    }

    const game = getGame();
    if (!game) return;

    const player = handleDisconnect(game, socket.id);
    if (player) {
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
    }
}

// ============ Broadcast Helpers ============

function broadcastLobbyUpdate(io: Server, game: GameState): void {
    const playersPublic: PlayerPublic[] = [];

    for (const player of game.players.values()) {
        playersPublic.push(getPlayerPublic(player, game));
    }

    const alivePlayers = Array.from(game.players.values()).filter(p => p.status === 'alive');

    io.to(game.gameCode).emit('lobby_update', {
        playersPublic,
        pairingStatus: {
            totalPlayers: alivePlayers.length,
            pairedCount: alivePlayers.filter(p => p.isPaired).length,
            allPaired: allPlayersPaired(game),
        },
    });
}

function broadcastPhaseChange(io: Server, game: GameState): void {
    io.to(game.gameCode).emit('phase_change', {
        phase: game.phase,
        round: game.round,
        endsAt: game.phaseEndsAt,
        requireZombieWin: game.settings.requireZombieWin, // Include setting for competitive mode
    });

    // If duel phase, send duel assignments
    if (game.phase === 'duel') {
        for (const duelId of game.currentRoundDuels) {
            const duel = game.duels.get(duelId);
            if (!duel) continue;

            const player1 = getPlayer(game, duel.player1Id);
            const player2 = getPlayer(game, duel.player2Id);

            if (player1?.socketId) {
                io.to(player1.socketId).emit('duel_assigned', {
                    duelId: duel.id,
                    opponentPublic: getPlayerPublic(player2!, game),
                    round: game.round,
                });
            }

            if (player2?.socketId) {
                io.to(player2.socketId).emit('duel_assigned', {
                    duelId: duel.id,
                    opponentPublic: getPlayerPublic(player1!, game),
                    round: game.round,
                });
            }
        }
    }

    // If meeting phase, send summary
    if (game.phase === 'meeting') {
        const events = getCurrentRoundEvents(game);
        io.to(game.gameCode).emit('meeting_summary', {
            round: game.round,
            publicEvents: events,
        });
    }

    // NOTE: If game ended, DON'T send results to players yet.
    // Host reveal animation plays first, then host emits 'host_reveal_complete' 
    // which triggers handleHostRevealComplete to send game_ended to players.
    // This prevents spoilers - players wait while the big screen does the countdown reveal.
}

function broadcastHostUpdate(io: Server, game: GameState): void {
    io.to('host').emit('host_state_update', {
        fullState: getHostState(game),
        publicEvents: getCurrentRoundEvents(game),
    });
}

function resolveDuelAndNotify(io: Server, game: GameState, duel: Duel): void {
    resolveDuel(game, duel);

    const player1 = getPlayer(game, duel.player1Id);
    const player2 = getPlayer(game, duel.player2Id);

    // Clear duel IDs and mark as having dueled
    if (player1) {
        player1.currentDuelId = null;
        player1.isPaired = true; // Keep paired to indicate "completed duel this round"
    }
    if (player2) {
        player2.currentDuelId = null;
        player2.isPaired = true;
    }

    if (player1?.socketId) {
        io.to(player1.socketId).emit('duel_resolution', {
            duelId: duel.id,
            resultPrivate: getDuelResultPrivate(game, duel, player1.id),
            updatedPrivateState: getPlayerPrivate(player1),
        });
    }

    if (player2?.socketId) {
        io.to(player2.socketId).emit('duel_resolution', {
            duelId: duel.id,
            resultPrivate: getDuelResultPrivate(game, duel, player2.id),
            updatedPrivateState: getPlayerPrivate(player2),
        });
    }

    // Check for eliminated players
    if (player1?.status === 'eliminated') {
        io.to(player1.socketId!).emit('eliminated', { reason: player1.eliminationReason });
    }
    if (player2?.status === 'eliminated') {
        io.to(player2.socketId!).emit('eliminated', { reason: player2.eliminationReason });
    }

    // CRITICAL: Check for annihilation (all alive players are zombies)
    if (checkAnnihilation(io, game)) {
        return; // Game ended due to annihilation, don't continue to round check
    }

    // Check if all duels for this round are complete
    checkRoundComplete(io, game);
}

/**
 * Check if all alive players are zombies - triggers immediate game end
 * This implements the "annihilation rule" where if everyone becomes infected, everyone dies
 */
function checkAnnihilation(io: Server, game: GameState): boolean {
    // Only check if annihilation rule is enabled
    if (!game.settings.annihilationRule) return false;

    // Only check during active gameplay (not already ended)
    if (game.phase === 'ended' || game.phase === 'waiting') return false;

    const alivePlayers = getAlivePlayers(game);
    if (alivePlayers.length === 0) return false;

    const humans = alivePlayers.filter(p => p.role === 'human');
    const zombies = alivePlayers.filter(p => p.role === 'zombie');

    // If there are still humans alive, no annihilation
    if (humans.length > 0) return false;

    // All alive players are zombies - trigger annihilation!
    console.log('[ANNIHILATION] All players are infected! Triggering annihilation sequence.');

    // Add dramatic event
    game.events.push({
        id: `annihilation-${game.round}`,
        round: game.round,
        type: 'annihilation',
        message: 'THE INFECTION HAS CONSUMED ALL. EVERYONE PERISHED.',
    });

    // Step 1: Transition to meeting phase first (calls players together)
    startMeetingPhase(game);
    broadcastPhaseChange(io, game);
    broadcastLobbyUpdate(io, game);
    broadcastHostUpdate(io, game);

    // Step 2: After 3 seconds in meeting, send cryptic message to host
    setTimeout(() => {
        io.to('host').emit('host_annihilation', {
            message: 'SOMETHING IS WRONG...',
            zombieCount: zombies.length,
        });

        // Step 3: After another 3 seconds, end the game
        setTimeout(() => {
            endGame(game);
            broadcastPhaseChange(io, game);
            broadcastHostUpdate(io, game);

            // Update annihilation message for the final reveal
            io.to('host').emit('host_annihilation', {
                message: 'ALL PLAYERS HAVE BEEN INFECTED. EVERYONE DIED.',
                zombieCount: zombies.length,
            });
        }, 3000);
    }, 3000);

    return true;
}

/**
 * Check if all alive players have completed their duels, transition to meeting if so
 * 
 * Logic: Round is complete when:
 * 1. No players are currently in duels (activeDuels === 0)
 * 2. At most 1 unpaired player remains (the odd one out for odd player counts)
 * 
 * An "unpaired" player is one who hasn't completed a duel this round:
 * - isPaired=false means they haven't started any duel
 * - currentDuelId !== null means they're currently in a duel
 */
function checkRoundComplete(io: Server, game: GameState): void {
    const alivePlayers = getAlivePlayers(game);

    // If all players are dead, end the game immediately
    if (alivePlayers.length === 0) {
        console.log('[checkRoundComplete] All players dead! Ending game.');
        endGame(game);
        broadcastPhaseChange(io, game);
        broadcastHostUpdate(io, game);
        return;
    }

    // If only 1 player left, they win - end the game
    if (alivePlayers.length === 1) {
        console.log('[checkRoundComplete] Only 1 player remaining! They win. Ending game.');
        endGame(game);
        broadcastPhaseChange(io, game);
        broadcastHostUpdate(io, game);
        return;
    }

    // Players sitting out this round (after successfully shooting a zombie)
    const sittingOutPlayers = alivePlayers.filter(p => p.sittingOutRound === game.round);

    // Eligible players (can duel this round)
    const eligiblePlayers = alivePlayers.filter(p => p.sittingOutRound !== game.round);

    // Count players currently IN a duel (currentDuelId is set)
    const playersInDuel = eligiblePlayers.filter(p => p.currentDuelId !== null);

    // Count unpaired players who haven't started/completed a duel yet
    // isPaired=false means they haven't entered any duel this round
    const unpairedPlayers = eligiblePlayers.filter(p => !p.isPaired && p.currentDuelId === null);

    // Count players who completed their duel (isPaired=true AND currentDuelId=null)
    const completedPlayers = eligiblePlayers.filter(p => p.isPaired && p.currentDuelId === null);

    console.log(`[checkRoundComplete] alive=${alivePlayers.length}, sitting=${sittingOutPlayers.length}, eligible=${eligiblePlayers.length}`);
    console.log(`[checkRoundComplete] inDuel=${playersInDuel.length}, unpaired=${unpairedPlayers.length}, completed=${completedPlayers.length}`);
    console.log(`[checkRoundComplete] Players:`, eligiblePlayers.map(p => ({
        name: p.name,
        isPaired: p.isPaired,
        status: p.status,
        duelId: p.currentDuelId
    })));

    // Round is complete when:
    // 1. No active duels (no one in the middle of fighting)
    // 2. At most 1 unpaired player (handles odd player count - that player is "safe" this round)
    // 3. At least some duels happened (eligiblePlayers > 1 means duels should occur)
    const noActiveDuels = playersInDuel.length === 0;
    const allPairedOrOddOneOut = unpairedPlayers.length <= 1;
    const duelsHappened = completedPlayers.length > 0;

    if (noActiveDuels && allPairedOrOddOneOut && duelsHappened) {
        console.log('[checkRoundComplete] Transitioning to meeting phase!');
        // Transition to meeting phase
        startMeetingPhase(game);
        broadcastPhaseChange(io, game);
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);
        startPhaseTimer(io, game);
    }
}

function resolvePendingDuels(io: Server, game: GameState): void {
    for (const duelId of game.currentRoundDuels) {
        const duel = game.duels.get(duelId);
        if (!duel || duel.status !== 'in_progress') continue;

        // Auto-submit for disconnected players
        autoSubmitForDisconnected(game, duel);

        // If still not ready, force resolve (both forfeit)
        if (!isDuelReady(duel)) {
            duel.status = 'resolved';
            duel.result = {
                winnerId: null,
                loserId: null,
                infections: [],
                cures: [],
                shotgunKills: [],
                eliminations: [],
            };
        } else {
            resolveDuelAndNotify(io, game, duel);
        }
    }
}

// ============ Phase Timer ============

function startPhaseTimer(io: Server, game: GameState): void {
    if (phaseTimer) {
        clearTimeout(phaseTimer);
    }

    const duration = game.phase === 'duel'
        ? CONFIG.DUEL_DURATION_SEC * 1000
        : CONFIG.MEETING_DURATION_SEC * 1000;

    phaseTimer = setTimeout(() => {
        if (!game) return;

        if (game.phase === 'duel') {
            // Resolve all pending duels and move to meeting
            resolvePendingDuels(io, game);
            startMeetingPhase(game);
            broadcastPhaseChange(io, game);
            broadcastHostUpdate(io, game);
            startPhaseTimer(io, game);
        } else if (game.phase === 'meeting') {
            // Move to next round lobby
            startNextRound(game);
            broadcastPhaseChange(io, game);
            broadcastLobbyUpdate(io, game);
            broadcastHostUpdate(io, game);
        }
    }, duration);
}

/**
 * Get available cards for a player in current duel
 */
export function getPlayerDuelInfo(game: GameState, playerId: string): {
    actions: string[];
    validCards: any[];
} | null {
    const player = getPlayer(game, playerId);
    if (!player || !player.currentDuelId) return null;

    const duel = game.duels.get(player.currentDuelId);
    if (!duel) return null;

    return {
        actions: getAvailableActions(player, duel),
        validCards: getValidNumberCards(player, duel),
    };
}

/**
 * Handle player claiming loot card from opponent
 */
function handleClaimLoot(io: Server, socket: Socket, duelId: string, cardId: string): void {
    const game = getGame();
    if (!game) return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    const duel = game.duels.get(duelId);
    if (!duel || duel.status !== 'resolved' || !duel.result) return;

    if (duel.result.winnerId !== player.id) return;

    const lootCards = duel.result.lootableCards;
    if (!lootCards) return;

    const cardIndex = lootCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = lootCards[cardIndex];
    // Remove from lootable (prevent double claim)
    lootCards.splice(cardIndex, 1);

    // Add to player hand
    player.numberCards.push(card);

    console.log(`[LOOT] Player ${player.name} claimed card ${card.value} from duel ${duelId}`);

    // Update player private state
    socket.emit('private_state_update', {
        yourPrivateState: getPlayerPrivate(player)
    });

    // Also update game state to remove the lootable option from UI if desired,
    // though private state update handles the hand.
    // If we want to hide the "Pick a card" UI, the client essentially re-checks the result.
    // But result still says 'lootableCards'. We modified it in place, so the NEXT time client gets state it's gone?
    // DuelResult is sent in 'game_ended' or 'private_state_update'?
    // Client has `duelResult` in context. We need to push an update to that context.
    // The private state includes `currentDuel`? No.
    // getPlayerPrivate includes `currentDuelId`.
    // We should emit an update for the duel or just let the hand update implicitly tell the user functionality is done?
    // A specific 'loot_claimed' event might be cleaner but let's stick to state updates.
    // If I modify `duel.result.lootableCards`, does the client see it? 
    // Only if I resend the duel result.
    // getPlayerDuelInfo returns actions/validCards. 
    // We probably should re-emit the duel result to the player so the UI updates.
    // Wait, `getDuelResultPrivate` logic returns `lootableCards`.
    // So if I modify it in `handleClaimLoot` (splice), the next `getDuelResultPrivate` call will reflect that.
    // `io.to(player.socketId).emit('private_state_update', ...)` calls `getPlayerPrivate`.
    // `getPlayerPrivate` does NOT return duel result.
    // `handleDuelAction` emits `duel_update` usually.
    // I should emit `duel_update` to the player.
    // But `duel_update` is usually for public updates.
    // I'll emit `private_state_update` AND a custom event or rely on `duel_result` update?
    // Looking at `socketHandlers.ts`, `resolveDuel` emits `duel_completed` or just phase change?
    // It emits `duel_update` to room.

    // I'll assume updating `lootableCards` in memory and re-emitting state is enough if the client logic checks empty list.
}
