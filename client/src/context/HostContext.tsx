/**
 * Zombie Hunt - Host Context
 * React context for host dashboard Socket.io connection.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { HostState, PublicEvent } from '../types';

const getServerUrl = (): string => {
    const port = 3001;
    if (typeof window !== 'undefined') {
        return `http://${window.location.hostname}:${port}`;
    }
    return `http://localhost:${port}`;
};

interface HostContextType {
    socket: Socket | null;
    isConnected: boolean;
    isAuthenticated: boolean;
    hostState: HostState | null;
    events: PublicEvent[];
    authError: string | null;

    authenticate: (pin: string) => void;
    startGame: () => void;
    forcePhase: (phase: string) => void;
    kickPlayer: (playerId: string) => void;
}

const HostContext = createContext<HostContextType | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [hostState, setHostState] = useState<HostState | null>(null);
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const newSocket = io(getServerUrl(), {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Host socket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Host socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('host_authed', (data) => {
            console.log('Host authenticated');
            setIsAuthenticated(true);
            setHostState(data.hostState);
            setAuthError(null);
        });

        newSocket.on('host_auth_failed', (data) => {
            setAuthError(data.message);
            setIsAuthenticated(false);
        });

        newSocket.on('host_state_update', (data) => {
            setHostState(data.fullState);
            setEvents(data.publicEvents || []);
        });

        newSocket.on('error', (data: { message: string }) => {
            console.error('Host error:', data.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const authenticate = useCallback((pin: string) => {
        if (socket) {
            socket.emit('host_auth', { pin });
        }
    }, [socket]);

    const startGame = useCallback(() => {
        if (socket && isAuthenticated) {
            socket.emit('host_start_game');
        }
    }, [socket, isAuthenticated]);

    const forcePhase = useCallback((phase: string) => {
        if (socket && isAuthenticated) {
            socket.emit('host_force_phase', { phase });
        }
    }, [socket, isAuthenticated]);

    const kickPlayer = useCallback((playerId: string) => {
        if (socket && isAuthenticated) {
            socket.emit('host_kick_player', { playerId });
        }
    }, [socket, isAuthenticated]);

    const value: HostContextType = {
        socket,
        isConnected,
        isAuthenticated,
        hostState,
        events,
        authError,
        authenticate,
        startGame,
        forcePhase,
        kickPlayer,
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
