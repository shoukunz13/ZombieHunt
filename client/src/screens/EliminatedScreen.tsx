/**
 * ZOMBIE HUNT — Eliminated Screen
 * 
 * Design: Stark, final
 * - Large GAME OVER message
 * - Small text about removal
 * - Spectator mode only
 * - Dramatic shotgun death animation if killed by shotgun
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { EventItem, DisplayTitle } from '../components/shared';
import { ShotgunDeathOverlay } from '../components/ShotgunDeathOverlay';

export function EliminatedScreen() {
    const navigate = useNavigate();
    const {
        gameState, roundEvents,
        isEliminated, eliminationReason
    } = useGame();

    const [showShotgunAnimation, setShowShotgunAnimation] = useState(false);

    // Check if this is a death that should show the laser animation
    // (shotgun kills or running out of cards)
    useEffect(() => {
        if (isEliminated && eliminationReason) {
            const reason = eliminationReason.toLowerCase();
            if (reason.includes('shotgun') || reason.includes('cards') || reason.includes('ran out')) {
                setShowShotgunAnimation(true);
            }
        }
    }, [isEliminated, eliminationReason]);

    const handleShotgunAnimationComplete = () => {
        setShowShotgunAnimation(false);
    };

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

    // Show shotgun animation if applicable
    if (showShotgunAnimation) {
        return <ShotgunDeathOverlay onComplete={handleShotgunAnimationComplete} />;
    }

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Stark elimination message */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="massive">GAME</DisplayTitle>
                    <DisplayTitle size="massive">OVER</DisplayTitle>
                </div>

                <div style={{
                    marginBottom: 'var(--space-2xl)',
                    maxWidth: '280px',
                    textAlign: 'center'
                }}>
                    <p className="text-system" style={{
                        marginBottom: 'var(--space-md)',
                        color: 'var(--accent-red)'
                    }}>
                        YOU ARE NO LONGER A PLAYER
                    </p>
                    {eliminationReason && (
                        <p className="text-system" style={{ color: 'var(--text-muted)' }}>
                            {eliminationReason}
                        </p>
                    )}
                </div>

                {/* Spectator Info */}
                <div className="card" style={{ width: '100%', maxWidth: '320px' }}>
                    <div className="card-header">
                        <span>SPECTATOR MODE</span>
                    </div>

                    {gameState && (
                        <div className="info-panel" style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0
                        }}>
                            <div className="info-row">
                                <span className="info-label">PHASE</span>
                                <span className="info-value" style={{ textTransform: 'uppercase' }}>
                                    {gameState.phase}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">ROUND</span>
                                <span className="info-value">{gameState.round} / 20</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">REMAINING</span>
                                <span className="info-value">{gameState.alivePlayerCount}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Event Feed */}
                {roundEvents.length > 0 && (
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '320px',
                        marginTop: 'var(--space-lg)'
                    }}>
                        <div className="card-header">
                            <span>RECENT ACTIVITY</span>
                        </div>
                        <div className="event-feed" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                            {roundEvents.map(event => (
                                <EventItem
                                    key={event.id}
                                    type={event.type}
                                    message={event.message}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
