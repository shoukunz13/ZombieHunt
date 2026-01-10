/**
 * Zombie Hunt - Server Configuration
 * All game parameters are configurable here.
 */

export const CONFIG = {
    // Server settings
    PORT: parseInt(process.env.PORT || '3001', 10),
    HOST_PIN: process.env.HOST_PIN || '1234',

    // Game settings
    TEAM_COUNT: 4, // Number of teams (for N=20, this gives 5 per team)
    MIN_PLAYERS: 6, // Minimum players to start
    ROUNDS: 20, // Total rounds in a game

    // Card settings
    STARTING_NUMBER_CARDS: 7, // Number cards each player starts with
    NUMBER_CARD_MIN_VALUE: 1,
    NUMBER_CARD_MAX_VALUE: 13, // Range 1-13 like a standard deck

    // Timing (in seconds)
    DUEL_DURATION_SEC: 180, // 3 minutes
    MEETING_DURATION_SEC: 60, // 1 minute

    // Special cards
    VACCINE_RATIO: 0.25, // floor(N * VACCINE_RATIO) vaccines distributed

    // Gameplay options
    DISCONNECT_AUTOPLAY: true, // Auto-submit lowest valid move on disconnect
    STEAL_MODE: 'random_number_only' as 'random_number_only' | 'random_any' | 'winner_choice',
    NO_SUIT_FALLBACK: 'allow_any' as 'allow_any' | 'auto_lose',

    // Persistence
    PERSISTENCE_FILE: './game_state.json',
    ENABLE_PERSISTENCE: true,

    // Event visibility
    SHOW_ELIMINATION_COUNT: true, // Show "X eliminations this round" in events
} as const;

export type StealMode = typeof CONFIG.STEAL_MODE;
export type NoSuitFallback = typeof CONFIG.NO_SUIT_FALLBACK;
