/**
 * Zombie Hunt - Socket.io Event Handlers
 * All real-time communication between clients, host, and server.
 * 
 * Multi-tenant architecture: Each socket is associated with a lobby via socket.data
 */

import { Server, Socket } from 'socket.io';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import {
    addPlayer, findPlayerBySocketId, removePlayer,
    handleDisconnect, handleReconnect, handleReconnectById, selectOpponent, cancelSelection,
    declineInvite, allPlayersPaired, startGame, startDuelPhase, startMeetingPhase,
    startNextRound, getPlayer, getPlayerPublic, getPlayerPrivate,
    getGameStatePublic, getHostState, getFinalReveal, getAlivePlayers,
    getCurrentRoundEvents, completeIntro, updateSettings, endGame,
    restartGameToWaiting
} from './gameState';
import {
    submitDuelAction, resolveDuel, isDuelReady, getDuelResultPrivate,
    autoSubmitForDisconnected, getAvailableActions, getValidNumberCards
} from './duelResolver';
import { CONFIG } from './config';
import { GameState, Player, Duel, PlayerPublic } from './types';
import * as lobbyManager from './lobbyManager';

// ============ Socket Data Interface ============

interface SocketData {
    lobbyCode: string | null;
    playerId: string | null;
    isHost: boolean;
}

// NOTE: Socket.data is already typed via Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>
// No need to extend the module as the data property is built-in

// ============ Rate Limiters ============

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

const createLobbyRateLimiter = new RateLimiterMemory({
    points: 3,       // 3 lobbies
    duration: 60,    // per minute
    blockDuration: 300, // 5 min block if exceeded
});

// ============ Helpers ============

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

// Get lobby room name
function getLobbyRoom(code: string): string {
    return `lobby:${code}`;
}

// Store phase timers per lobby
const phaseTimers = new Map<string, NodeJS.Timeout>();

// Global host socket tracking (for admin dashboard)
let adminHostSocketId: string | null = null;

// Metrics type for observability
interface Metrics {
    totalConnections: number;
    activeConnections: number;
    totalEvents: number;
    rateLimitBlocks: number;
}

// Module-level metrics reference
let serverMetrics: Metrics | null = null;

// ============ Initialize Handlers ============

/**
 * Initialize Socket.io handlers
 */
