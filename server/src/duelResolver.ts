/**
 * Zombie Hunt - Duel Resolution Logic
 * Handles all duel mechanics including special cards and stealing.
 */

import {
    Duel, DuelAction, DuelResult, Player, GameState,
    NumberCard, DuelResultPrivate, ActionType
} from './types';
import { CONFIG } from './config';
import {
    getPlayer, eliminatePlayer, infectPlayer, curePlayer, addEvent
} from './gameState';
import { getRandomStealableCard, createZombieCard } from './cards';

/**
 * Submit a duel action
 * Returns true if valid, false if invalid
 * For number cards, can submit up to 5 cards of the same suit
 */
export function submitDuelAction(
    game: GameState,
    duel: Duel,
    playerId: string,
    actionType: ActionType,
    cardId?: string,
    cardIds?: string[]
): { success: boolean; error?: string } {
    const player = getPlayer(game, playerId);
    if (!player) return { success: false, error: 'Player not found' };

    // Determine which action slot to use
    const isPlayer1 = duel.player1Id === playerId;
    const existingAction = isPlayer1 ? duel.action1 : duel.action2;

    if (existingAction) {
        return { success: false, error: 'Already submitted action' };
    }

    // Normalize cardIds - use cardIds array or single cardId
    const normalizedCardIds = cardIds && cardIds.length > 0 ? cardIds : (cardId ? [cardId] : undefined);

    // Validate action
    const validation = validateAction(game, duel, player, actionType, normalizedCardIds);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    // Create action
    const action: DuelAction = {
        playerId,
        actionType,
        cardId: normalizedCardIds?.[0], // Keep first card for compatibility
        cardIds: normalizedCardIds,
        timestamp: Date.now(),
    };

    // Set action
    if (isPlayer1) {
        duel.action1 = action;
    } else {
        duel.action2 = action;
    }

    // Set required suit if this is first number card
    if (actionType === 'number' && normalizedCardIds && normalizedCardIds.length > 0 && !duel.requiredSuit) {
        const card = player.numberCards.find(c => c.id === normalizedCardIds[0]);
        if (card) {
            duel.requiredSuit = card.suit;
        }
    }

    return { success: true };
}

/**
 * Validate a duel action
 * For number cards, validates up to 5 cards of the same suit
 */
function validateAction(
    game: GameState,
    duel: Duel,
    player: Player,
    actionType: ActionType,
    cardIds?: string[]
): { valid: boolean; error?: string } {
    switch (actionType) {
        case 'number':
            if (!cardIds || cardIds.length === 0) return { valid: false, error: 'Card ID required' };
            if (cardIds.length > 5) return { valid: false, error: 'Maximum 5 cards allowed' };

            // Validate all cards exist and are same suit
            const cards: NumberCard[] = [];
            let cardSuit: string | null = null;

            for (const cid of cardIds) {
                const card = player.numberCards.find(c => c.id === cid);
                if (!card) return { valid: false, error: 'Card not in hand' };

                if (cardSuit === null) {
                    cardSuit = card.suit;
                } else if (card.suit !== cardSuit) {
                    return { valid: false, error: 'All cards must be the same suit' };
                }

                cards.push(card);
            }

            // NOTE: Each player can play any suit they want - only constraint is
            // all cards in their own hand must be same suit (already validated above)
            // No need to match opponent's suit
            return { valid: true };

        case 'zombie':
            if (!player.zombieCard) return { valid: false, error: 'No zombie card' };
            return { valid: true };

        case 'vaccine':
            if (!player.vaccineCard) return { valid: false, error: 'No vaccine card' };
            return { valid: true };

        case 'shotgun':
            if (!player.hasShotgun) return { valid: false, error: 'No shotgun' };
            return { valid: true };

        case 'zombie_with_numbers':
            // Competitive mode: zombie must play zombie card + number cards together
            if (!player.zombieCard) return { valid: false, error: 'No zombie card' };
            if (!cardIds || cardIds.length === 0) return { valid: false, error: 'Must play number cards with zombie card' };
            if (cardIds.length > 5) return { valid: false, error: 'Maximum 5 cards allowed' };

            // Validate all number cards exist and are same suit
            const zombieCards: NumberCard[] = [];
            let zombieCardSuit: string | null = null;

            for (const cid of cardIds) {
                const card = player.numberCards.find(c => c.id === cid);
                if (!card) return { valid: false, error: 'Card not in hand' };

                if (zombieCardSuit === null) {
                    zombieCardSuit = card.suit;
                } else if (card.suit !== zombieCardSuit) {
                    return { valid: false, error: 'All cards must be the same suit' };
                }

                zombieCards.push(card);
            }
            return { valid: true };

        default:
            return { valid: false, error: 'Invalid action type' };
    }
}

