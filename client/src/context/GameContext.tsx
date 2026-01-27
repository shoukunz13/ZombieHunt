/**
 * Zombie Hunt - Socket Context
 * React context for Socket.io connection and game state management.
 * 
 * Multi-tenant architecture: Uses lobbyCode from URL params.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
    PlayerPublic, PlayerPrivate, GameStatePublic, PublicEvent,
    DuelResultPrivate, FinalReveal, LobbyUpdatePayload, DuelAssignedPayload,
    PhaseChangePayload, DuelResolutionPayload, MeetingSummaryPayload, GameEndedPayload
} from '../types';

// Get server URL from environment or default to localhost
const getServerUrl = (): string => {
    const port = 3001;
    if (typeof window !== 'undefined') {
        // In production, nginx proxies /socket.io/ to the API server
        if (import.meta.env.PROD) {
            return window.location.origin;
        }
        // In development, connect directly to API server
        return `http://${window.location.hostname}:${port}`;
    }
    return `http://localhost:${port}`;
};

// Session storage helpers (lobby-specific)
const getSessionKey = (lobbyCode: string, type: 'playerId' | 'playerToken' | 'playerName'): string => {
    return `${type}:${lobbyCode}`;
};

const saveSession = (lobbyCode: string, playerId: string, playerToken: string, playerName: string) => {
    sessionStorage.setItem(getSessionKey(lobbyCode, 'playerId'), playerId);
    sessionStorage.setItem(getSessionKey(lobbyCode, 'playerToken'), playerToken);
    sessionStorage.setItem(getSessionKey(lobbyCode, 'playerName'), playerName);
};

const loadSession = (lobbyCode: string): { playerId: string; playerToken: string; playerName: string } | null => {
    try {
        const playerId = sessionStorage.getItem(getSessionKey(lobbyCode, 'playerId'));
        const playerToken = sessionStorage.getItem(getSessionKey(lobbyCode, 'playerToken'));
        const playerName = sessionStorage.getItem(getSessionKey(lobbyCode, 'playerName'));
        
        if (playerId && playerToken && playerName) {
            return { playerId, playerToken, playerName };
        }
        return null;
    } catch {
        return null;
    }
};

const clearSession = (lobbyCode: string) => {
    sessionStorage.removeItem(getSessionKey(lobbyCode, 'playerId'));
    sessionStorage.removeItem(getSessionKey(lobbyCode, 'playerToken'));
    sessionStorage.removeItem(getSessionKey(lobbyCode, 'playerName'));
};

interface GameContextType {
    // Connection
    socket: Socket | null;
    isConnected: boolean;
    lobbyCode: string | null;

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
    joinGame: (name: string) => void;
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
    const { lobbyCode } = useParams<{ lobbyCode: string }>();
    const navigate = useNavigate();
    
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
    const [hasSession, setHasSession] = useState<boolean>(() => {
        if (!lobbyCode) return false;
        return loadSession(lobbyCode) !== null;
    });
    const [lobbyDestroyed, setLobbyDestroyed] = useState(false);
    const [lobbyRestarted, setLobbyRestarted] = useState(false);

    // Initialize socket connection
    useEffect(() => {
        if (!lobbyCode) return;

        const newSocket = io(getServerUrl(), {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);

            // Try to reconnect from saved session
            const session = loadSession(lobbyCode);
            if (session) {
                console.log('Attempting to reconnect to lobby:', lobbyCode);
                newSocket.emit('reconnect_lobby', {
                    lobbyCode,
                    playerToken: session.playerToken,
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

        newSocket.on('lobby_not_found', () => {
            setError('Lobby not found or expired');
            clearSession(lobbyCode);
            setHasSession(false);
            // Navigate back to join screen after delay
            setTimeout(() => {
                navigate('/join?error=not_found');
            }, 2000);
        });

        newSocket.on('lobby_full', () => {
            setError('Lobby is full');
        });

        // Game events
        newSocket.on('joined', (data: {
            playerId: string;
            playerToken: string;
            gameStatePublic: GameStatePublic;
            yourPrivateState: PlayerPrivate;
        }) => {
            setPlayerId(data.playerId);
            setGameState(data.gameStatePublic);
            setPrivateState(data.yourPrivateState);
            setPlayerName(data.yourPrivateState?.name || null);

            // Save session for reconnection
            if (data.playerId && data.playerToken && data.yourPrivateState?.name) {
                saveSession(lobbyCode, data.playerId, data.playerToken, data.yourPrivateState.name);
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
                requireZombieWin: data.requireZombieWin ?? prev.requireZombieWin,
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
            clearSession(lobbyCode);
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
    }, [lobbyCode, navigate]);

    // Actions
    const joinGame = useCallback((name: string) => {
        if (socket && isConnected && lobbyCode) {
            setPlayerName(name);
            socket.emit('join_lobby', { lobbyCode, playerName: name });
        }
    }, [socket, isConnected, lobbyCode]);

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
        if (!lobbyCode) return;
        
        // Clear session from storage
        clearSession(lobbyCode);
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
    }, [socket, lobbyCode]);

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
        lobbyCode: lobbyCode || null,
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
