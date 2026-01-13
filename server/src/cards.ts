/**
 * Zombie Hunt - Card Utilities
 * Card generation, deck shuffling, and distribution logic.
 */

import { v4 as uuidv4 } from 'uuid';
import { NumberCard, ZombieCard, VaccineCard, ShotgunCard, Suit, Card } from './types';
import { CONFIG } from './config';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/**
 * Generate a complete deck of number cards
 */
export function generateNumberDeck(): NumberCard[] {
    const deck: NumberCard[] = [];

    for (const suit of SUITS) {
        for (let value = CONFIG.NUMBER_CARD_MIN_VALUE; value <= CONFIG.NUMBER_CARD_MAX_VALUE; value++) {
            deck.push({
                id: uuidv4(),
                type: 'number',
                suit,
                value,
            });
        }
    }

    return deck;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Deal cards to players
 * Returns arrays of number cards for each player
 */
export function dealNumberCards(playerCount: number): NumberCard[][] {
    const cardsPerPlayer = CONFIG.STARTING_NUMBER_CARDS;
    const totalCardsNeeded = playerCount * cardsPerPlayer;

    // Generate enough decks to cover all players
    let deck: NumberCard[] = [];
    while (deck.length < totalCardsNeeded) {
        deck = deck.concat(generateNumberDeck());
    }

    // Shuffle the combined deck
    deck = shuffleArray(deck);

    // Deal to players
    const hands: NumberCard[][] = [];
    for (let i = 0; i < playerCount; i++) {
        hands.push(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
    }

    return hands;
}

/**
 * Create a new zombie card
 */
export function createZombieCard(): ZombieCard {
    return {
        id: uuidv4(),
        type: 'zombie',
    };
}

/**
 * Create a new vaccine card
 */
export function createVaccineCard(): VaccineCard {
    return {
        id: uuidv4(),
        type: 'vaccine',
    };
}

/**
 * Create a new shotgun card
 */
export function createShotgunCard(): ShotgunCard {
    return {
        id: uuidv4(),
        type: 'shotgun',
    };
}

/**
 * Distribute vaccines randomly among player indices
 * Returns array of player indices who get vaccines
 */
export function distributeVaccines(playerCount: number): number[] {
    const vaccineCount = Math.floor(playerCount * CONFIG.VACCINE_RATIO);
    const indices = Array.from({ length: playerCount }, (_, i) => i);
    const shuffled = shuffleArray(indices);
    return shuffled.slice(0, vaccineCount);
}

/**
 * Get a random card from a player's hand for stealing
 */
export function getRandomStealableCard(
    numberCards: NumberCard[],
    mode: typeof CONFIG.STEAL_MODE
): NumberCard | null {
    if (numberCards.length === 0) return null;

    // For random_number_only and random_any, we steal from number cards
    // (random_any would include special cards but we don't steal those)
    const index = Math.floor(Math.random() * numberCards.length);
    return numberCards[index];
}

/**
 * Get card display name for logging
 */
export function getCardDisplayName(card: Card): string {
    if (card.type === 'number') {
        return `${card.value} of ${card.suit}`;
    }
    return card.type.charAt(0).toUpperCase() + card.type.slice(1);
}
