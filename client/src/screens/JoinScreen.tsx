/**
 * ZOMBIE HUNT — Join Screen
 * 
 * Design: Black screen, terminal aesthetic
 * - Lobby code displayed prominently (from URL)
 * - Name input only
 * - Red blinking cursor effect
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ConnectionStatus, DisplayTitle, SystemMessage, Spinner } from '../components/shared';

export function JoinScreen() {
    const navigate = useNavigate();
    const { isConnected, playerId, privateState, joinGame, error, clearError, lobbyCode, hasSession } = useGame();

    const [name, setName] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Navigate when joined
    useEffect(() => {
        if (playerId && privateState) {
            setIsJoining(false);
            navigate(`/game/${lobbyCode}/lobby`);
        }
    }, [playerId, privateState, navigate, lobbyCode]);

    // Auto-reconnect if session exists
    useEffect(() => {
        if (hasSession && playerId && privateState) {
            navigate(`/game/${lobbyCode}/lobby`);
        }
    }, [hasSession, playerId, privateState, navigate, lobbyCode]);

    // Handle errors
    useEffect(() => {
        if (error) {
            setIsJoining(false);
        }
    }, [error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !isConnected) return;

        clearError();
        setIsJoining(true);
        joinGame(name.trim());
    };

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Title Block */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="4xl">ZOMBIE HUNT</DisplayTitle>
                    <SystemMessage>ENTER AT YOUR OWN RISK</SystemMessage>
                </div>

                {/* Lobby Code Display */}
                {lobbyCode && (
                    <div style={{
                        marginBottom: 'var(--space-xl)',
                        padding: 'var(--space-lg)',
                        border: '2px solid var(--terminal-green)',
                        background: 'rgba(57, 255, 20, 0.05)'
                    }}>
                        <p className="text-system" style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-muted)',
                            marginBottom: 'var(--space-xs)'
                        }}>
                            LOBBY CODE
                        </p>
                        <p style={{
                            fontSize: 'var(--font-size-3xl)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--terminal-green)',
                            letterSpacing: '0.3em',
                            textAlign: 'center'
                        }}>
                            {lobbyCode}
                        </p>
                    </div>
                )}

                {/* Connection Status */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Join Form */}
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px' }}>
                    {/* Name Input */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="text-system" style={{
                            display: 'block',
                            marginBottom: 'var(--space-xs)',
                            fontSize: 'var(--font-size-xs)'
                        }}>
                            DESIGNATION
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="ENTER NAME_"
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            maxLength={16}
                            autoComplete="off"
                            disabled={isJoining}
                            autoFocus
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            marginBottom: 'var(--space-md)',
                            padding: 'var(--space-md)',
                            border: '1px solid var(--accent-red)',
                            background: 'rgba(193, 18, 31, 0.1)'
                        }}>
                            <span className="text-system" style={{ color: 'var(--accent-red)' }}>
                                {error}
                            </span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={!isConnected || !name.trim() || isJoining}
                    >
                        {isJoining ? (
                            <>
                                <Spinner />
                                CONNECTING
                            </>
                        ) : (
                            'ENTER GAME'
                        )}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary btn-block"
                        onClick={() => navigate('/join')}
                        style={{ marginTop: 'var(--space-md)' }}
                    >
                        BACK
                    </button>
                </form>

                {/* Warning Footer */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    textAlign: 'center'
                }}>
                    <p className="text-system" style={{
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-xs)'
                    }}>
                        YOUR PARTICIPATION IS VOLUNTARY
                    </p>
                </div>
            </div>
        </div>
    );
}