/**
 * Check if duel is ready to resolve
 */
export function isDuelReady(duel: Duel): boolean {
    return duel.action1 !== undefined && duel.action2 !== undefined;
}

/**
 * Auto-submit for disconnected players
 */
export function autoSubmitForDisconnected(game: GameState, duel: Duel): void {
    if (!CONFIG.DISCONNECT_AUTOPLAY) return;

    const player1 = getPlayer(game, duel.player1Id);
    const player2 = getPlayer(game, duel.player2Id);

    // Auto-submit for player 1 if disconnected and no action
    if (player1 && !duel.action1 && !player1.socketId) {
        const lowestCard = getLowestValidCard(player1, duel.requiredSuit);
        if (lowestCard) {
            duel.action1 = {
                playerId: player1.id,
                actionType: 'number',
                cardId: lowestCard.id,
                timestamp: Date.now(),
            };
            if (!duel.requiredSuit) {
                duel.requiredSuit = lowestCard.suit;
            }
        }
    }

    // Auto-submit for player 2 if disconnected and no action
    if (player2 && !duel.action2 && !player2.socketId) {
        const lowestCard = getLowestValidCard(player2, duel.requiredSuit);
        if (lowestCard) {
            duel.action2 = {
                playerId: player2.id,
                actionType: 'number',
                cardId: lowestCard.id,
                timestamp: Date.now(),
            };
            if (!duel.requiredSuit) {
                duel.requiredSuit = lowestCard.suit;
            }
        }
    }
}

/**
 * Get lowest valid card for auto-play
 */
function getLowestValidCard(player: Player, requiredSuit?: string): NumberCard | null {
    let candidates = player.numberCards;

    if (requiredSuit) {
        const suitCards = candidates.filter(c => c.suit === requiredSuit);
        if (suitCards.length > 0) {
            candidates = suitCards;
        }
        // If no matching suit, use any card (allow_any fallback assumed)
    }

    if (candidates.length === 0) return null;

    // Sort by value ascending and return lowest
    candidates.sort((a, b) => a.value - b.value);
    return candidates[0];
}

/**
 * Resolve a duel
 * This is the main duel resolution logic
 */
