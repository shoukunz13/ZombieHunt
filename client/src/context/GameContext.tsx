/**
 * Zombie Hunt - Socket Context
 * React context for Socket.io connection and game state management.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    PlayerPublic, PlayerPrivate, GameStatePublic, PublicEvent,
    DuelResultPrivate, FinalReveal, LobbyUpdatePayload, DuelAssignedPayload,
    PhaseChangePayload, DuelResolutionPayload, MeetingSummaryPayload, GameEndedPayload
} from '../types';

// Get server URL from environment or default to localhost
const getServerUrl = (): string => {
    // Use current hostname for LAN play (useful when accessing via IP)
    const port = 3001;
    if (typeof window !== 'undefined') {
        return `http://${window.location.hostname}:${port}`;
    }
    return `http://localhost:${port}`;
};

interface GameContextType {
    // Connection
    socket: Socket | null;
    isConnected: boolean;

    // Player state
    playerId: string | null;
    playerName: string | null;
    privateState: PlayerPrivate | null;

    // Game state
    gameState: GameStatePublic | null;
    players: PlayerPublic[];
    pairingStatus: LobbyUpdatePayload['pairingStatus'] | null;

    // Duel state
    currentDuel: {
        duelId: string;
        opponent: PlayerPublic;
        round: number;
    } | null;
    duelResult: DuelResultPrivate | null;
    hasSubmittedAction: boolean;

    // Meeting state
    roundEvents: PublicEvent[];

    // End game
    finalReveal: FinalReveal | null;
    yourOutcome: 'won' | 'lost' | 'tie' | null;

    // Elimination
    isEliminated: boolean;
    eliminationReason: string | null;

    // Error
    error: string | null;

    // Actions
    joinGame: (gameCode: string, name: string) => void;
    selectOpponent: (opponentId: string) => void;
    cancelSelection: () => void;
    submitAction: (actionType: string, cardId?: string) => void;
    acknowledgeRound: () => void;
    clearError: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Player state
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [privateState, setPrivateState] = useState<PlayerPrivate | null>(null);

    // Game state
    const [gameState, setGameState] = useState<GameStatePublic | null>(null);
    const [players, setPlayers] = useState<PlayerPublic[]>([]);
    const [pairingStatus, setPairingStatus] = useState<LobbyUpdatePayload['pairingStatus'] | null>(null);

    // Duel state
    const [currentDuel, setCurrentDuel] = useState<GameContextType['currentDuel']>(null);
    const [duelResult, setDuelResult] = useState<DuelResultPrivate | null>(null);
    const [hasSubmittedAction, setHasSubmittedAction] = useState(false);

    // Meeting state
    const [roundEvents, setRoundEvents] = useState<PublicEvent[]>([]);

    // End game
    const [finalReveal, setFinalReveal] = useState<FinalReveal | null>(null);
    const [yourOutcome, setYourOutcome] = useState<'won' | 'lost' | 'tie' | null>(null);

    // Elimination
    const [isEliminated, setIsEliminated] = useState(false);
    const [eliminationReason, setEliminationReason] = useState<string | null>(null);

    // Error
    const [error, setError] = useState<string | null>(null);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(getServerUrl(), {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('error', (data: { message: string }) => {
            setError(data.message);
        });

        // Game events
        newSocket.on('joined', (data) => {
            setPlayerId(data.playerId);
            setGameState(data.gameStatePublic);
            setPrivateState(data.yourPrivateState);
        });

        newSocket.on('private_state_update', (data) => {
            setPrivateState(data.yourPrivateState);
        });

        newSocket.on('lobby_update', (data: LobbyUpdatePayload) => {
            setPlayers(data.playersPublic);
            setPairingStatus(data.pairingStatus);
        });

        newSocket.on('phase_change', (data: PhaseChangePayload) => {
            setGameState(prev => prev ? {
                ...prev,
                phase: data.phase,
                round: data.round,
                phaseEndsAt: data.endsAt,
            } : null);

            // Reset duel state on phase change
            if (data.phase === 'lobby') {
                setCurrentDuel(null);
                setDuelResult(null);
                setHasSubmittedAction(false);
            }
        });

        newSocket.on('duel_assigned', (data: DuelAssignedPayload) => {
            setCurrentDuel({
                duelId: data.duelId,
                opponent: data.opponentPublic,
                round: data.round,
            });
            setDuelResult(null);
            setHasSubmittedAction(false);
        });

        newSocket.on('duel_action_confirmed', () => {
            setHasSubmittedAction(true);
        });

        newSocket.on('duel_resolution', (data: DuelResolutionPayload) => {
            setDuelResult(data.resultPrivate);
            setPrivateState(data.updatedPrivateState);
        });

        newSocket.on('meeting_summary', (data: MeetingSummaryPayload) => {
            setRoundEvents(data.publicEvents);
        });

        newSocket.on('eliminated', (data: { reason: string }) => {
            setIsEliminated(true);
            setEliminationReason(data.reason);
        });

        newSocket.on('game_ended', (data: GameEndedPayload) => {
            setFinalReveal(data.finalReveal);
            setYourOutcome(data.yourOutcome);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Actions
    const joinGame = useCallback((gameCode: string, name: string) => {
        if (socket && isConnected) {
            setPlayerName(name);
            socket.emit('join_game', { gameCode, name });
        }
    }, [socket, isConnected]);

    const selectOpponent = useCallback((opponentId: string) => {
        if (socket) {
            socket.emit('lobby_select_opponent', { opponentId });
        }
    }, [socket]);

    const cancelSelection = useCallback(() => {
        if (socket) {
            socket.emit('lobby_cancel_selection');
        }
    }, [socket]);

    const submitAction = useCallback((actionType: string, cardId?: string) => {
        if (socket && currentDuel) {
            socket.emit('duel_submit_action', {
                duelId: currentDuel.duelId,
                actionType,
                cardId,
            });
        }
    }, [socket, currentDuel]);

    const acknowledgeRound = useCallback(() => {
        if (socket) {
            socket.emit('meeting_acknowledge');
        }
    }, [socket]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value: GameContextType = {
        socket,
        isConnected,
        playerId,
        playerName,
        privateState,
        gameState,
        players,
        pairingStatus,
        currentDuel,
        duelResult,
        hasSubmittedAction,
        roundEvents,
        finalReveal,
        yourOutcome,
        isEliminated,
        eliminationReason,
        error,
        joinGame,
        selectOpponent,
        cancelSelection,
        submitAction,
        acknowledgeRound,
        clearError,
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame(): GameContextType {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