export function initializeSocketHandlers(io: Server, metrics?: Metrics): void {
    serverMetrics = metrics || null;

    io.on('connection', (socket: Socket) => {
        console.log(`[CONN] ${socket.id} connected`);

        // Initialize socket data
        socket.data = {
            lobbyCode: null,
            playerId: null,
            isHost: false,
        };

        // ============ Lobby Management Events ============

        socket.on('create_lobby', async () => {
            await handleCreateLobby(io, socket);
        });

        socket.on('join_lobby', async (data: unknown) => {
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Invalid request' });
                return;
            }
            const { lobbyCode, playerName } = data as { lobbyCode: string; playerName: string };
            if (typeof lobbyCode !== 'string' || typeof playerName !== 'string') {
                socket.emit('error', { message: 'Invalid request format' });
                return;
            }
            await handleJoinLobby(io, socket, lobbyCode, playerName);
        });

        socket.on('reconnect_lobby', async (data: unknown) => {
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Invalid request' });
                return;
            }
            const { lobbyCode, playerToken } = data as { lobbyCode: string; playerToken: string };
            if (typeof lobbyCode !== 'string' || typeof playerToken !== 'string') {
                socket.emit('error', { message: 'Invalid request format' });
                return;
            }
            handleReconnectLobby(io, socket, lobbyCode, playerToken);
        });

        socket.on('host_join_lobby', (data: unknown) => {
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Invalid request' });
                return;
            }
            const { lobbyCode, hostToken } = data as { lobbyCode: string; hostToken: string };
            if (typeof lobbyCode !== 'string' || typeof hostToken !== 'string') {
                socket.emit('error', { message: 'Invalid request format' });
                return;
            }
            handleHostJoinLobby(io, socket, lobbyCode, hostToken);
        });

        // ============ Legacy Join Event (for backwards compatibility during transition) ============

        socket.on('join_game', (data: unknown) => {
            // Redirect to join_lobby
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Invalid request' });
                return;
            }
            const { gameCode, name } = data as { gameCode: string; name: string };
            if (typeof gameCode !== 'string' || typeof name !== 'string') {
                socket.emit('error', { message: 'Invalid request format' });
                return;
            }
            handleJoinLobby(io, socket, gameCode, name);
        });

        // ============ Player Events ============

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

        socket.on('leave_game', () => {
            handleLeaveGame(io, socket);
        });

        // ============ Host Events (Per-Lobby) ============

        socket.on('host_start_game', (data?: { hostToken?: string }) => {
            handleHostStartGame(io, socket, data?.hostToken);
        });

        socket.on('host_force_phase', (data: { phase: string; hostToken?: string }) => {
            handleHostForcePhase(io, socket, data.phase, data.hostToken);
        });

        socket.on('host_kick_player', (data: { playerId: string; hostToken?: string }) => {
            handleHostKickPlayer(io, socket, data.playerId, data.hostToken);
        });

        socket.on('host_end_game', (data?: { hostToken?: string }) => {
            handleHostEndGame(io, socket, data?.hostToken);
        });

        socket.on('host_intro_complete', (data?: { hostToken?: string }) => {
            handleHostIntroComplete(io, socket, data?.hostToken);
        });

        socket.on('host_update_settings', (data: { settings: Partial<import('./types').GameSettings>; hostToken?: string }) => {
            handleHostUpdateSettings(io, socket, data.settings, data.hostToken);
        });

        socket.on('host_reveal_complete', (data?: { hostToken?: string }) => {
            handleHostRevealComplete(io, socket, data?.hostToken);
        });

        socket.on('host_restart_game', (data?: { hostToken?: string }) => {
            handleHostRestartGame(io, socket, data?.hostToken);
        });

        // ============ Admin Dashboard Events (Global - requires HOST_PIN) ============

        socket.on('host_auth', (data: unknown) => {
            if (!data || typeof data !== 'object') {
                socket.emit('host_auth_failed', { message: 'Invalid request' });
                return;
            }
            const { pin } = data as { pin: string };
            if (typeof pin !== 'string') {
                socket.emit('host_auth_failed', { message: 'Invalid request format' });
                return;
            }
            handleAdminAuth(io, socket, pin);
        });

        socket.on('admin_get_lobbies', () => {
            handleAdminGetLobbies(io, socket);
        });

        // ============ Disconnect ============

        socket.on('disconnect', () => {
            handleClientDisconnect(io, socket);
        });
    });
}

// ============ Lobby Management Handlers ============

async function handleCreateLobby(io: Server, socket: Socket): Promise<void> {
    const clientIP = normalizeIP(socket.handshake.address);

    // Rate limit lobby creation
    try {
        await createLobbyRateLimiter.consume(clientIP);
    } catch {
        console.log(`[RATE-LIMIT] create_lobby blocked for IP ${clientIP}`);
        if (serverMetrics) serverMetrics.rateLimitBlocks++;
        socket.emit('error', { message: 'Too many lobby creations. Please wait.' });
        return;
    }

    const result = lobbyManager.createLobby();
    if (!result.success) {
        socket.emit('too_many_lobbies', {});
        return;
    }

    // Mark this socket as the host
    socket.data.lobbyCode = result.lobbyCode;
    socket.data.isHost = true;

    // Join the lobby room
    socket.join(getLobbyRoom(result.lobbyCode));

    console.log(`[LOBBY] Socket ${socket.id} created lobby ${result.lobbyCode}`);

    socket.emit('lobby_created', {
        lobbyCode: result.lobbyCode,
        hostToken: result.hostToken,
    });
}

