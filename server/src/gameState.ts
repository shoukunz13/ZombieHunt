/**
 * Zombie Hunt - Game State Manager
 * Central game state with all player, duel, and phase management.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    GameState, Player, Duel, GamePhase, PublicEvent,
    PlayerPublic, PlayerPrivate, GameStatePublic, HostState,
    FinalReveal, Role, NumberCard, GameSettings, DEFAULT_SETTINGS
} from './types';
import { CONFIG } from './config';
import {
    dealNumberCards, createZombieCard, createVaccineCard,
    distributeVaccines, shuffleArray, generateNumberDeck
} from './cards';
import { persistState, loadPersistedState } from './persistence';

// Store for all games (we only support one game at a time for simplicity)
let currentGame: GameState | null = null;

/**
 * Create a new game
 */
export function createGame(gameCode: string): GameState {
    const game: GameState = {
        gameCode,
        phase: 'waiting',
        round: 0,
        settings: { ...DEFAULT_SETTINGS },
        players: new Map(),
        duels: new Map(),
        currentRoundDuels: [],
        events: [],
        createdAt: Date.now(),
    };

    currentGame = game;
    return game;
}

/**
 * Reset and create a new game (for host)
 */
export function resetGame(gameCode: string): GameState {
    // Clear any existing game
    currentGame = null;
    return createGame(gameCode);
}

/**
 * Completely clear the current game (for host force end)
 */
export function clearGame(): void {
    currentGame = null;
}

/**
 * Restart game to waiting phase (for Play Again, keeps players and settings)
 */
export function restartGameToWaiting(game: GameState): boolean {
    if (!game) return false;

    // Reset game state but keep players and settings
    game.phase = 'waiting';
    game.round = 0;
    game.duels = new Map();
    game.currentRoundDuels = [];
    game.events = [];

    // Reset all players to waiting state (clear roles, cards, statuses)
    for (const player of game.players.values()) {
        // Note: role will be reassigned when game starts, using 'human' as default
        (player as any).role = 'human'; // Will be reassigned on game start
        player.numberCards = [];
        player.zombieCard = null;
        player.vaccineCard = null;
        player.hasShotgun = false;
        player.status = 'alive';
        player.selectedOpponentId = null;
        player.currentDuelId = null;
        player.isPaired = false;
        player.sittingOutRound = undefined;
        player.infectionCount = 0;
        player.eliminationReason = undefined;
    }

    saveGame(game);
    console.log(`[RESTART] Game ${game.gameCode} restarted to waiting phase with ${game.players.size} players`);
    return true;
}

/**
 * Update game settings (host only, during waiting phase)
 */
export function updateSettings(game: GameState, settings: Partial<GameSettings>): boolean {
    if (game.phase !== 'waiting') return false;

    if (settings.maxRounds !== undefined) {
        game.settings.maxRounds = Math.min(20, Math.max(5, settings.maxRounds));
    }
    if (settings.zombieCount !== undefined) {
        game.settings.zombieCount = Math.min(8, Math.max(1, settings.zombieCount));
    }
    if (settings.startingCards !== undefined) {
        game.settings.startingCards = Math.min(25, Math.max(5, settings.startingCards));
    }
    if (settings.vaccineCount !== undefined) {
        game.settings.vaccineCount = Math.min(10, Math.max(0, settings.vaccineCount));
    }
    if (settings.shotgunRatio !== undefined) {
        game.settings.shotgunRatio = Math.min(100, Math.max(0, settings.shotgunRatio));
    }
    if (settings.maxInfections !== undefined) {
        game.settings.maxInfections = Math.min(20, Math.max(0, settings.maxInfections));
    }
    if (settings.annihilationRule !== undefined) {
        game.settings.annihilationRule = settings.annihilationRule;
    }
    if (settings.requireZombieWin !== undefined) {
        game.settings.requireZombieWin = settings.requireZombieWin;
    }

    saveGame(game);
    return true;
}

/**
 * Get current game or create one
 */
export function getOrCreateGame(gameCode: string): GameState {
    if (currentGame && currentGame.gameCode === gameCode) {
        return currentGame;
    }

    // Try to load from persistence
    const loaded = loadPersistedState(gameCode);
    if (loaded) {
        currentGame = loaded;
        return loaded;
    }

    return createGame(gameCode);
}

/**
 * Get current game
 */
export function getGame(): GameState | null {
    return currentGame;
}

/**
 * Add a player to the game
 */