export function resolveDuel(game: GameState, duel: Duel): DuelResult {
    const player1 = getPlayer(game, duel.player1Id)!;
    const player2 = getPlayer(game, duel.player2Id)!;

    const action1 = duel.action1!;
    const action2 = duel.action2!;

    const result: DuelResult = {
        winnerId: null,
        loserId: null,
        infections: [],
        cures: [],
        shotgunKills: [],
        eliminations: [],
    };

    // Capture played cards BEFORE any removals (for reveal animation)
    const getPlayedCards = (action: DuelAction, player: Player): NumberCard[] => {
        // Include number cards from both 'number' and 'zombie_with_numbers' actions
        if (action.actionType !== 'number' && action.actionType !== 'zombie_with_numbers') return [];
        const cardIds = action.cardIds || (action.cardId ? [action.cardId] : []);
        return cardIds
            .map(id => player.numberCards.find(c => c.id === id))
            .filter((c): c is NumberCard => c !== undefined);
    };
    result.p1PlayedCards = getPlayedCards(action1, player1);
    result.p2PlayedCards = getPlayedCards(action2, player2);

    // Track vaccine cards played (always visible)
    // Zombie cards will only be tracked if zombie wins (to maintain anonymity)
    result.p1PlayedVaccine = action1.actionType === 'vaccine';
    result.p2PlayedVaccine = action2.actionType === 'vaccine';

    // Track card consumption
    let p1CardUsed = false;
    let p2CardUsed = false;

    // Priority 1: Handle shotguns first
    if (action1.actionType === 'shotgun') {
        player1.hasShotgun = false;
        result.p1PlayedShotgun = true; // Track that player1 used shotgun
        if (player2.role === 'zombie') {
            result.shotgunKills.push(player2.id);
            result.eliminations.push(player2.id);
            eliminatePlayer(game, player2.id, 'Killed by shotgun');
            addEvent(game, 'shotgun_fired', 'A shotgun was fired');
            addEvent(game, 'elimination', 'A player was eliminated');
        } else {
            // Wasted on human - shotgun card will be revealed
            addEvent(game, 'shotgun_fired', 'A shotgun was fired (wasted)');
        }
    }

    if (action2.actionType === 'shotgun') {
        player2.hasShotgun = false;
        result.p2PlayedShotgun = true; // Track that player2 used shotgun
        if (player1.role === 'zombie') {
            result.shotgunKills.push(player1.id);
            result.eliminations.push(player1.id);
            eliminatePlayer(game, player1.id, 'Killed by shotgun');
            addEvent(game, 'shotgun_fired', 'A shotgun was fired');
            addEvent(game, 'elimination', 'A player was eliminated');
        } else {
            // Wasted on human - shotgun card will be revealed
            addEvent(game, 'shotgun_fired', 'A shotgun was fired (wasted)');
        }
    }

    // If someone was eliminated by shotgun, duel ends
    if (result.shotgunKills.length > 0) {
        duel.status = 'resolved';
        duel.result = result;
        return result;
    }

    // Priority 2: Handle vaccines
    // Vaccine cancels zombie card played by opponent
    if (action1.actionType === 'vaccine') {
        player1.vaccineCard = null;
        if (action2.actionType === 'zombie' || player2.role === 'zombie') {
            // Cure player2
            if (player2.role === 'zombie') {
                curePlayer(game, player2.id);
                result.cures.push(player2.id);
                addEvent(game, 'cure', 'A player was cured');
                result.p1CuredOpponent = true;
            }
            p1CardUsed = true;
        } else {
            // Vaccine used on a human - wasted
            result.p1VaccineWasted = true;
            p1CardUsed = true;
        }
    }

    if (action2.actionType === 'vaccine') {
        player2.vaccineCard = null;
        if (action1.actionType === 'zombie' || player1.role === 'zombie') {
            // Cure player1
            if (player1.role === 'zombie') {
                curePlayer(game, player1.id);
                result.cures.push(player1.id);
                addEvent(game, 'cure', 'A player was cured');
                result.p2CuredOpponent = true;
            }
            p2CardUsed = true;
        } else {
            // Vaccine used on a human - wasted
            result.p2VaccineWasted = true;
            p2CardUsed = true;
        }
    }

    // Priority 3: Handle zombie cards (only if not cancelled by vaccine)
    const p1PlayedZombie = action1.actionType === 'zombie' && !result.cures.includes(player1.id);
    const p2PlayedZombie = action2.actionType === 'zombie' && !result.cures.includes(player2.id);

    // Check if zombie has reached their personal infection limit (0 = unlimited)
    const maxInfections = game.settings.maxInfections;
    const p1CanInfect = maxInfections === 0 || player1.infectionCount < maxInfections;
    const p2CanInfect = maxInfections === 0 || player2.infectionCount < maxInfections;

    if (p1PlayedZombie && p2PlayedZombie) {
        // Both zombies played zombie cards at the same time - draw, no effect
        // Reveal both zombie cards in animation
        result.p1PlayedZombie = true;
        result.p2PlayedZombie = true;
        result.zombieVsZombie = true;
        addEvent(game, 'betrayal', 'Two zombies revealed themselves to each other!');
    } else if (p1PlayedZombie && !p2PlayedZombie && action2.actionType !== 'vaccine') {
        if (player2.role === 'zombie') {
            // Zombie attacking Zombie -> Punishment!
            const lostCard = getRandomStealableCard(player1.numberCards, 'random_any');
            if (lostCard) {
                removeNumberCard(player1, lostCard.id);
                result.cardLost = lostCard;
                addEvent(game, 'betrayal', 'A zombie attacked another zombie and lost a card!');
            }
            result.zombieVsZombie = true;
            // Reveal the attacking zombie's card only
            result.p1PlayedZombie = true;
        } else if (p1CanInfect) {
            // Check if requireZombieWin mode is enabled
            if (game.settings.requireZombieWin && action2.actionType === 'number') {
                // In competitive mode: zombie must also play numbers and win to infect
                // For now, zombie card alone loses to any numbers played
                // The human wins if they played numbers
                const cardIds2 = action2.cardIds || (action2.cardId ? [action2.cardId] : []);
                const cards2 = cardIds2.map(id => player2.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);

                if (cards2.length > 0) {
                    // Human played numbers, they win - no infection
                    result.winnerId = player2.id;
                    result.loserId = player1.id;
                    // Remove opponent's cards and make them lootable
                    for (const card of cards2) {
                        removeNumberCard(player2, card.id);
                    }
                    result.lootableCards = cards2;
                    p2CardUsed = true;
                }
            } else {
                // Standard mode: zombie card always infects (unless vaccine)
                result.winnerId = player1.id;
                result.loserId = player2.id;
                infectPlayer(game, player2.id);
                result.infections.push(player2.id);
                player1.infectionCount++;
                // Reveal zombie card since they won
                result.p1PlayedZombie = true;

                // Remove played number cards from player 2
                if (action2.actionType === 'number') {
                    const cardIds = action2.cardIds || (action2.cardId ? [action2.cardId] : []);
                    for (const cid of cardIds) {
                        removeNumberCard(player2, cid);
                    }
                    p2CardUsed = true;
                }
            }
        }
    } else if (p2PlayedZombie && !p1PlayedZombie && action1.actionType !== 'vaccine') {
        if (player1.role === 'zombie') {
            // Zombie attacking Zombie -> Punishment!
            const lostCard = getRandomStealableCard(player2.numberCards, 'random_any');
            if (lostCard) {
                removeNumberCard(player2, lostCard.id);
                result.cardLost = lostCard;
                addEvent(game, 'betrayal', 'A zombie attacked another zombie and lost a card!');
            }
            result.zombieVsZombie = true;
            // Reveal the attacking zombie's card only
            result.p2PlayedZombie = true;
        } else if (p2CanInfect) {
            // Check if requireZombieWin mode is enabled
            if (game.settings.requireZombieWin && action1.actionType === 'number') {
                // In competitive mode: zombie must also play numbers and win to infect
                const cardIds1 = action1.cardIds || (action1.cardId ? [action1.cardId] : []);
                const cards1 = cardIds1.map(id => player1.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);

                if (cards1.length > 0) {
                    // Human played numbers, they win - no infection
                    result.winnerId = player1.id;
                    result.loserId = player2.id;
                    // Remove opponent's cards and make them lootable
                    for (const card of cards1) {
                        removeNumberCard(player1, card.id);
                    }
                    result.lootableCards = cards1;
                    p1CardUsed = true;
                }
            } else {
                // Standard mode: zombie card always infects
                result.winnerId = player2.id;
                result.loserId = player1.id;
                infectPlayer(game, player1.id);
                result.infections.push(player1.id);
                player2.infectionCount++;
                // Reveal zombie card since they won
                result.p2PlayedZombie = true;

                // Remove played number cards from player 1
                if (action1.actionType === 'number') {
                    const cardIds = action1.cardIds || (action1.cardId ? [action1.cardId] : []);
                    for (const cid of cardIds) {
                        removeNumberCard(player1, cid);
                    }
                    p1CardUsed = true;
                }
            }
        }
    } else if (action1.actionType === 'number' && action2.actionType === 'number') {
        // Priority 4: Number vs Number - sum all cards played
        const cardIds1 = action1.cardIds || (action1.cardId ? [action1.cardId] : []);
        const cardIds2 = action2.cardIds || (action2.cardId ? [action2.cardId] : []);

        // Get all cards and calculate sums
        const cards1 = cardIds1.map(id => player1.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);
        const cards2 = cardIds2.map(id => player2.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);

        const sum1 = cards1.reduce((sum, card) => sum + card.value, 0);
        const sum2 = cards2.reduce((sum, card) => sum + card.value, 0);

        if (cards1.length > 0 && cards2.length > 0) {
            // Remove all played cards from both players - they are spent
            for (const card of cards1) {
                removeNumberCard(player1, card.id);
            }
            for (const card of cards2) {
                removeNumberCard(player2, card.id);
            }
            p1CardUsed = true;
            p2CardUsed = true;

            if (sum1 > sum2) {
                result.winnerId = player1.id;
                result.loserId = player2.id;
                // Winner can loot cards played by loser
                result.lootableCards = cards2;
                // No automatic steal anymore
            } else if (sum2 > sum1) {
                result.winnerId = player2.id;
                result.loserId = player1.id;
                // Winner can loot cards played by loser
                result.lootableCards = cards1;
                // No automatic steal anymore
            }
            // Draw: no loot
        }
    }
    // Priority 5: zombie_with_numbers vs number - competitive infection mode
    else if (action1.actionType === 'zombie_with_numbers' && action2.actionType === 'number') {
        const cardIds1 = action1.cardIds || [];
        const cardIds2 = action2.cardIds || (action2.cardId ? [action2.cardId] : []);

        const cards1 = cardIds1.map(id => player1.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);
        const cards2 = cardIds2.map(id => player2.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);

        const sum1 = cards1.reduce((sum, card) => sum + card.value, 0);
        const sum2 = cards2.reduce((sum, card) => sum + card.value, 0);

        // Remove played cards
        for (const card of cards1) removeNumberCard(player1, card.id);
        for (const card of cards2) removeNumberCard(player2, card.id);
        p1CardUsed = true;
        p2CardUsed = true;

        if (sum1 > sum2) {
            // Zombie wins - infect opponent!
            result.winnerId = player1.id;
            result.loserId = player2.id;
            result.lootableCards = cards2;

            // Infect the human
            if (player2.role === 'human') {
                infectPlayer(game, player2.id);
                result.infections.push(player2.id);
                player1.infectionCount++;
                result.zombieCardRevealed = true;
            }
            // Reveal zombie card since they won
            result.p1PlayedZombie = true;
        } else if (sum2 > sum1) {
            // Human wins - zombie loses cards, no infection
            result.winnerId = player2.id;
            result.loserId = player1.id;
            result.lootableCards = cards1;
            // Zombie card stays hidden
        }
        // Draw: no infection, both lose cards
    }
    else if (action2.actionType === 'zombie_with_numbers' && action1.actionType === 'number') {
        const cardIds1 = action1.cardIds || (action1.cardId ? [action1.cardId] : []);
        const cardIds2 = action2.cardIds || [];

        const cards1 = cardIds1.map(id => player1.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);
        const cards2 = cardIds2.map(id => player2.numberCards.find(c => c.id === id)).filter((c): c is NumberCard => c !== undefined);

        const sum1 = cards1.reduce((sum, card) => sum + card.value, 0);
        const sum2 = cards2.reduce((sum, card) => sum + card.value, 0);

        // Remove played cards
        for (const card of cards1) removeNumberCard(player1, card.id);
        for (const card of cards2) removeNumberCard(player2, card.id);
        p1CardUsed = true;
        p2CardUsed = true;

        if (sum2 > sum1) {
            // Zombie wins - infect opponent!
            result.winnerId = player2.id;
            result.loserId = player1.id;
            result.lootableCards = cards1;

            // Infect the human
            if (player1.role === 'human') {
                infectPlayer(game, player1.id);
                result.infections.push(player1.id);
                player2.infectionCount++;
                result.zombieCardRevealed = true;
            }
            // Reveal zombie card since they won
            result.p2PlayedZombie = true;
        } else if (sum1 > sum2) {
            // Human wins - zombie loses cards, no infection
            result.winnerId = player1.id;
            result.loserId = player2.id;
            result.lootableCards = cards2;
            // Zombie card stays hidden
        }
        // Draw: no infection, both lose cards
    }

    // Check for elimination (0 number cards)
    if (player1.numberCards.length === 0 && player1.status === 'alive') {
        eliminatePlayer(game, player1.id, 'Ran out of cards');
        result.eliminations.push(player1.id);
        if (CONFIG.SHOW_ELIMINATION_COUNT) {
            addEvent(game, 'elimination', 'A player was eliminated');
        }
    }

    if (player2.numberCards.length === 0 && player2.status === 'alive') {
        eliminatePlayer(game, player2.id, 'Ran out of cards');
        result.eliminations.push(player2.id);
        if (CONFIG.SHOW_ELIMINATION_COUNT) {
            addEvent(game, 'elimination', 'A player was eliminated');
        }
    }

    duel.status = 'resolved';
    duel.result = result;

    return result;
}