async function handleJoinLobby(io: Server, socket: Socket, lobbyCode: string, playerName: string): Promise<void> {
    const clientIP = normalizeIP(socket.handshake.address);

    // Rate limit join attempts
    try {
        await joinRateLimiter.consume(clientIP);
    } catch {
        console.log(`[RATE-LIMIT] join_lobby blocked for IP ${clientIP}`);
        if (serverMetrics) serverMetrics.rateLimitBlocks++;
        socket.emit('error', { message: 'Too many join attempts. Please wait.' });
        return;
    }

    // Sanitize player name
    const sanitizedName = playerName.trim().replace(/[<>"'&]/g, '').substring(0, 16);
    if (!sanitizedName || sanitizedName.length < 1) {
        socket.emit('error', { message: 'Invalid name' });
        return;
    }

    // Get lobby
    const lobby = lobbyManager.getLobby(lobbyCode);
    if (!lobby) {
        socket.emit('lobby_not_found', { code: lobbyCode });
        return;
    }

    // Check if lobby is full
    if (lobby.state.players.size >= lobby.config.maxPlayers) {
        socket.emit('lobby_full', { code: lobbyCode });
        return;
    }

    const game = lobby.state;

    // Try reconnection first if game started
    if (game.phase !== 'waiting') {
        const player = handleReconnect(game, sanitizedName, socket.id);
        if (player) {
            // Generate or get existing player token
            let playerToken: string;
            const existingToken = lobby.playerTokens.get(player.id);
            if (existingToken) {
                playerToken = existingToken;
            } else {
                playerToken = lobbyManager.registerPlayerToken(lobbyCode, player.id);
            }

            socket.data.lobbyCode = lobbyCode;
            socket.data.playerId = player.id;
            socket.join(getLobbyRoom(lobbyCode));

            socket.emit('joined', {
                playerId: player.id,
                playerToken,
                gameStatePublic: getGameStatePublic(game),
                yourPrivateState: getPlayerPrivate(player),
            });
            broadcastLobbyUpdate(io, lobby);
            broadcastHostUpdate(io, lobby);
            return;
        } else {
            socket.emit('error', { message: 'Game already started, cannot join' });
            return;
        }
    }

    // New player joining
    const player = addPlayer(game, sanitizedName, socket.id);
    if (!player) {
        socket.emit('error', { message: 'Name already taken or invalid' });
        return;
    }

    // Generate player token
    const playerToken = lobbyManager.registerPlayerToken(lobbyCode, player.id);

    socket.data.lobbyCode = lobbyCode;
    socket.data.playerId = player.id;
    socket.join(getLobbyRoom(lobbyCode));

    lobbyManager.updateActivity(lobbyCode);

    socket.emit('joined', {
        playerId: player.id,
        playerToken,
        gameStatePublic: getGameStatePublic(game),
        yourPrivateState: getPlayerPrivate(player),
    });

    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

function handleReconnectLobby(io: Server, socket: Socket, lobbyCode: string, playerToken: string): void {
    const lobby = lobbyManager.getLobby(lobbyCode);
    if (!lobby) {
        socket.emit('lobby_not_found', { code: lobbyCode });
        return;
    }

    // Validate token and get player ID
    const playerId = lobbyManager.getPlayerIdFromToken(lobbyCode, playerToken);
    if (!playerId) {
        socket.emit('error', { message: 'Invalid or expired session' });
        return;
    }

    const game = lobby.state;
    const player = handleReconnectById(game, playerId, socket.id);
    if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
    }

    socket.data.lobbyCode = lobbyCode;
    socket.data.playerId = playerId;
    socket.join(getLobbyRoom(lobbyCode));

    lobbyManager.updateActivity(lobbyCode);

        socket.emit('joined', {
            playerId: player.id,
        playerToken, // Return the same token
            gameStatePublic: getGameStatePublic(game),
            yourPrivateState: getPlayerPrivate(player),
        });

    console.log(`[RECONNECT] Player ${player.name} reconnected to lobby ${lobbyCode}`);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

/**
 * Handle host joining a lobby (not as a player)
 * Host connects to receive state updates without being added as a player
 */
function handleHostJoinLobby(io: Server, socket: Socket, lobbyCode: string, hostToken: string): void {
    const lobby = lobbyManager.getLobby(lobbyCode);
    if (!lobby) {
        socket.emit('lobby_not_found', { code: lobbyCode });
        return;
    }

    // Validate host token
    if (!lobbyManager.validateHostToken(lobbyCode, hostToken)) {
        socket.emit('error', { message: 'Invalid host token' });
        return;
    }

    // Mark socket as host and join the lobby room
    socket.data.lobbyCode = lobbyCode;
    socket.data.isHost = true;
    socket.data.playerId = null; // Host is NOT a player
    socket.join(getLobbyRoom(lobbyCode));

    lobbyManager.updateActivity(lobbyCode);

    console.log(`[HOST] Host joined lobby ${lobbyCode}`);

    // Send host state immediately
    socket.emit('host_joined', {
        lobbyCode: lobby.code,
        hostState: getHostState(lobby.state),
    });

    // Broadcast update so host sees current state
    broadcastHostUpdate(io, lobby);
}

// ============ Helper: Get Lobby from Socket ============

function getLobbyFromSocket(socket: Socket): lobbyManager.LobbyInstance | null {
    const lobbyCode = socket.data.lobbyCode;
    if (!lobbyCode) return null;
    return lobbyManager.getLobby(lobbyCode);
}

// ============ Helper: Validate Host Token ============

function validateHostAccess(socket: Socket, hostToken?: string): lobbyManager.LobbyInstance | null {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby) return null;

    // If hostToken provided, validate it
    if (hostToken) {
        if (!lobbyManager.validateHostToken(lobby.code, hostToken)) {
            socket.emit('error', { message: 'Invalid host token' });
            return null;
        }
        return lobby;
    }

    // If socket is marked as host
    if (socket.data.isHost) {
        return lobby;
    }

    socket.emit('error', { message: 'Not authorized' });
    return null;
}

// ============ Player Event Handlers ============

function handleSelectOpponent(io: Server, socket: Socket, opponentId: string): void {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby || lobby.state.phase !== 'lobby') return;

    const game = lobby.state;
    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    const result = selectOpponent(game, player.id, opponentId);
    if (result.success) {
        lobbyManager.updateActivity(lobby.code);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);

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
    const lobby = getLobbyFromSocket(socket);
    if (!lobby || lobby.state.phase !== 'lobby') return;

    const game = lobby.state;
    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    cancelSelection(game, player.id);
    lobbyManager.updateActivity(lobby.code);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

function handleDeclineInvite(io: Server, socket: Socket, inviterId: string): void {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby || lobby.state.phase !== 'lobby') return;

    const game = lobby.state;
    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    declineInvite(game, player.id, inviterId);
    lobbyManager.updateActivity(lobby.code);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

function handleDuelAction(
    io: Server,
    socket: Socket,
    duelId: string,
    actionType: 'number' | 'zombie' | 'vaccine' | 'shotgun',
    cardId?: string,
    cardIds?: string[]
): void {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby) return;

    const game = lobby.state;

    // Allow duel actions in lobby phase (individual duels) or duel phase (legacy)
    if (game.phase !== 'lobby' && game.phase !== 'duel') return;

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

    lobbyManager.updateActivity(lobby.code);

    // Send updated duel state
    socket.emit('duel_action_confirmed', { duelId });

    // Check if both players have submitted
    if (isDuelReady(duel)) {
        resolveDuelAndNotify(io, lobby, duel);
    }

    broadcastHostUpdate(io, lobby);
}

function handleClaimLoot(io: Server, socket: Socket, duelId: string, cardId: string): void {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby) return;

    const game = lobby.state;
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
    lootCards.splice(cardIndex, 1);
    player.numberCards.push(card);

    console.log(`[LOOT] Player ${player.name} claimed card ${card.value} from duel ${duelId}`);

    socket.emit('private_state_update', {
        yourPrivateState: getPlayerPrivate(player)
    });
}