export function addPlayer(game: GameState, name: string, socketId: string): Player | null {
    // Check if game already started
    if (game.phase !== 'waiting') {
        // Allow reconnection
        const existingPlayer = findPlayerByName(game, name);
        if (existingPlayer) {
            existingPlayer.socketId = socketId;
            existingPlayer.disconnectedAt = undefined;
            return existingPlayer;
        }
        return null; // Can't join after game started
    }

    // Check for duplicate name
    if (findPlayerByName(game, name)) {
        return null;
    }

    const player: Player = {
        id: uuidv4(),
        name,
        socketId,
        teamId: 0, // Assigned when game starts
        role: 'human', // Assigned when game starts
        status: 'alive',
        numberCards: [],
        zombieCard: null,
        vaccineCard: null,
        hasShotgun: true, // Everyone starts with one shotgun
        selectedOpponentId: null,
        isPaired: false,
        currentDuelId: null,
        infectionCount: 0, // Track how many times this player (if zombie) has infected
    };

    game.players.set(player.id, player);
    saveGame(game);
    return player;
}

/**
 * Find player by name
 */
export function findPlayerByName(game: GameState, name: string): Player | undefined {
    for (const player of game.players.values()) {
        if (player.name.toLowerCase() === name.toLowerCase()) {
            return player;
        }
    }
    return undefined;
}

/**
 * Find player by socket ID
 */
export function findPlayerBySocketId(game: GameState, socketId: string): Player | undefined {
    for (const player of game.players.values()) {
        if (player.socketId === socketId) {
            return player;
        }
    }
    return undefined;
}

/**
 * Get player by ID
 */
export function getPlayer(game: GameState, playerId: string): Player | undefined {
    return game.players.get(playerId);
}

/**
 * Start the game - assigns teams, roles, and cards
 */
export function startGame(game: GameState): boolean {
    if (game.phase !== 'waiting') return false;
    if (game.players.size < CONFIG.MIN_PLAYERS) return false;

    const playerArray = Array.from(game.players.values());
    const playerCount = playerArray.length;

    // Shuffle players for random team assignment
    const shuffledPlayers = shuffleArray(playerArray);

    // Calculate team count based on player count
    // Target: ~4-5 players per team
    const playersPerTeam = 4;
    const maxTeams = CONFIG.TEAM_COUNT;
    const teamCount = Math.min(maxTeams, Math.max(1, Math.ceil(playerCount / playersPerTeam)));

    const baseTeamSize = Math.floor(playerCount / teamCount);
    const extraPlayers = playerCount % teamCount;

    // Assign teams
    let playerIndex = 0;
    const teams: Player[][] = [];

    for (let t = 0; t < teamCount; t++) {
        const teamSize = baseTeamSize + (t < extraPlayers ? 1 : 0);
        const team: Player[] = [];

        for (let i = 0; i < teamSize && playerIndex < playerCount; i++) {
            shuffledPlayers[playerIndex].teamId = t;
            team.push(shuffledPlayers[playerIndex]);
            playerIndex++;
        }

        teams.push(team);
    }

    // Assign zombies based on total zombieCount setting (not per team)
    const totalZombies = Math.min(game.settings.zombieCount, playerCount - 1);
    const zombieCandidates = shuffleArray([...shuffledPlayers]);
    for (let z = 0; z < totalZombies; z++) {
        zombieCandidates[z].role = 'zombie';
        zombieCandidates[z].zombieCard = createZombieCard();
    }

    // Deal number cards using settings.startingCards
    const cardsPerPlayer = game.settings.startingCards;
    const totalCardsNeeded = playerCount * cardsPerPlayer;
    let deck: NumberCard[] = [];
    while (deck.length < totalCardsNeeded) {
        deck = deck.concat(generateNumberDeck());
    }
    deck = shuffleArray(deck);

    for (let i = 0; i < playerCount; i++) {
        shuffledPlayers[i].numberCards = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
    }

    // Distribute vaccines using settings.vaccineCount
    const vaccineCount = Math.min(game.settings.vaccineCount, playerCount);
    const vaccineRecipients = shuffleArray([...Array(playerCount).keys()]).slice(0, vaccineCount);
    for (const idx of vaccineRecipients) {
        shuffledPlayers[idx].vaccineCard = createVaccineCard();
    }

    // Distribute shotguns using settings.shotgunRatio
    const shotgunCount = Math.floor(playerCount * (game.settings.shotgunRatio / 100));
    const shotgunRecipients = shuffleArray([...Array(playerCount).keys()]).slice(0, shotgunCount);
    for (const idx of shotgunRecipients) {
        shuffledPlayers[idx].hasShotgun = true;
    }

    // Update game state - start with intro phase for video
    game.phase = 'intro';
    game.round = 1;
    game.startedAt = Date.now();

    saveGame(game);

    return true;
}

