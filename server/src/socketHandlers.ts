/**
 * Zombie Hunt - Socket.io Event Handlers
 * All real-time communication between clients, host, and server.
 */

import { Server, Socket } from 'socket.io';
import {
    getOrCreateGame, getGame, addPlayer, findPlayerBySocketId,
    handleDisconnect, handleReconnect, selectOpponent, cancelSelection,
    allPlayersPaired, startGame, startDuelPhase, startMeetingPhase,
    startNextRound, getPlayer, getPlayerPublic, getPlayerPrivate,
    getGameStatePublic, getHostState, getFinalReveal, getAlivePlayers,
    getCurrentRoundEvents, resetGame, clearGame
} from './gameState';
import {
    submitDuelAction, resolveDuel, isDuelReady, getDuelResultPrivate,
    autoSubmitForDisconnected, getAvailableActions, getValidNumberCards
} from './duelResolver';
import { CONFIG } from './config';
import { GameState, Player, Duel, PlayerPublic } from './types';

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

        // ============ Disconnect ============

        socket.on('disconnect', () => {
            handleClientDisconnect(io, socket);
        });
    });
}

// ============ Handler Implementations ============

function handleJoinGame(io: Server, socket: Socket, gameCode: string, name: string): void {
    const game = getOrCreateGame(gameCode);

    // Try reconnection first
    if (game.phase !== 'waiting') {
        const player = handleReconnect(game, name, socket.id);
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

function handleSelectOpponent(io: Server, socket: Socket, opponentId: string): void {
    const game = getGame();
    if (!game || game.phase !== 'lobby') return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    const success = selectOpponent(game, player.id, opponentId);
    if (success) {
        broadcastLobbyUpdate(io, game);
        broadcastHostUpdate(io, game);

        // Check if all players are paired
        if (allPlayersPaired(game)) {
            // Auto-start duel phase
            startDuelPhase(game);
            broadcastPhaseChange(io, game);
            startPhaseTimer(io, game);
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

function handleDuelAction(
    io: Server,
    socket: Socket,
    duelId: string,
    actionType: 'number' | 'zombie' | 'vaccine' | 'shotgun',
    cardId?: string,
    cardIds?: string[]
): void {
    const game = getGame();
    if (!game || game.phase !== 'duel') return;

    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    const duel = game.duels.get(duelId);
    if (!duel || duel.status !== 'in_progress') return;

    // Verify player is in this duel
    if (duel.player1Id !== player.id && duel.player2Id !== player.id) return;

    const result = submitDuelAction(game, duel, player.id, actionType, cardId, cardIds);

    if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
    }

    // Send updated duel state
    socket.emit('duel_action_confirmed', { duelId });

    // Check if both players have submitted
    if (isDuelReady(duel)) {
        resolveDuelAndNotify(io, game, duel);
    }

    broadcastHostUpdate(io, game);
}

function handleHostAuth(io: Server, socket: Socket, pin: string): void {
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
        playersPublic.push(getPlayerPublic(player));
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
                    opponentPublic: getPlayerPublic(player2!),
                    round: game.round,
                });
            }

            if (player2?.socketId) {
                io.to(player2.socketId).emit('duel_assigned', {
                    duelId: duel.id,
                    opponentPublic: getPlayerPublic(player1!),
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
