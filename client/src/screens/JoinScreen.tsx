/**
 * Zombie Hunt - Join Screen
 * Initial screen for players to enter their name and join a game.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ConnectionStatus } from '../components/shared';

export function JoinScreen() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const { isConnected, joinGame, playerId, gameState, error, clearError } = useGame();

    const [name, setName] = useState('');
    const [gameCode, setGameCode] = useState(searchParams.get('code') || 'ZOMBIE');
    const [isJoining, setIsJoining] = useState(false);

    // Navigate to appropriate screen once joined
    useEffect(() => {
        if (playerId && gameState) {
            if (gameState.phase === 'waiting' || gameState.phase === 'lobby') {
                navigate('/lobby');
            } else if (gameState.phase === 'duel') {
                navigate('/duel');
            } else if (gameState.phase === 'meeting') {
                navigate('/meeting');
            } else if (gameState.phase === 'ended') {
                navigate('/end');
            }
        }
    }, [playerId, gameState, navigate]);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !gameCode.trim() || !isConnected) return;

        clearError();
        setIsJoining(true);
        joinGame(gameCode.toUpperCase(), name.trim());

        // Reset joining state after timeout
        setTimeout(() => setIsJoining(false), 3000);
    };

    return (
        <div className="container">
            <div className="screen">
                <div className="header">
                    <h1 className="title">🧟 Zombie Hunt</h1>
                    <p className="subtitle">IRL Deception Game</p>
                </div>

                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                <div className="card">
                    <form onSubmit={handleJoin}>
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label
                                htmlFor="name"
                                style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-sm)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}
                            >
                                Your Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                className="input"
                                placeholder="Enter your name..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={20}
                                autoComplete="off"
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <label
                                htmlFor="code"
                                style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-sm)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}
                            >
                                Game Code
                            </label>
                            <input
                                id="code"
                                type="text"
                                className="input"
                                placeholder="Enter game code..."
                                value={gameCode}
                                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                                maxLength={10}
                                autoComplete="off"
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>

                        {error && (
                            <div
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: 'var(--accent-red)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--spacing-md)',
                                    fontSize: 'var(--font-size-sm)'
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!isConnected || !name.trim() || !gameCode.trim() || isJoining}
                        >
                            {isJoining ? 'Joining...' : 'Join Game'}
                        </button>
                    </form>
                </div>

                <div
                    style={{
                        marginTop: 'auto',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-xs)'
                    }}
                >
                    <p>Survivors vs Infected</p>
                    <p style={{ marginTop: 'var(--spacing-xs)' }}>
                        🔫 Shotgun • 💉 Vaccine • 🧟 Zombie
                    </p>
                </div>
            </div>
        </div>
    );
}