function handleLeaveGame(io: Server, socket: Socket): void {
    const lobby = getLobbyFromSocket(socket);
    if (!lobby) return;

    const game = lobby.state;
    const player = findPlayerBySocketId(game, socket.id);
    if (!player) return;

    // Only allow leaving during waiting phase
    if (game.phase === 'waiting') {
        removePlayer(game, player.id);
        socket.leave(getLobbyRoom(lobby.code));
        socket.data.lobbyCode = null;
        socket.data.playerId = null;
        console.log(`Player ${player.name} left lobby ${lobby.code}`);

        lobbyManager.updateActivity(lobby.code);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);
    }
}

// ============ Host Event Handlers (Per-Lobby) ============

function handleHostStartGame(io: Server, socket: Socket, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;
    const success = startGame(game);
    if (success) {
        lobby.status = 'in_game';
        lobbyManager.updateActivity(lobby.code);

        broadcastPhaseChange(io, lobby);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);

        // Send private state to each player (roles assigned)
        for (const player of game.players.values()) {
            if (player.socketId) {
                io.to(player.socketId).emit('private_state_update', {
                    yourPrivateState: getPlayerPrivate(player),
                });
            }
        }
    } else {
        socket.emit('error', { message: 'Cannot start game (need at least 4 players)' });
    }
}

