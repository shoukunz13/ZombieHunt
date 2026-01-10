/**
 * Zombie Hunt - Eliminated Screen
 * Shown to players who have been eliminated.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { EventItem } from '../components/shared';

export function EliminatedScreen() {
    const navigate = useNavigate();
    const {
        gameState, roundEvents,
        isEliminated, eliminationReason
    } = useGame();

    // If not eliminated, redirect
    useEffect(() => {
        if (!isEliminated && gameState?.phase !== 'ended') {
            navigate('/lobby');
        }
    }, [isEliminated, gameState, navigate]);

    // If game ended, go to end screen
    useEffect(() => {
        if (gameState?.phase === 'ended') {
            navigate('/end');
        }
    }, [gameState, navigate]);

    return (
        <div className="container">
            <div className="screen">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>
                        💀
                    </div>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        color: 'var(--accent-red)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        ELIMINATED
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {eliminationReason || 'You have been removed from the game'}
                    </p>
                </div>

                {/* Spectator Info */}
                <div className="card">
                    <div className="card-header">
                        <span>🎥 Spectator Mode</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                        You can continue watching the game unfold.
                    </p>

                    {gameState && (
                        <div className="info-panel" style={{ background: 'var(--bg-tertiary)', marginBottom: 0 }}>
                            <div className="info-row">
                                <span className="info-label">Phase</span>
                                <span className="info-value" style={{ textTransform: 'capitalize' }}>
                                    {gameState.phase}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Round</span>
                                <span className="info-value">{gameState.round} / 20</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Players Alive</span>
                                <span className="info-value">{gameState.alivePlayerCount}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Event Feed */}
                <div className="card" style={{ marginTop: 'auto' }}>
                    <div className="card-header">
                        <span>📢 Recent Events</span>
                    </div>
                    {roundEvents.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-md)' }}>
                            Waiting for events...
                        </p>
                    ) : (
                        <div className="event-feed" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {roundEvents.map(event => (
                                <EventItem
                                    key={event.id}
                                    type={event.type}
                                    message={event.message}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
