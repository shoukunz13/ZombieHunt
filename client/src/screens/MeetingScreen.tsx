/**
 * Zombie Hunt - Meeting Screen
 * Players return to the meeting area and see round events.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    Timer, RoleBadge, SpecialIcons, EventItem,
    PlayingCardComponent
} from '../components/shared';

export function MeetingScreen() {
    const navigate = useNavigate();
    const {
        privateState, gameState, roundEvents, isEliminated
    } = useGame();

    // Handle phase changes
    useEffect(() => {
        if (!gameState) {
            navigate('/');
            return;
        }

        if (gameState.phase === 'lobby') {
            navigate('/lobby');
        } else if (gameState.phase === 'duel') {
            navigate('/duel');
        } else if (gameState.phase === 'ended') {
            navigate('/end');
        }
    }, [gameState, navigate]);

    useEffect(() => {
        if (isEliminated) {
            navigate('/eliminated');
        }
    }, [isEliminated, navigate]);

    if (!privateState || !gameState) {
        return (
            <div className="container">
                <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="screen">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-sm)' }}>
                        📍 Meeting Phase
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Return to the meeting area
                    </p>
                    {gameState.phaseEndsAt && <Timer endsAt={gameState.phaseEndsAt} />}
                </div>

                {/* Round Info */}
                <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>
                        Round {gameState.round} / 20
                    </p>
                </div>

                {/* Your Status */}
                <div className="info-panel">
                    <div className="info-row">
                        <span className="info-label">Your Role</span>
                        <RoleBadge role={privateState.role} />
                    </div>
                    <div className="info-row">
                        <span className="info-label">Cards Remaining</span>
                        <span className="info-value">{privateState.numberCards.length}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Special Items</span>
                        <SpecialIcons
                            hasZombie={!!privateState.zombieCard}
                            hasVaccine={!!privateState.vaccineCard}
                            hasShotgun={privateState.hasShotgun}
                        />
                    </div>
                </div>

                {/* Round Events */}
                <div className="card">
                    <div className="card-header">
                        <span>📢 Round Events</span>
                    </div>
                    {roundEvents.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-md)' }}>
                            No notable events this round
                        </p>
                    ) : (
                        <div className="event-feed">
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

                {/* Your Cards Preview */}
                <div className="card" style={{ marginTop: 'auto' }}>
                    <div className="card-header">
                        <span>Your Hand</span>
                    </div>
                    <div className="card-hand">
                        {privateState.numberCards
                            .sort((a, b) => {
                                if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
                                return a.value - b.value;
                            })
                            .map(card => (
                                <PlayingCardComponent
                                    key={card.id}
                                    card={card}
                                    disabled
                                />
                            ))}
                    </div>
                </div>

                {/* Next Round Hint */}
                <div style={{
                    textAlign: 'center',
                    marginTop: 'var(--spacing-md)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    {gameState.round < 20
                        ? 'Next round starting soon...'
                        : 'Final round complete! Results incoming...'}
                </div>
            </div>
        </div>
    );
}
