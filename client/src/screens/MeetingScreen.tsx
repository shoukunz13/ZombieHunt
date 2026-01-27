/**
 * ZOMBIE HUNT — Meeting Screen
 * 
 * Design: Black background, stark messages
 * - Center text for return instruction
 * - Anonymous event feed
 * - No counts or team info
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    Timer, RoleBadge, SpecialIcons, EventItem,
    PlayingCardComponent, DisplayTitle, SystemMessage
} from '../components/shared';
import { RulebookModal, RulebookButton } from '../components/RulebookModal';
import { playMeetingSound } from '../utils/sounds';

export function MeetingScreen() {
    const navigate = useNavigate();
    const {
        privateState, gameState, roundEvents, isEliminated
    } = useGame();

    const [showRulebook, setShowRulebook] = useState(false);

    // Play meeting sound on mount
    useEffect(() => {
        playMeetingSound();
    }, []);

    // Handle phase changes
    useEffect(() => {
        if (!gameState) {
            navigate('/');
            return;
        }

        const lobbyCode = gameState.gameCode;

        if (gameState.phase === 'lobby') {
            navigate(`/game/${lobbyCode}/lobby`);
        } else if (gameState.phase === 'duel') {
            navigate(`/game/${lobbyCode}/duel`);
        } else if (gameState.phase === 'ended') {
            navigate(`/game/${lobbyCode}/end`);
        }
    }, [gameState, navigate]);

    useEffect(() => {
        if (isEliminated && gameState) {
            navigate(`/game/${gameState.gameCode}/eliminated`);
        }
    }, [isEliminated, gameState, navigate]);

    if (!privateState || !gameState) {
        return (
            <div className="container">
                <div className="screen screen-centered">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="screen">
                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 'var(--space-2xl)',
                    paddingTop: 'var(--space-xl)'
                }}>
                    <DisplayTitle size="2xl">RETURN TO</DisplayTitle>
                    <DisplayTitle size="3xl">MEETING AREA</DisplayTitle>
                    {gameState.phaseEndsAt && (
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <Timer endsAt={gameState.phaseEndsAt} />
                        </div>
                    )}
                </div>

                {/* Round Number */}
                <div style={{
                    textAlign: 'center',
                    padding: 'var(--space-lg)',
                    border: '1px solid var(--border-muted)',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <SystemMessage>ROUND COMPLETE</SystemMessage>
                    <p className="heading-display" style={{ fontSize: 'var(--font-size-massive)' }}>
                        {gameState.round}
                    </p>
                    <SystemMessage>OF 20</SystemMessage>
                </div>

                {/* Your Status - Minimal */}
                <div className="info-panel" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="info-row">
                        <span className="info-label">STATUS</span>
                        <RoleBadge role={privateState.role} />
                    </div>
                    <div className="info-row">
                        <span className="info-label">CARDS</span>
                        <span className="info-value">{privateState.numberCards.length}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">SPECIAL</span>
                        <SpecialIcons
                            hasZombie={!!privateState.zombieCard}
                            hasVaccine={!!privateState.vaccineCard}
                            hasShotgun={privateState.hasShotgun}
                        />
                    </div>
                </div>

                {/* Event Feed - Anonymous */}
                <div className="card" style={{ flex: 1 }}>
                    <div className="card-header">
                        <span>INCIDENT REPORT</span>
                    </div>
                    {roundEvents.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl)'
                        }}>
                            <SystemMessage>NO INCIDENTS REPORTED</SystemMessage>
                        </div>
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

                {/* Cards Preview - Collapsed */}
                <details style={{ marginTop: 'var(--space-lg)' }}>
                    <summary className="text-system" style={{
                        cursor: 'pointer',
                        padding: 'var(--space-md)',
                        border: '1px solid var(--border-muted)',
                        background: 'var(--bg-secondary)'
                    }}>
                        VIEW YOUR HAND ({privateState.numberCards.length})
                    </summary>
                    <div className="card" style={{ borderTop: 'none' }}>
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
                </details>

                {/* Footer */}
                <div style={{
                    marginTop: 'var(--space-xl)',
                    textAlign: 'center'
                }}>
                    <SystemMessage>
                        {gameState.round < gameState.maxRounds
                            ? 'NEXT ROUND IMMINENT'
                            : 'FINAL RESULTS INCOMING'}
                    </SystemMessage>
                </div>
            </div>

            {/* Rulebook Button & Modal */}
            <RulebookButton onClick={() => setShowRulebook(true)} />
            <RulebookModal
                isOpen={showRulebook}
                onClose={() => setShowRulebook(false)}
            />
        </div>
    );
}
