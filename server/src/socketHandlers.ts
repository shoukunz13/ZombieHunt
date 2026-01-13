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
    getCurrentRoundEvents, resetGame, clearGame, completeIntro, updateSettings, endGame
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

// Store phase timers
let phaseTimer: NodeJS.Timeout | null = null;
let hostSocketId: string | null = null;

/**
 * Initialize Socket.io handlers
 */
export function initializeSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id}`);

        // ============ Client Events ============

        socket.on('join_game', ({ gameCode, name }: { gameCode: string; name: string }) => {
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

        socket.on('host_auth', ({ pin }: { pin: string }) => {
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

        socket.on('host_update_settings', (settings: { maxRounds?: number; zombiesPerTeam?: number }) => {
            handleHostUpdateSettings(io, socket, settings);
        });

        // ============ Disconnect ============

        socket.on('disconnect', () => {
            handleClientDisconnect(io, socket);
        });
    });
}

// ============ Handler Implementations ============

async function handleJoinGame(io: Server, socket: Socket, gameCode: string, name: string): Promise<void> {
    // Rate limit join attempts
    try {
        await joinRateLimiter.consume(socket.handshake.address);
    } catch {
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
    // Rate limit auth attempts to prevent brute-force
    try {
        await authRateLimiter.consume(socket.handshake.address);
    } catch {
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

function handleHostUpdateSettings(io: Server, socket: Socket, settings: { maxRounds?: number; zombiesPerTeam?: number }): void {
    if (socket.id !== hostSocketId) return;

    const game = getGame();
    if (!game) return;

    const success = updateSettings(game, settings);
    if (success) {
        console.log('Host updated settings:', game.settings);
        broadcastHostUpdate(io, game);
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

    io.to(game.gameCode).emit('lobby_update', {
        playersPublic,
        pairingStatus: {
            totalPlayers: game.players.size,
            pairedCount: Array.from(game.players.values()).filter(p => p.isPaired).length,
            allPaired: allPlayersPaired(game),
        },
    });
}

function broadcastPhaseChange(io: Server, game: GameState): void {
    io.to(game.gameCode).emit('phase_change', {
        phase: game.phase,
        round: game.round,
        endsAt: game.phaseEndsAt,
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

    // If game ended, send final reveal
    if (game.phase === 'ended') {
        const finalReveal = getFinalReveal(game);

        for (const player of game.players.values()) {
            if (player.socketId) {
                io.to(player.socketId).emit('game_ended', {
                    finalReveal,
                    yourOutcome: finalReveal.winnerSide === 'tie' ? 'tie'
                        : (player.role === 'human' && finalReveal.winnerSide === 'humans') ||
                            (player.role === 'zombie' && finalReveal.winnerSide === 'zombies')
                            ? 'won' : 'lost',
                });
            }
        }
    }
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

    // Check if all duels for this round are complete
    checkRoundComplete(io, game);
}

/**
 * Check if all alive players have completed their duels, transition to meeting if so
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

    // Count players who have completed duels (isPaired = true AND currentDuelId = null)
    const completedCount = alivePlayers.filter(p => p.isPaired && !p.currentDuelId).length;

    // Count players currently in duels
    const inDuelCount = alivePlayers.filter(p => p.currentDuelId !== null).length;

    // Count players sitting out this round (after successfully shooting a zombie)
    const sittingOutCount = alivePlayers.filter(p => p.sittingOutRound === game.round).length;

    // Eligible duelers = alive players minus those sitting out
    const eligibleDuelers = alivePlayers.length - sittingOutCount;

    // If odd number of eligible duelers, one player won't duel
    const expectedDuelers = eligibleDuelers % 2 === 0
        ? eligibleDuelers
        : eligibleDuelers - 1;

    console.log(`[checkRoundComplete] alive=${alivePlayers.length}, sittingOut=${sittingOutCount}, completed=${completedCount}, inDuel=${inDuelCount}, expected=${expectedDuelers}`);
    console.log(`[checkRoundComplete] Players:`, alivePlayers.map(p => ({ name: p.name, isPaired: p.isPaired, duelId: p.currentDuelId, sittingOut: p.sittingOutRound === game.round })));

    // All expected duelers have completed, and no one is currently in a duel
    if (completedCount >= expectedDuelers && inDuelCount === 0) {
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
