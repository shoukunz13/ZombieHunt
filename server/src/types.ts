/**
 * Zombie Hunt - Game Type Definitions
 * All types for game state, cards, players, and duels.
 */

// ============ Card Types ============

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface NumberCard {
    id: string;
    type: 'number';
    suit: Suit;
    value: number;
}

export interface ZombieCard {
    id: string;
    type: 'zombie';
}

export interface VaccineCard {
    id: string;
    type: 'vaccine';
}

export interface ShotgunCard {
    id: string;
    type: 'shotgun';
}

export type Card = NumberCard | ZombieCard | VaccineCard | ShotgunCard;
export type SpecialCard = ZombieCard | VaccineCard | ShotgunCard;

// ============ Player Types ============

export type Role = 'human' | 'zombie';
export type PlayerStatus = 'alive' | 'eliminated';

export interface Player {
    id: string;
    name: string;
    socketId: string | null;
    teamId: number;
    role: Role;
    status: PlayerStatus;

    // Cards
    numberCards: NumberCard[];
    zombieCard: ZombieCard | null;
    vaccineCard: VaccineCard | null;
    hasShotgun: boolean;

    // Lobby state
    selectedOpponentId: string | null;
    isPaired: boolean;
    currentDuelId: string | null;

    // Tracking
    eliminationReason?: string;
    disconnectedAt?: number;
    sittingOutRound?: number; // Round number when player must sit out (after successfully shooting zombie)
    infectionCount: number;   // How many times this zombie has infected others
}

// ============ Duel Types ============

export type ActionType = 'number' | 'zombie' | 'vaccine' | 'shotgun' | 'zombie_with_numbers';

export type EventType = 'infection' | 'cure' | 'shotgun_fired' | 'elimination' | 'round_start' | 'round_end' | 'annihilation' | 'betrayal';

export interface DuelAction {
    playerId: string;
    actionType: ActionType;
    cardId?: string; // For single card (deprecated, kept for compatibility)
    cardIds?: string[]; // For multiple number cards (same suit)
    timestamp: number;
}

export interface DuelResult {
    winnerId: string | null; // null = draw
    loserId: string | null;
    stolenCardId?: string;
    lootableCards?: NumberCard[]; // Cards played by loser that winner can pick from
    cardLost?: Card; // Card lost due to penalty (e.g. zombie attacking zombie)
    infections: string[]; // playerIds who got infected
    cures: string[]; // playerIds who got cured
    shotgunKills: string[]; // playerIds killed by shotgun
    eliminations: string[]; // playerIds eliminated (out of cards or shotgunned)
    p1PlayedCards?: NumberCard[]; // Cards player1 played (for reveal animation)
    p2PlayedCards?: NumberCard[]; // Cards player2 played (for reveal animation)
    zombieCardRevealed?: boolean; // True if zombie won and revealed their card to infect
}

export type DuelStatus = 'pending' | 'in_progress' | 'resolved';

export interface Duel {
    id: string;
    round: number;
    player1Id: string;
    player2Id: string;
    status: DuelStatus;
    requiredSuit?: Suit; // Set by first number card played
    action1?: DuelAction;
    action2?: DuelAction;
    result?: DuelResult;
}

// ============ Game Phase Types ============

export type GamePhase = 'waiting' | 'intro' | 'lobby' | 'duel' | 'meeting' | 'ended';

export interface PublicEvent {
    id: string;
    round: number;
    type: EventType;
    message: string; // Anonymized message
}

// ============ Game Settings ============

export interface GameSettings {
    maxRounds: number;           // 5-20, default 20
    zombieCount: number;         // 1-8, total starting zombies
    startingCards: number;       // 5-25, number cards per player
    vaccineCount: number;        // 0-10, total vaccines distributed
    shotgunRatio: number;        // 0-100, % of players with shotguns
    maxInfections: number;       // 0-20, max infections per zombie (0 = unlimited)
    annihilationRule: boolean;   // If all become zombies, everyone dies
    requireZombieWin: boolean;   // Zombie must win card battle to infect
}

export const DEFAULT_SETTINGS: GameSettings = {
    maxRounds: 20,
    zombieCount: 2,
    startingCards: 10,
    vaccineCount: 4,
    shotgunRatio: 50,
    maxInfections: 0,
    annihilationRule: true,
    requireZombieWin: false,
};