function handleHostForcePhase(io: Server, socket: Socket, phase: string, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;

    // Clear existing timer
    const existingTimer = phaseTimers.get(lobby.code);
    if (existingTimer) {
        clearTimeout(existingTimer);
        phaseTimers.delete(lobby.code);
    }

    switch (phase) {
        case 'duel':
            if (game.phase === 'lobby') {
                startDuelPhase(game);
                startPhaseTimer(io, lobby);
            }
            break;
        case 'meeting':
            if (game.phase === 'duel') {
                resolvePendingDuels(io, lobby);
                startMeetingPhase(game);
                startPhaseTimer(io, lobby);
            }
            break;
        case 'lobby':
            if (game.phase === 'meeting') {
                startNextRound(game);
            }
            break;
    }

    lobbyManager.updateActivity(lobby.code);
    broadcastPhaseChange(io, lobby);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

function handleHostKickPlayer(io: Server, socket: Socket, playerId: string, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;
    const player = getPlayer(game, playerId);
    if (!player) return;

    player.status = 'eliminated';
    player.eliminationReason = 'Kicked by host';

    if (player.socketId) {
        io.to(player.socketId).emit('eliminated', { reason: 'Kicked by host' });
    }

    lobbyManager.updateActivity(lobby.code);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);
}

function handleHostEndGame(io: Server, socket: Socket, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    // Clear phase timer
    const existingTimer = phaseTimers.get(lobby.code);
    if (existingTimer) {
        clearTimeout(existingTimer);
        phaseTimers.delete(lobby.code);
    }

    // Notify all players that game has ended
    io.to(getLobbyRoom(lobby.code)).emit('game_force_ended', {
            message: 'Game has been terminated by host'
        });

    // Delete the lobby
    lobbyManager.deleteLobby(lobby.code);

    console.log(`Host force ended lobby ${lobby.code}`);

    socket.emit('host_game_ended', {
        message: 'Game terminated successfully'
    });
}

function handleHostIntroComplete(io: Server, socket: Socket, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;
    const success = completeIntro(game);
    if (success) {
        console.log(`Host completed intro video for lobby ${lobby.code}`);
        lobbyManager.updateActivity(lobby.code);
        broadcastPhaseChange(io, lobby);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);
    }
}

function handleHostUpdateSettings(io: Server, socket: Socket, settings: Partial<import('./types').GameSettings>, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;
    const success = updateSettings(game, settings);
    if (success) {
        console.log(`Host updated settings for lobby ${lobby.code}`);
        lobbyManager.updateActivity(lobby.code);
        broadcastHostUpdate(io, lobby);
    }
}

function handleHostRevealComplete(io: Server, socket: Socket, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby || lobby.state.phase !== 'ended') return;

    const game = lobby.state;
    console.log(`[HOST] Reveal complete for lobby ${lobby.code}`);

    const finalReveal = getFinalReveal(game);

    // Send game_ended to all players
    for (const player of game.players.values()) {
        if (player.socketId) {
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

    lobby.status = 'ended';
}

function handleHostRestartGame(io: Server, socket: Socket, hostToken?: string): void {
    const lobby = validateHostAccess(socket, hostToken);
    if (!lobby) return;

    const game = lobby.state;
    console.log(`[HOST] Restarting lobby ${lobby.code}`);

    const success = restartGameToWaiting(game);
    if (success) {
        lobby.status = 'waiting';
        lobbyManager.updateActivity(lobby.code);

        broadcastPhaseChange(io, lobby);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);

        io.to(getLobbyRoom(lobby.code)).emit('lobby_restarted', {
            message: 'The host has started a new game. Return to the lobby to play again!',
            lobbyCode: lobby.code,
        });

        socket.emit('host_game_restarted', {
            message: 'Lobby restarted successfully',
            playerCount: game.players.size,
        });
    }
}

// ============ Admin Dashboard Handlers (Global) ============

async function handleAdminAuth(io: Server, socket: Socket, pin: string): Promise<void> {
    const clientIP = normalizeIP(socket.handshake.address);

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

    adminHostSocketId = socket.id;
    socket.join('admin');

    // Send current state of all lobbies
    const lobbies = lobbyManager.getAllLobbies();
    socket.emit('host_authed', {
        lobbies: lobbies.map(l => ({
            code: l.code,
            status: l.status,
            playerCount: l.state.players.size,
            phase: l.state.phase,
            createdAt: l.createdAt,
        })),
    });
}

