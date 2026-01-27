/**
 * Zombie Hunt - Host Context
 * React context for host dashboard Socket.io connection.
 * 
 * Supports two modes:
 * - Admin mode (/host) - requires HOST_PIN, sees all lobbies
 * - Lobby host mode (/host/:lobbyCode) - requires hostToken from sessionStorage
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { HostState, PublicEvent, GameSettings } from '../types';

const getServerUrl = (): string => {
    const port = 3001;
    if (typeof window !== 'undefined') {
        // In production, nginx proxies /socket.io/ to the API server
        if (import.meta.env.PROD) {
            return window.location.origin;
        }
        return `http://${window.location.hostname}:${port}`;
    }
    return `http://localhost:${port}`;
};

// Get host token from sessionStorage
const getHostToken = (lobbyCode: string): string | null => {
    return sessionStorage.getItem(`hostToken:${lobbyCode}`);
};

interface AnnihilationData {
    message: string;
    zombieCount: number;
}

interface HostContextType {
    socket: Socket | null;
    isConnected: boolean;
    isAuthenticated: boolean;
    hostState: HostState | null;
    events: PublicEvent[];
    authError: string | null;
    lobbyCode: string | null;
    annihilationData: AnnihilationData | null;
    isAdminMode: boolean;

    authenticate: (pin: string) => void;
    startGame: () => void;
    forcePhase: (phase: string) => void;
    kickPlayer: (playerId: string) => void;
    endGame: () => void;
    completeIntro: () => void;
    updateSettings: (settings: Partial<GameSettings>) => void;
    clearAnnihilation: () => void;
    revealComplete: () => void;
    restartGame: () => void;
}

const HostContext = createContext<HostContextType | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
    const { lobbyCode: routeLobbyCode } = useParams<{ lobbyCode?: string }>();
    const navigate = useNavigate();
    
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [hostState, setHostState] = useState<HostState | null>(null);
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [authError, setAuthError] = useState<string | null>(null);
    const [lobbyCode, setLobbyCode] = useState<string | null>(routeLobbyCode || null);
    const [annihilationData, setAnnihilationData] = useState<AnnihilationData | null>(null);
    const [hostToken, setHostToken] = useState<string | null>(() => {
        if (routeLobbyCode) {
            return getHostToken(routeLobbyCode);
        }
        return null;
    });

    // Admin mode = no lobbyCode in URL (global admin dashboard)
    const isAdminMode = !routeLobbyCode;

    useEffect(() => {
        const newSocket = io(getServerUrl(), {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Host socket connected');
            setIsConnected(true);

            // If we have a lobby code and host token, join as host (not as player)
            if (routeLobbyCode && hostToken) {
                console.log('Joining lobby as host:', routeLobbyCode);
                newSocket.emit('host_join_lobby', { 
                    lobbyCode: routeLobbyCode, 
                    hostToken: hostToken
                });
            }
        });

        newSocket.on('disconnect', () => {
            console.log('Host socket disconnected');
            setIsConnected(false);
        });

        // Admin mode events
        newSocket.on('host_authed', () => {
            console.log('Admin authenticated');
            setIsAuthenticated(true);
            setAuthError(null);
        });

        newSocket.on('host_auth_failed', (data) => {
            setAuthError(data.message);
            setIsAuthenticated(false);
        });

        // Lobby host mode - host joined successfully
        newSocket.on('host_joined', (data: { lobbyCode: string; hostState: any }) => {
            console.log('Host joined lobby:', data.lobbyCode);
            setIsAuthenticated(true);
            setLobbyCode(data.lobbyCode);
            setHostState(data.hostState);
            setAuthError(null);
        });

        // Lobby host state updates
        newSocket.on('host_state_update', (data) => {
            setHostState(data.fullState);
            setEvents(data.publicEvents || []);
            if (data.fullState?.gameCode) {
                setLobbyCode(data.fullState.gameCode);
            }
        });

        // Admin mode lobby list updates
        newSocket.on('admin_lobbies', (data) => {
            console.log('Received admin lobbies:', data.lobbies);
        });

        newSocket.on('admin_lobby_update', (data) => {
            // For admin mode - update specific lobby in list
            console.log('Admin lobby update:', data.code);
        });

        newSocket.on('host_game_ended', () => {
            console.log('Game ended by host');
            setLobbyCode(null);
            setHostState(null);
            setEvents([]);
            setAnnihilationData(null);
            
            // Navigate back to create lobby page
            navigate('/create');
        });

        newSocket.on('host_game_restarted', (data) => {
            console.log('Game restarted:', data.message);
        });

        newSocket.on('host_annihilation', (data: AnnihilationData) => {
            console.log('[ANNIHILATION] All players infected!', data);
            setAnnihilationData(data);
        });

        newSocket.on('lobby_not_found', () => {
            setAuthError('Lobby not found or expired');
            setIsAuthenticated(false);
            navigate('/create');
        });

        newSocket.on('error', (data: { message: string }) => {
            console.error('Host error:', data.message);
            setAuthError(data.message);
        });

        // Handle lobby_created for when creating from CreateLobbyScreen
        newSocket.on('lobby_created', (data: { lobbyCode: string; hostToken: string }) => {
            console.log('Lobby created:', data.lobbyCode);
            setLobbyCode(data.lobbyCode);
            setHostToken(data.hostToken);
            sessionStorage.setItem(`hostToken:${data.lobbyCode}`, data.hostToken);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [routeLobbyCode, hostToken, navigate]);

    // Admin authentication (requires PIN)
    const authenticate = useCallback((pin: string) => {
        if (socket) {
            socket.emit('host_auth', { pin });
        }
    }, [socket]);

    // All host actions include hostToken for lobby host mode
    const startGame = useCallback(() => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_start_game', { hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const forcePhase = useCallback((phase: string) => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_force_phase', { phase, hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const kickPlayer = useCallback((playerId: string) => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_kick_player', { playerId, hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const endGame = useCallback(() => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_end_game', { hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const completeIntro = useCallback(() => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_intro_complete', { hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const updateSettings = useCallback((settings: Partial<GameSettings>) => {
        if (socket && (isAuthenticated || hostToken)) {
            socket.emit('host_update_settings', { settings, hostToken });
        }
    }, [socket, isAuthenticated, hostToken]);

    const clearAnnihilation = useCallback(() => {
        setAnnihilationData(null);
    }, []);

    const revealComplete = useCallback(() => {
        if (socket) {
            console.log('[HOST] Reveal complete - notifying server to send results to players');
            socket.emit('host_reveal_complete', { hostToken });
        }
    }, [socket, hostToken]);

    const restartGame = useCallback(() => {
        if (socket) {
            console.log('[HOST] Restarting game (Play Again)');
            socket.emit('host_restart_game', { hostToken });
        }
    }, [socket, hostToken]);

    const value: HostContextType = {
        socket,
        isConnected,
        isAuthenticated: isAuthenticated || !!hostToken,
        hostState,
        events,
        authError,
        lobbyCode,
        annihilationData,
        isAdminMode,
        authenticate,
        startGame,
        forcePhase,
        kickPlayer,
        endGame,
        completeIntro,
        updateSettings,
        clearAnnihilation,
        revealComplete,
        restartGame,
    };

    return (
        <HostContext.Provider value={value}>
            {children}
        </HostContext.Provider>
    );
}

export function useHost(): HostContextType {
    const context = useContext(HostContext);
    if (!context) {
        throw new Error('useHost must be used within a HostProvider');
    }
    return context;
}