/**
 * Complete the intro video and transition to lobby
 * Called when host finishes showing the intro video
 */
export function completeIntro(game: GameState): boolean {
    if (game.phase !== 'intro') return false;

    game.phase = 'lobby';
    addEvent(game, 'round_start', `Round 1 begins`);
    saveGame(game);

    return true;
}

/**
 * Handle player disconnection
 */
export function handleDisconnect(game: GameState, socketId: string): Player | undefined {
    const player = findPlayerBySocketId(game, socketId);
    if (player) {
        player.socketId = null;
        player.disconnectedAt = Date.now();
        saveGame(game);
    }
    return player;
}

/**
 * Handle player reconnection
 */
export function handleReconnect(game: GameState, name: string, socketId: string): Player | null {
    const player = findPlayerByName(game, name);
    if (player && player.status === 'alive') {
        player.socketId = socketId;
        player.disconnectedAt = undefined;
        saveGame(game);
        return player;
    }
    return null;
}

/**
 * Select opponent in lobby - creates duel immediately if mutual selection
 * Returns the duel if created, null otherwise
 */
export function selectOpponent(game: GameState, playerId: string, opponentId: string): { success: boolean; duel?: Duel } {
    if (game.phase !== 'lobby') return { success: false };

    const player = getPlayer(game, playerId);
    const opponent = getPlayer(game, opponentId);

    if (!player || !opponent) return { success: false };
    if (player.status !== 'alive' || opponent.status !== 'alive') return { success: false };
    if (player.isPaired || opponent.isPaired) return { success: false };
    if (player.currentDuelId || opponent.currentDuelId) return { success: false }; // Already in duel
    if (playerId === opponentId) return { success: false };

    // Check if either player is sitting out this round
    if (player.sittingOutRound === game.round || opponent.sittingOutRound === game.round) {
        return { success: false };
    }

    // Check if opponent has already selected this player (mutual selection)
    if (opponent.selectedOpponentId === playerId) {
        // Mutual selection! Create duel immediately
        player.selectedOpponentId = opponentId;
        player.isPaired = true;
        opponent.isPaired = true;

        // Create duel
        const duel: Duel = {
            id: uuidv4(),
            round: game.round,
            player1Id: opponent.id, // Opponent was first to select
            player2Id: player.id,   // Player accepted
            status: 'in_progress',
        };

        game.duels.set(duel.id, duel);
        game.currentRoundDuels.push(duel.id);

        player.currentDuelId = duel.id;
        opponent.currentDuelId = duel.id;

        saveGame(game);
        return { success: true, duel };
    }

    // One-sided selection (invite sent, waiting for acceptance)
    player.selectedOpponentId = opponentId;
    saveGame(game);
    return { success: true };
}

/**
 * Cancel outgoing invite/selection
 */
export function cancelSelection(game: GameState, playerId: string): boolean {
    if (game.phase !== 'lobby') return false;

    const player = getPlayer(game, playerId);
    if (!player) return false;

    // If player has no outgoing selection, nothing to cancel
    if (!player.selectedOpponentId) return false;

    const opponent = getPlayer(game, player.selectedOpponentId);

    // Clear player's selection
    player.selectedOpponentId = null;
    player.isPaired = false;

    // If opponent also had selected this player (mutual), clear them too
    if (opponent && opponent.selectedOpponentId === playerId) {
        opponent.selectedOpponentId = null;
        opponent.isPaired = false;
    }

    saveGame(game);
    return true;
}

/**
 * Decline incoming invite from another player
 */
export function declineInvite(game: GameState, playerId: string, inviterId: string): boolean {
    if (game.phase !== 'lobby') return false;

    const player = getPlayer(game, playerId);
    const inviter = getPlayer(game, inviterId);

    if (!player || !inviter) return false;

    // Verify inviter actually invited this player
    if (inviter.selectedOpponentId !== playerId) return false;

    // Clear inviter's selection
    inviter.selectedOpponentId = null;
    inviter.isPaired = false;

    saveGame(game);
    return true;
}

/**
 * Check if all alive players are paired
 */