/**
 * Get recommended settings based on player count
 */
export function getRecommendedSettings(playerCount: number): Partial<GameSettings> {
    if (playerCount <= 8) {
        return { zombieCount: 1, startingCards: 10, vaccineCount: 2, shotgunRatio: 50, maxInfections: 0 };
    } else if (playerCount <= 12) {
        return { zombieCount: 2, startingCards: 12, vaccineCount: 3, shotgunRatio: 40, maxInfections: 5 };
    } else if (playerCount <= 16) {
        return { zombieCount: 2, startingCards: 15, vaccineCount: 4, shotgunRatio: 40, maxInfections: 6 };
    } else {
        return { zombieCount: 2, startingCards: 20, vaccineCount: 5, shotgunRatio: 40, maxInfections: 8 };
    }
}

// ============ Game State ============

export interface GameState {
    gameCode: string;
    phase: GamePhase;
    round: number;
    phaseEndsAt?: number; // Unix timestamp

    settings: GameSettings;

    players: Map<string, Player>;
    duels: Map<string, Duel>;
    currentRoundDuels: string[]; // Duel IDs for current round

    events: PublicEvent[];

    // Tracking
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
}

// ============ Public/Private State Views ============

export interface PlayerPublic {
    id: string;
    name: string;
    isAlive: boolean;
    isPaired: boolean;
    isConnected: boolean;
    // Invite state for new flow
    hasOutgoingInvite: boolean;          // Has sent invite, waiting for response
    incomingInviteFromId: string | null; // ID of player who invited you
    isInDuel: boolean;                   // Currently in a duel
}

export interface PlayerPrivate {
    id: string;
    name: string;
    role: Role;
    status: PlayerStatus;
    teamId: number;
    numberCards: NumberCard[];
    zombieCard: ZombieCard | null;
    vaccineCard: VaccineCard | null;
    hasShotgun: boolean;
    currentDuelId: string | null;
    eliminationReason?: string;
}

export interface DuelPublic {
    id: string;
    player1Name: string;
    player2Name: string;
    status: DuelStatus;
}

export interface DuelResultPrivate {
    outcome: 'win' | 'lose' | 'draw';
    cardStolen?: Card;
    cardLost?: Card;
    infected: boolean;
    cured: boolean;
    shotgunUsed: boolean;
    shotgunResult?: 'killed_zombie' | 'wasted_on_human';
    opponentEliminated: boolean;
    youEliminated: boolean;
    lootableCards?: NumberCard[]; // If you won, these are cards you can pick from
    yourCards?: NumberCard[]; // Cards you played (for reveal animation)
    opponentCards?: NumberCard[]; // Cards opponent played (for reveal animation)
    zombieCardRevealed?: boolean; // If true, show zombie card reveal animation (opponent infected you)
}

export interface GameStatePublic {
    gameCode: string;
    phase: GamePhase;
    round: number;
    maxRounds: number;
    phaseEndsAt?: number;
    playerCount: number;
    alivePlayerCount: number;
}

// ============ Host-Only State ============

export interface HostState {
    gameCode: string;
    phase: GamePhase;
    round: number;
    phaseEndsAt?: number;

    players: Array<{
        id: string;
        name: string;
        role: Role;
        teamId: number;
        status: PlayerStatus;
        isConnected: boolean;
        numberCardCount: number;
        hasZombieCard: boolean;
        hasVaccine: boolean;
        hasShotgun: boolean;
    }>;

    duels: DuelPublic[];

    // Hidden totals (visible only to host)
    humanCount: number;
    zombieCount: number;
    teamBreakdown: Array<{
        teamId: number;
        humans: number;
        zombies: number;
        alive: number;
    }>;

    settings: GameSettings;

    events: PublicEvent[];
}

// ============ Final Reveal ============

export interface FinalReveal {
    humans: Array<{ id: string; name: string; teamId: number }>;
    zombies: Array<{ id: string; name: string; teamId: number }>;
    winnerSide: 'humans' | 'zombies' | 'tie';
    humanCount: number;
    zombieCount: number;
}
