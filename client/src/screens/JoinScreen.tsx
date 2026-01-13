/**
 * ZOMBIE HUNT — Join Screen
 * 
 * Design: Black screen, terminal aesthetic
 * - Centered title
 * - Small threatening subtitle
 * - Terminal-style input
 * - Red blinking cursor effect
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ConnectionStatus, DisplayTitle, SystemMessage, Spinner } from '../components/shared';

export function JoinScreen() {
    const navigate = useNavigate();
    const { isConnected, playerId, privateState, joinGame, error, clearError } = useGame();

    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Navigate when joined
    useEffect(() => {
        if (playerId && privateState) {
            setIsJoining(false);
            navigate('/lobby');
        }
    }, [playerId, privateState, navigate]);

    // Handle errors
    useEffect(() => {
        if (error) {
            setIsJoining(false);
        }
    }, [error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !gameCode.trim() || !isConnected) return;

        clearError();
        setIsJoining(true);
        joinGame(gameCode.trim().toUpperCase(), name.trim());
    };

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Title Block */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="4xl">ZOMBIE HUNT</DisplayTitle>
                    <SystemMessage>ENTER AT YOUR OWN RISK</SystemMessage>
                </div>

                {/* Connection Status */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Join Form */}
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px' }}>
                    {/* Name Input */}
                    <div style={{ marginBottom: 'var(--space-md)' }}>
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
                        />
                    </div>

                    {/* Game Code Input */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="text-system" style={{
                            display: 'block',
                            marginBottom: 'var(--space-xs)',
                            fontSize: 'var(--font-size-xs)'
                        }}>
                            ACCESS CODE
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="ENTER CODE_"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                            maxLength={12}
                            autoComplete="off"
                            disabled={isJoining}
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
                        disabled={!isConnected || !name.trim() || !gameCode.trim() || isJoining}
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