export function allPlayersPaired(game: GameState): boolean {
    const alivePlayers = getAlivePlayers(game);

    // If odd number, one player can't be paired
    if (alivePlayers.length % 2 !== 0) {
        // All but one should be paired
        const unpaired = alivePlayers.filter(p => !p.isPaired);
        return unpaired.length <= 1;
    }

    return alivePlayers.every(p => p.isPaired);
}

/**
 * Get all alive players
 */
export function getAlivePlayers(game: GameState): Player[] {
    return Array.from(game.players.values()).filter(p => p.status === 'alive');
}

/**
 * Transition to duel phase
 */
export function startDuelPhase(game: GameState): void {
    if (game.phase !== 'lobby') return;

    game.phase = 'duel';
    game.phaseEndsAt = Date.now() + CONFIG.DUEL_DURATION_SEC * 1000;
    game.currentRoundDuels = [];

    // Create duels for all paired players
    const processed = new Set<string>();

    for (const player of game.players.values()) {
        if (player.status !== 'alive' || processed.has(player.id)) continue;
        if (!player.isPaired || !player.selectedOpponentId) continue;

        const opponent = getPlayer(game, player.selectedOpponentId);
        if (!opponent) continue;

        const duel: Duel = {
            id: uuidv4(),
            round: game.round,
            player1Id: player.id,
            player2Id: opponent.id,
            status: 'in_progress',
        };

        game.duels.set(duel.id, duel);
        game.currentRoundDuels.push(duel.id);

        player.currentDuelId = duel.id;
        opponent.currentDuelId = duel.id;

        processed.add(player.id);
        processed.add(opponent.id);
    }

    saveGame(game);
}

/**
 * Transition to meeting phase
 */
export function startMeetingPhase(game: GameState): void {
    // Allow transition from both 'duel' (legacy) and 'lobby' (new individual duel flow)
    if (game.phase !== 'duel' && game.phase !== 'lobby') return;

    game.phase = 'meeting';
    game.phaseEndsAt = Date.now() + CONFIG.MEETING_DURATION_SEC * 1000;

    // Reset pairing for next round
    for (const player of game.players.values()) {
        player.selectedOpponentId = null;
        player.isPaired = false;
        player.currentDuelId = null;
    }

    addEvent(game, 'round_end', `Round ${game.round} ended`);
    saveGame(game);
}

/**
 * Transition to next round lobby
 */
export function startNextRound(game: GameState): void {
    if (game.phase !== 'meeting') return;

    if (game.round >= game.settings.maxRounds) {
        endGame(game);
        return;
    }

    game.round++;
    game.phase = 'lobby';
    game.phaseEndsAt = undefined;

    addEvent(game, 'round_start', `Round ${game.round} begins`);
    saveGame(game);
}

/**
 * End the game
 */
export function endGame(game: GameState): void {
    game.phase = 'ended';
    game.endedAt = Date.now();
    saveGame(game);
}

/**
 * Eliminate a player
 */
export function eliminatePlayer(game: GameState, playerId: string, reason: string): void {
    const player = getPlayer(game, playerId);
    if (!player) return;

    player.status = 'eliminated';
    player.eliminationReason = reason;

    saveGame(game);
}

/**
 * Infect a player (turn human into zombie)
 */
export function infectPlayer(game: GameState, playerId: string): void {
    const player = getPlayer(game, playerId);
    if (!player || player.role === 'zombie') return;

    player.role = 'zombie';
    player.zombieCard = createZombieCard();

    saveGame(game);
}

/**
 * Cure a player (turn zombie into human)
 */
export function curePlayer(game: GameState, playerId: string): void {
    const player = getPlayer(game, playerId);
    if (!player || player.role === 'human') return;

    player.role = 'human';
    player.zombieCard = null;

    saveGame(game);
}

/**
 * Add a public event
 */
export function addEvent(game: GameState, type: PublicEvent['type'], message: string): void {
    game.events.push({
        id: uuidv4(),
        round: game.round,
        type,
        message,
    });
}

/**
 * Get public player view
 * @param player The player to get public view for
 * @param game Optional game state for computing incoming invite info
 */
export function getPlayerPublic(player: Player, game?: GameState): PlayerPublic {
    // Find who has invited this player (if any)
    let incomingInviteFromId: string | null = null;
    if (game && !player.isPaired && !player.currentDuelId) {
        for (const otherPlayer of game.players.values()) {
            if (otherPlayer.selectedOpponentId === player.id && !otherPlayer.isPaired) {
                incomingInviteFromId = otherPlayer.id;
                break;
            }
        }
    }

    return {
        id: player.id,
        name: player.name,
        isAlive: player.status === 'alive',
        isPaired: player.isPaired,
        isConnected: player.socketId !== null,
        hasOutgoingInvite: player.selectedOpponentId !== null && !player.isPaired,
        incomingInviteFromId,
        isInDuel: player.currentDuelId !== null,
    };
}

