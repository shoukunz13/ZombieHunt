/**
 * ZOMBIE HUNT — Create Lobby Screen
 * 
 * Single button to create a new lobby.
 * No PIN required - anyone can create.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { DisplayTitle, SystemMessage, ConnectionStatus, Spinner } from '../components/shared';

// Get server URL
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

export function CreateLobbyScreen() {
    const navigate = useNavigate();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
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

        newSocket.on('lobby_created', (data: { lobbyCode: string; hostToken: string }) => {
            console.log('Lobby created:', data.lobbyCode);
            // Store host token for this lobby
            sessionStorage.setItem(`hostToken:${data.lobbyCode}`, data.hostToken);
            // Navigate to host dashboard
            navigate(`/host/${data.lobbyCode}`);
        });

        newSocket.on('too_many_lobbies', () => {
            setError('Server is at maximum capacity. Please try again later.');
            setIsCreating(false);
        });

        newSocket.on('error', (data: { message: string }) => {
            setError(data.message);
            setIsCreating(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [navigate]);

    const handleCreate = () => {
        if (!socket || !isConnected) return;
        
        setError(null);
        setIsCreating(true);
        socket.emit('create_lobby');
    };

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Title Block */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="3xl">CREATE LOBBY</DisplayTitle>
                    <SystemMessage>HOST A NEW GAME</SystemMessage>
                </div>

                {/* Connection Status */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        marginBottom: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        border: '1px solid var(--accent-red)',
                        background: 'rgba(193, 18, 31, 0.1)',
                        maxWidth: '320px',
                        width: '100%'
                    }}>
                        <span className="text-system" style={{ color: 'var(--accent-red)' }}>
                            {error}
                        </span>
                    </div>
                )}

                {/* Create Button */}
                <div style={{ width: '100%', maxWidth: '320px' }}>
                    <button
                        className="btn btn-primary btn-block"
                        onClick={handleCreate}
                        disabled={!isConnected || isCreating}
                        style={{ fontSize: 'var(--font-size-lg)' }}
                    >
                        {isCreating ? (
                            <>
                                <Spinner />
                                CREATING...
                            </>
                        ) : (
                            'CREATE LOBBY'
                        )}
                    </button>

                    <button
                        className="btn btn-secondary btn-block"
                        onClick={() => navigate('/')}
                        style={{ marginTop: 'var(--space-md)' }}
                    >
                        BACK
                    </button>
                </div>

                {/* Info */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    textAlign: 'center'
                }}>
                    <p className="text-system" style={{
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-xs)'
                    }}>
                        A LOBBY CODE WILL BE GENERATED FOR YOU
                    </p>
                </div>
            </div>
        </div>
    );
}