/**
 * Helper to remove a number card from player's hand
 */
function removeNumberCard(player: Player, cardId: string): void {
    const index = player.numberCards.findIndex(c => c.id === cardId);
    if (index !== -1) {
        player.numberCards.splice(index, 1);
    }
}

/**
 * Get duel result from perspective of a specific player
 */
export function getDuelResultPrivate(
    game: GameState,
    duel: Duel,
    playerId: string
): DuelResultPrivate | null {
    if (!duel.result) return null;

    const player = getPlayer(game, playerId);
    const opponentId = duel.player1Id === playerId ? duel.player2Id : duel.player1Id;

    if (!player) return null;

    const result = duel.result;
    const action = duel.player1Id === playerId ? duel.action1 : duel.action2;

    let outcome: 'win' | 'lose' | 'draw';
    if (result.winnerId === playerId) {
        outcome = 'win';
    } else if (result.loserId === playerId) {
        outcome = 'lose';
    } else {
        outcome = 'draw';
    }

    // Determine stolen/lost cards
    let cardStolen = undefined;
    let cardLost = undefined;

    if (result.stolenCardId) {
        if (result.winnerId === playerId) {
            // This player stole a card
            cardStolen = player.numberCards.find(c => c.id === result.stolenCardId);
        }
    }

    // Check for punishment lost card (Zombie vs Zombie)
    if (result.cardLost && result.loserId === playerId) {
        cardLost = result.cardLost;
    }
    // Or if card was stolen (legacy/other modes)
    else if (result.stolenCardId && result.loserId === playerId) {
        // Can't show which specific card was stolen as it's gone from hand and not stored in result for loser
        // But for new loot mode, they lose cards played
    }

    // Get cards played by each player for reveal animation
    // Use the stored cards from the result (captured before removal)
    const isPlayer1 = duel.player1Id === playerId;
    const yourCards = isPlayer1 ? result.p1PlayedCards : result.p2PlayedCards;
    const opponentCards = isPlayer1 ? result.p2PlayedCards : result.p1PlayedCards;

    // Determine if zombie card was revealed (opponent infected this player)
    const zombieCardRevealed = result.zombieCardRevealed && result.infections.includes(playerId);

    // Get special cards played by each player
    const yourPlayedZombie = isPlayer1 ? result.p1PlayedZombie : result.p2PlayedZombie;
    const opponentPlayedZombie = isPlayer1 ? result.p2PlayedZombie : result.p1PlayedZombie;
    const yourPlayedVaccine = isPlayer1 ? result.p1PlayedVaccine : result.p2PlayedVaccine;
    const opponentPlayedVaccine = isPlayer1 ? result.p2PlayedVaccine : result.p1PlayedVaccine;

    // Get cure/vaccine outcome info
    const opponentCured = isPlayer1 ? result.p1CuredOpponent : result.p2CuredOpponent;
    const vaccineWasted = isPlayer1 ? result.p1VaccineWasted : result.p2VaccineWasted;
    const zombieVsZombie = result.zombieVsZombie;

    return {
        outcome,
        cardStolen,
        cardLost,
        lootableCards: (outcome === 'win' && result.lootableCards) ? result.lootableCards : undefined,
        infected: result.infections.includes(playerId),
        cured: result.cures.includes(playerId),
        shotgunUsed: action?.actionType === 'shotgun',
        shotgunResult: action?.actionType === 'shotgun'
            ? (result.shotgunKills.includes(opponentId) ? 'killed_zombie' : 'wasted_on_human')
            : undefined,
        opponentEliminated: result.eliminations.includes(opponentId),
        youEliminated: result.eliminations.includes(playerId),
        yourCards,
        opponentCards,
        zombieCardRevealed,
        yourPlayedZombie,
        opponentPlayedZombie,
        yourPlayedVaccine,
        opponentPlayedVaccine,
        opponentCured,
        vaccineWasted,
        zombieVsZombie,
        yourPlayedShotgun: isPlayer1 ? result.p1PlayedShotgun : result.p2PlayedShotgun,
        opponentPlayedShotgun: isPlayer1 ? result.p2PlayedShotgun : result.p1PlayedShotgun,
    };
}

/**
 * Get available actions for a player in a duel
 */
export function getAvailableActions(player: Player, duel: Duel): ActionType[] {
    const actions: ActionType[] = [];

    // Number cards (check suit rule)
    const validNumberCards = getValidNumberCards(player, duel);
    if (validNumberCards.length > 0) {
        actions.push('number');
    }

    if (player.zombieCard) actions.push('zombie');
    if (player.vaccineCard) actions.push('vaccine');

    // Zombies cannot use shotguns
    if (player.hasShotgun && player.role === 'human') {
        actions.push('shotgun');
    }

    return actions;
}

/**
 * Get valid number cards for current duel state
 */
export function getValidNumberCards(player: Player, duel: Duel): NumberCard[] {
    if (!duel.requiredSuit) {
        // No suit set yet, all cards valid
        return player.numberCards;
    }

    const suitCards = player.numberCards.filter(c => c.suit === duel.requiredSuit);
    if (suitCards.length > 0) {
        return suitCards;
    }

    // No matching suit - depends on fallback mode
    if (CONFIG.NO_SUIT_FALLBACK === 'allow_any') {
        return player.numberCards;
    }

    return []; // auto_lose mode and no matching suit
}