/**
 * Get private player state (for the player themselves)
 */
export function getPlayerPrivate(player: Player): PlayerPrivate {
    return {
        id: player.id,
        name: player.name,
        role: player.role,
        status: player.status,
        teamId: player.teamId,
        numberCards: player.numberCards,
        zombieCard: player.zombieCard,
        vaccineCard: player.vaccineCard,
        hasShotgun: player.hasShotgun,
        currentDuelId: player.currentDuelId,
        eliminationReason: player.eliminationReason,
    };
}

/**
 * Get public game state
 */
export function getGameStatePublic(game: GameState): GameStatePublic {
    const alivePlayers = getAlivePlayers(game);

    return {
        gameCode: game.gameCode,
        phase: game.phase,
        round: game.round,
        maxRounds: game.settings.maxRounds,
        phaseEndsAt: game.phaseEndsAt,
        playerCount: game.players.size,
        alivePlayerCount: alivePlayers.length,
    };
}

/**
 * Get host state with all hidden info
 */
export function getHostState(game: GameState): HostState {
    const players = Array.from(game.players.values());
    const humans = players.filter(p => p.role === 'human' && p.status === 'alive');
    const zombies = players.filter(p => p.role === 'zombie' && p.status === 'alive');

    // Team breakdown
    const teamBreakdown: HostState['teamBreakdown'] = [];
    for (let t = 0; t < CONFIG.TEAM_COUNT; t++) {
        const teamPlayers = players.filter(p => p.teamId === t);
        teamBreakdown.push({
            teamId: t,
            humans: teamPlayers.filter(p => p.role === 'human' && p.status === 'alive').length,
            zombies: teamPlayers.filter(p => p.role === 'zombie' && p.status === 'alive').length,
            alive: teamPlayers.filter(p => p.status === 'alive').length,
        });
    }

    return {
        gameCode: game.gameCode,
        phase: game.phase,
        round: game.round,
        phaseEndsAt: game.phaseEndsAt,
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            teamId: p.teamId,
            status: p.status,
            isConnected: p.socketId !== null,
            numberCardCount: p.numberCards.length,
            hasZombieCard: p.zombieCard !== null,
            hasVaccine: p.vaccineCard !== null,
            hasShotgun: p.hasShotgun,
        })),
        duels: game.currentRoundDuels.map(duelId => {
            const duel = game.duels.get(duelId)!;
            const p1 = getPlayer(game, duel.player1Id);
            const p2 = getPlayer(game, duel.player2Id);
            return {
                id: duel.id,
                player1Name: p1?.name || 'Unknown',
                player2Name: p2?.name || 'Unknown',
                status: duel.status,
            };
        }),
        humanCount: humans.length,
        zombieCount: zombies.length,
        teamBreakdown,
        settings: game.settings,
        events: game.events,
    };
}

/**
 * Get final reveal data
 */
export function getFinalReveal(game: GameState): FinalReveal {
    const players = Array.from(game.players.values()).filter(p => p.status === 'alive');
    const humans = players.filter(p => p.role === 'human');
    const zombies = players.filter(p => p.role === 'zombie');

    // SPECIAL RULE: If annihilationRule is enabled and everyone is a zombie, they all die
    // This prevents strategic mass-conversion
    if (game.settings.annihilationRule && humans.length === 0 && zombies.length > 0) {
        return {
            humans: [],
            zombies: [],
            winnerSide: 'tie',
            humanCount: 0,
            zombieCount: 0,
        };
    }

    let winnerSide: 'humans' | 'zombies' | 'tie';
    if (humans.length > zombies.length) {
        winnerSide = 'humans';
    } else if (zombies.length > humans.length) {
        winnerSide = 'zombies';
    } else {
        winnerSide = 'tie';
    }

    return {
        humans: humans.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
        zombies: zombies.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
        winnerSide,
        humanCount: humans.length,
        zombieCount: zombies.length,
    };
}

/**
 * Save game to persistence
 */
function saveGame(game: GameState): void {
    if (CONFIG.ENABLE_PERSISTENCE) {
        persistState(game);
    }
}

/**
 * Get events for current round
 */
export function getCurrentRoundEvents(game: GameState): PublicEvent[] {
    return game.events.filter(e => e.round === game.round);
}