function handleAdminGetLobbies(io: Server, socket: Socket): void {
    if (socket.id !== adminHostSocketId) {
        socket.emit('error', { message: 'Not authorized' });
        return;
    }

    const lobbies = lobbyManager.getAllLobbies();
    socket.emit('admin_lobbies', {
        lobbies: lobbies.map(l => ({
            code: l.code,
            status: l.status,
            playerCount: l.state.players.size,
            phase: l.state.phase,
            createdAt: l.createdAt,
            lastActivityAt: l.lastActivityAt,
            hostState: getHostState(l.state),
        })),
    });
}

// ============ Disconnect Handler ============

function handleClientDisconnect(io: Server, socket: Socket): void {
    console.log(`Client disconnected: ${socket.id}`);

    if (socket.id === adminHostSocketId) {
        adminHostSocketId = null;
    }

    const lobby = getLobbyFromSocket(socket);
    if (!lobby) return;

    const game = lobby.state;
    const player = handleDisconnect(game, socket.id);
    if (player) {
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);
    }
}

// ============ Broadcast Helpers ============

function broadcastLobbyUpdate(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;
    const playersPublic: PlayerPublic[] = [];

    for (const player of game.players.values()) {
        playersPublic.push(getPlayerPublic(player, game));
    }

    const alivePlayers = Array.from(game.players.values()).filter(p => p.status === 'alive');

    io.to(getLobbyRoom(lobby.code)).emit('lobby_update', {
        playersPublic,
        pairingStatus: {
            totalPlayers: alivePlayers.length,
            pairedCount: alivePlayers.filter(p => p.isPaired).length,
            allPaired: allPlayersPaired(game),
        },
    });
}

