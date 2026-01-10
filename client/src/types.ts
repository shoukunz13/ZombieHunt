/**
 * Zombie Hunt - Client Types
 * Type definitions matching server types for client use.
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Role = 'human' | 'zombie';
export type GamePhase = 'waiting' | 'lobby' | 'duel' | 'meeting' | 'ended';
export type ActionType = 'number' | 'zombie' | 'vaccine' | 'shotgun';

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

export interface PlayerPublic {
    id: string;
    name: string;
    isAlive: boolean;
    isPaired: boolean;
    isConnected: boolean;
    numberCardCount: number;
    // Invite state for new flow
    hasOutgoingInvite: boolean;          // Has sent invite, waiting for response
    incomingInviteFromId: string | null; // ID of player who invited you
    isInDuel: boolean;                   // Currently in a duel
}

export interface PlayerPrivate {
    id: string;
    name: string;
    role: Role;
    status: 'alive' | 'eliminated';
    teamId: number;
    numberCards: NumberCard[];
    zombieCard: ZombieCard | null;
    vaccineCard: VaccineCard | null;
    hasShotgun: boolean;
    currentDuelId: string | null;
    eliminationReason?: string;
}

export interface GameStatePublic {
    gameCode: string;
    phase: GamePhase;
    round: number;
    phaseEndsAt?: number;
    playerCount: number;
    alivePlayerCount: number;
}

export interface PublicEvent {
    id: string;
    round: number;
    type: 'infection' | 'cure' | 'shotgun_fired' | 'elimination' | 'round_start' | 'round_end';
    message: string;
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
}

export interface FinalReveal {
    humans: Array<{ id: string; name: string; teamId: number }>;
    zombies: Array<{ id: string; name: string; teamId: number }>;
    winnerSide: 'humans' | 'zombies' | 'tie';
    humanCount: number;
    zombieCount: number;
}

// Socket event payloads
export interface JoinedPayload {
    playerId: string;
    gameStatePublic: GameStatePublic;
    yourPrivateState: PlayerPrivate;
}

export interface LobbyUpdatePayload {
    playersPublic: PlayerPublic[];
    pairingStatus: {
        totalPlayers: number;
        pairedCount: number;
        allPaired: boolean;
    };
}

export interface DuelAssignedPayload {
    duelId: string;
    opponentPublic: PlayerPublic;
    round: number;
}

export interface PhaseChangePayload {
    phase: GamePhase;
    round: number;
    endsAt?: number;
}

export interface DuelResolutionPayload {
    duelId: string;
    resultPrivate: DuelResultPrivate;
    updatedPrivateState: PlayerPrivate;
}

export interface MeetingSummaryPayload {
    round: number;
    publicEvents: PublicEvent[];
}

export interface GameEndedPayload {
    finalReveal: FinalReveal;
    yourOutcome: 'won' | 'lost' | 'tie';
}

// Host types
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
        status: 'alive' | 'eliminated';
        isConnected: boolean;
        numberCardCount: number;
        hasZombieCard: boolean;
        hasVaccine: boolean;
        hasShotgun: boolean;
    }>;
    duels: Array<{
        id: string;
        player1Name: string;
        player2Name: string;
        status: 'pending' | 'in_progress' | 'resolved';
    }>;
    humanCount: number;
    zombieCount: number;
    teamBreakdown: Array<{
        teamId: number;
        humans: number;
        zombies: number;
        alive: number;
    }>;
    events: PublicEvent[];
}
