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

// Session storage for reconnection
const SESSION_KEY = 'zombieHuntSession';

interface GameSession {
    playerId: string;
    playerName: string;
    gameCode: string;
}

const saveSession = (session: GameSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const loadSession = (): GameSession | null => {
    try {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
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
    declineInvite: (inviterId: string) => void;
    submitAction: (actionType: string, cardId?: string, cardIds?: string[]) => void;
    acknowledgeRound: () => void;
    clearError: () => void;
    clearDuel: () => void;
    leaveGame: () => void;
    hasSession: boolean;
    lobbyDestroyed: boolean;
    clearLobbyDestroyed: () => void;
    lobbyRestarted: boolean;
    clearLobbyRestarted: () => void;
    claimLoot: (duelId: string, cardId: string) => void;
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

    // Session state  
    const [hasSession, setHasSession] = useState<boolean>(() => loadSession() !== null);
    const [lobbyDestroyed, setLobbyDestroyed] = useState(false);
    const [lobbyRestarted, setLobbyRestarted] = useState(false);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(getServerUrl(), {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);

            // Try to reconnect from saved session
            const session = loadSession();
            if (session) {
                console.log('Attempting to rejoin from session:', session);
                newSocket.emit('rejoin_game', {
                    playerId: session.playerId,
                    gameCode: session.gameCode,
                    name: session.playerName,
                });
            }
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

            // Save session for reconnection
            if (data.playerId && data.gameStatePublic?.gameCode) {
                const session: GameSession = {
                    playerId: data.playerId,
                    playerName: data.yourPrivateState?.name || '',
                    gameCode: data.gameStatePublic.gameCode,
                };
                saveSession(session);
                setHasSession(true);
            }
        });

        newSocket.on('private_state_update', (data) => {
            setPrivateState(data.yourPrivateState);
        });

        newSocket.on('lobby_update', (data: LobbyUpdatePayload) => {
            setPlayers(data.playersPublic);
            setPairingStatus(data.pairingStatus);
        });

        newSocket.on('phase_change', (data: PhaseChangePayload) => {
            console.log('[phase_change] Received:', data);
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
            console.log('[duel_resolution] Received:', data);
            setDuelResult(data.resultPrivate);
            setPrivateState(data.updatedPrivateState);

            if (data.resultPrivate.lootableCards) {
                console.log('[duel_resolution] Lootable cards:', data.resultPrivate.lootableCards);
            }
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

        newSocket.on('game_force_ended', () => {
            // Reset all state - game was terminated by host
            setPlayerId(null);
            setGameState(null);
            setPrivateState(null);
            setPlayers([]);
            setPairingStatus(null);
            setCurrentDuel(null);
            setDuelResult(null);
            setHasSubmittedAction(false);
            setRoundEvents([]);
            setFinalReveal(null);
            setYourOutcome(null);
            setIsEliminated(false);
            setEliminationReason(null);
            setError('Game has been terminated by host');

            // Clear session storage and set redirect flag
            clearSession();
            setHasSession(false);
            setLobbyDestroyed(true);
        });

        newSocket.on('lobby_restarted', () => {
            // Host has started a new game - players can now return to lobby
            console.log('Lobby restarted by host - can return to lobby');
            setLobbyRestarted(true);
            // Clear end game state so player can rejoin
            setFinalReveal(null);
            setYourOutcome(null);
            // Clear elimination state so killed players can rejoin
            setIsEliminated(false);
            setEliminationReason(null);
            // Clear duel state so card flip screen doesn't appear
            setCurrentDuel(null);
            setDuelResult(null);
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

    const declineInvite = useCallback((inviterId: string) => {
        if (socket) {
            socket.emit('lobby_decline_invite', { inviterId });
        }
    }, [socket]);

    const submitAction = useCallback((actionType: string, cardId?: string, cardIds?: string[]) => {
        console.log('[submitAction] Called with:', { actionType, cardId, cardIds, socket: !!socket, currentDuel });
        if (socket && currentDuel) {
            console.log('[submitAction] Emitting duel_submit_action');
            socket.emit('duel_submit_action', {
                duelId: currentDuel.duelId,
                actionType,
                cardId,
                cardIds,
            });
        } else {
            console.log('[submitAction] NOT emitting - socket:', !!socket, 'currentDuel:', currentDuel);
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

    const clearDuel = useCallback(() => {
        setCurrentDuel(null);
        setDuelResult(null);
        setHasSubmittedAction(false);
    }, []);

    const leaveGame = useCallback(() => {
        // Clear session from storage
        clearSession();
        setHasSession(false);

        // Emit leave event to server
        if (socket) {
            socket.emit('leave_game');
        }

        // Reset all local state
        setPlayerId(null);
        setPlayerName(null);
        setPrivateState(null);
        setGameState(null);
        setPlayers([]);
        setPairingStatus(null);
        setCurrentDuel(null);
        setDuelResult(null);
        setHasSubmittedAction(false);
        setRoundEvents([]);
        setFinalReveal(null);
        setYourOutcome(null);
        setIsEliminated(false);
        setEliminationReason(null);
    }, [socket]);

    const clearLobbyDestroyed = useCallback(() => {
        setLobbyDestroyed(false);
    }, []);

    const clearLobbyRestarted = useCallback(() => {
        setLobbyRestarted(false);
    }, []);

    const claimLoot = useCallback((duelId: string, cardId: string) => {
        if (socket) {
            socket.emit('claim_loot', { duelId, cardId });
        }
    }, [socket]);

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
        declineInvite,
        submitAction,
        acknowledgeRound,
        clearError,
        clearDuel,
        leaveGame,
        hasSession,
        lobbyDestroyed,
        clearLobbyDestroyed,
        lobbyRestarted,
        clearLobbyRestarted,
        claimLoot,
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