function broadcastPhaseChange(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;

    io.to(getLobbyRoom(lobby.code)).emit('phase_change', {
        phase: game.phase,
        round: game.round,
        endsAt: game.phaseEndsAt,
        requireZombieWin: game.settings.requireZombieWin,
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
        io.to(getLobbyRoom(lobby.code)).emit('meeting_summary', {
            round: game.round,
            publicEvents: events,
        });
    }
}

function broadcastHostUpdate(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;

    // Send to the lobby room (the host socket is in this room)
    io.to(getLobbyRoom(lobby.code)).emit('host_state_update', {
        fullState: getHostState(game),
        publicEvents: getCurrentRoundEvents(game),
    });

    // Also send to admin room
    io.to('admin').emit('admin_lobby_update', {
        code: lobby.code,
        status: lobby.status,
        playerCount: game.players.size,
        phase: game.phase,
        hostState: getHostState(game),
    });
}

// ============ Duel Resolution ============

function resolveDuelAndNotify(io: Server, lobby: lobbyManager.LobbyInstance, duel: Duel): void {
    const game = lobby.state;
    resolveDuel(game, duel);

    const player1 = getPlayer(game, duel.player1Id);
    const player2 = getPlayer(game, duel.player2Id);

    // Clear duel IDs and mark as having dueled
    if (player1) {
        player1.currentDuelId = null;
        player1.isPaired = true;
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
    if (player1?.status === 'eliminated' && player1.socketId) {
        io.to(player1.socketId).emit('eliminated', { reason: player1.eliminationReason });
    }
    if (player2?.status === 'eliminated' && player2.socketId) {
        io.to(player2.socketId).emit('eliminated', { reason: player2.eliminationReason });
    }

    // Check for annihilation
    if (checkAnnihilation(io, lobby)) {
        return;
    }

    // Check if all duels complete
    checkRoundComplete(io, lobby);
}

function checkAnnihilation(io: Server, lobby: lobbyManager.LobbyInstance): boolean {
    const game = lobby.state;

    if (!game.settings.annihilationRule) return false;
    if (game.phase === 'ended' || game.phase === 'waiting') return false;

    const alivePlayers = getAlivePlayers(game);
    if (alivePlayers.length === 0) return false;

    const humans = alivePlayers.filter(p => p.role === 'human');
    const zombies = alivePlayers.filter(p => p.role === 'zombie');

    if (humans.length > 0) return false;

    console.log(`[ANNIHILATION] All players infected in lobby ${lobby.code}!`);

    game.events.push({
        id: `annihilation-${game.round}`,
        round: game.round,
        type: 'annihilation',
        message: 'THE INFECTION HAS CONSUMED ALL. EVERYONE PERISHED.',
    });

    startMeetingPhase(game);
    broadcastPhaseChange(io, lobby);
    broadcastLobbyUpdate(io, lobby);
    broadcastHostUpdate(io, lobby);

    setTimeout(() => {
        io.to(getLobbyRoom(lobby.code)).emit('host_annihilation', {
            message: 'SOMETHING IS WRONG...',
            zombieCount: zombies.length,
        });

        setTimeout(() => {
            endGame(game);
            lobby.status = 'ended';
            broadcastPhaseChange(io, lobby);
            broadcastHostUpdate(io, lobby);

            io.to(getLobbyRoom(lobby.code)).emit('host_annihilation', {
                message: 'ALL PLAYERS HAVE BEEN INFECTED. EVERYONE DIED.',
                zombieCount: zombies.length,
            });
        }, 3000);
    }, 3000);

    return true;
}

function checkRoundComplete(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;
    const alivePlayers = getAlivePlayers(game);

    if (alivePlayers.length === 0) {
        console.log(`[checkRoundComplete] All players dead in lobby ${lobby.code}!`);
        endGame(game);
        lobby.status = 'ended';
        broadcastPhaseChange(io, lobby);
        broadcastHostUpdate(io, lobby);
        return;
    }

    if (alivePlayers.length === 1) {
        console.log(`[checkRoundComplete] Only 1 player remaining in lobby ${lobby.code}!`);
        endGame(game);
        lobby.status = 'ended';
        broadcastPhaseChange(io, lobby);
        broadcastHostUpdate(io, lobby);
        return;
    }

    const playersInDuel = alivePlayers.filter(p => p.currentDuelId !== null);
    const unpairedPlayers = alivePlayers.filter(p => !p.isPaired && p.currentDuelId === null);
    const completedPlayers = alivePlayers.filter(p => p.isPaired && p.currentDuelId === null);

    const noActiveDuels = playersInDuel.length === 0;
    const allPairedOrOddOneOut = unpairedPlayers.length <= 1;
    const duelsHappened = completedPlayers.length > 0;

    if (noActiveDuels && allPairedOrOddOneOut && duelsHappened) {
        console.log(`[checkRoundComplete] Transitioning to meeting in lobby ${lobby.code}`);
        startMeetingPhase(game);
        broadcastPhaseChange(io, lobby);
        broadcastLobbyUpdate(io, lobby);
        broadcastHostUpdate(io, lobby);
        startPhaseTimer(io, lobby);
    }
}

function resolvePendingDuels(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;

    for (const duelId of game.currentRoundDuels) {
        const duel = game.duels.get(duelId);
        if (!duel || duel.status !== 'in_progress') continue;

        autoSubmitForDisconnected(game, duel);

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
            resolveDuelAndNotify(io, lobby, duel);
        }
    }
}

// ============ Phase Timer ============

function startPhaseTimer(io: Server, lobby: lobbyManager.LobbyInstance): void {
    const game = lobby.state;

    const existingTimer = phaseTimers.get(lobby.code);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const duration = game.phase === 'duel'
        ? CONFIG.DUEL_DURATION_SEC * 1000
        : CONFIG.MEETING_DURATION_SEC * 1000;

    const timer = setTimeout(() => {
        const currentLobby = lobbyManager.getLobby(lobby.code);
        if (!currentLobby) return;

        const currentGame = currentLobby.state;

        if (currentGame.phase === 'duel') {
            resolvePendingDuels(io, currentLobby);
            startMeetingPhase(currentGame);
            broadcastPhaseChange(io, currentLobby);
            broadcastHostUpdate(io, currentLobby);
            startPhaseTimer(io, currentLobby);
        } else if (currentGame.phase === 'meeting') {
            startNextRound(currentGame);
            broadcastPhaseChange(io, currentLobby);
            broadcastLobbyUpdate(io, currentLobby);
            broadcastHostUpdate(io, currentLobby);
        }

        phaseTimers.delete(lobby.code);
    }, duration);

    phaseTimers.set(lobby.code, timer);
}

// ============ Export for testing ============

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
