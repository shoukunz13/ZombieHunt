/**
 * Zombie Hunt - Bot Simulator
 * Simulates N bot players for stress testing.
 */

import { io, Socket } from 'socket.io-client';
import { CONFIG } from './config';

const SERVER_URL = `http://localhost:${CONFIG.PORT}`;
const GAME_CODE = 'STRESS_TEST';
const BOT_COUNT = parseInt(process.argv[2] || '20', 10);

interface BotState {
    id: string;
    name: string;
    socket: Socket;
    playerId?: string;
    role?: string;
    numberCards: any[];
    hasShotgun: boolean;
    hasVaccine: boolean;
    hasZombie: boolean;
    currentDuelId?: string;
    isAlive: boolean;
}

const bots: BotState[] = [];
let gameStarted = false;

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createBot(index: number): BotState {
    const socket = io(SERVER_URL, {
        transports: ['websocket'],
        autoConnect: false,
    });

    const bot: BotState = {
        id: `bot_${index}`,
        name: `Bot_${index}`,
        socket,
        numberCards: [],
        hasShotgun: true,
        hasVaccine: false,
        hasZombie: false,
        isAlive: true,
    };

    // Set up event handlers
    socket.on('connect', () => {
        console.log(`[${bot.name}] Connected`);
        socket.emit('join_game', { gameCode: GAME_CODE, name: bot.name });
    });

    socket.on('joined', (data) => {
        console.log(`[${bot.name}] Joined game as ${data.playerId}`);
        bot.playerId = data.playerId;
        updateBotState(bot, data.yourPrivateState);
    });

    socket.on('private_state_update', (data) => {
        updateBotState(bot, data.yourPrivateState);
        console.log(`[${bot.name}] Role: ${bot.role}, Cards: ${bot.numberCards.length}`);
    });

    socket.on('phase_change', (data) => {
        console.log(`[${bot.name}] Phase: ${data.phase}, Round: ${data.round}`);
    });

    socket.on('lobby_update', (data) => {
        if (!bot.isAlive) return;

        // Try to pair with an available player
        const available = data.playersPublic.filter((p: any) =>
            p.id !== bot.playerId &&
            p.isAlive &&
            !p.isPaired
        );

        if (available.length > 0 && !bot.currentDuelId) {
            const opponent = available[Math.floor(Math.random() * available.length)];
            console.log(`[${bot.name}] Selecting opponent: ${opponent.name}`);
            socket.emit('lobby_select_opponent', { opponentId: opponent.id });
        }
    });

    socket.on('duel_assigned', (data) => {
        console.log(`[${bot.name}] Duel assigned vs ${data.opponentPublic.name}`);
        bot.currentDuelId = data.duelId;

        // Submit a random valid action after a delay
        setTimeout(() => submitRandomAction(bot), 500 + Math.random() * 2000);
    });

    socket.on('duel_resolution', (data) => {
        console.log(`[${bot.name}] Duel result: ${data.resultPrivate.outcome}`);
        updateBotState(bot, data.updatedPrivateState);
        bot.currentDuelId = undefined;
    });

    socket.on('eliminated', (data) => {
        console.log(`[${bot.name}] ELIMINATED: ${data.reason}`);
        bot.isAlive = false;
    });

    socket.on('game_ended', (data) => {
        console.log(`[${bot.name}] Game ended! Winner: ${data.finalReveal.winnerSide}`);
        console.log(`[${bot.name}] Outcome: ${data.yourOutcome}`);
    });

    socket.on('error', (data) => {
        console.error(`[${bot.name}] Error: ${data.message}`);
    });

    return bot;
}

function updateBotState(bot: BotState, privateState: any): void {
    if (!privateState) return;

    bot.role = privateState.role;
    bot.numberCards = privateState.numberCards || [];
    bot.hasShotgun = privateState.hasShotgun;
    bot.hasVaccine = !!privateState.vaccineCard;
    bot.hasZombie = !!privateState.zombieCard;
}

function submitRandomAction(bot: BotState): void {
    if (!bot.currentDuelId || !bot.isAlive) return;

    // Decide action probabilistically
    const actions: Array<{ type: string; cardId?: string }> = [];

    // Always consider number cards first
    if (bot.numberCards.length > 0) {
        // Pick a random number card
        const card = bot.numberCards[Math.floor(Math.random() * bot.numberCards.length)];
        actions.push({ type: 'number', cardId: card.id });
    }

    // Consider special cards with lower probability
    if (bot.hasZombie && Math.random() < 0.3) {
        actions.push({ type: 'zombie' });
    }
    if (bot.hasVaccine && Math.random() < 0.2) {
        actions.push({ type: 'vaccine' });
    }
    if (bot.hasShotgun && Math.random() < 0.1) {
        actions.push({ type: 'shotgun' });
    }

    if (actions.length === 0) {
        console.error(`[${bot.name}] No valid actions available!`);
        return;
    }

    // Pick random action
    const action = actions[Math.floor(Math.random() * actions.length)];

    console.log(`[${bot.name}] Submitting action: ${action.type}`);
    bot.socket.emit('duel_submit_action', {
        duelId: bot.currentDuelId,
        actionType: action.type,
        cardId: action.cardId,
    });
}

async function startHostAndGame(): Promise<void> {
    // Create a host connection
    const hostSocket = io(SERVER_URL, { transports: ['websocket'] });

    hostSocket.on('connect', async () => {
        console.log('[HOST] Connected');
        hostSocket.emit('host_auth', { pin: CONFIG.HOST_PIN });
    });

    hostSocket.on('host_authed', async () => {
        console.log('[HOST] Authenticated');

        // Wait for all bots to join
        await sleep(2000);
        console.log('[HOST] Starting game...');
        hostSocket.emit('host_start_game');
        gameStarted = true;
    });

    hostSocket.on('host_state_update', (data) => {
        const state = data.fullState;
        if (state) {
            console.log(`[HOST] Phase: ${state.phase}, Round: ${state.round}, ` +
                `Alive: ${state.players.filter((p: any) => p.status === 'alive').length}, ` +
                `Humans: ${state.humanCount}, Zombies: ${state.zombieCount}`);
        }
    });
}

async function main(): Promise<void> {
    console.log(`\n🧟 ZOMBIE HUNT BOT SIMULATOR 🧟`);
    console.log(`================================`);
    console.log(`Creating ${BOT_COUNT} bots...`);
    console.log(`Game code: ${GAME_CODE}`);
    console.log(`Server: ${SERVER_URL}`);
    console.log(`================================\n`);

    // Create bots
    for (let i = 1; i <= BOT_COUNT; i++) {
        const bot = createBot(i);
        bots.push(bot);
    }

    // Connect bots with staggered timing
    for (const bot of bots) {
        bot.socket.connect();
        await sleep(100);
    }

    // Wait for connections
    await sleep(1000);

    // Start host and game
    await startHostAndGame();

    // Keep running
    console.log('\n[SIMULATOR] Running... Press Ctrl+C to stop.\n');
}

main().catch(console.error);
