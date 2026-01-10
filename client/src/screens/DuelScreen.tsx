/**
 * Zombie Hunt - Duel Screen
 * Players select and play cards during the duel phase.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    Timer, PlayingCardComponent, SpecialCardComponent,
    RoleBadge, Modal
} from '../components/shared';
import { ActionType } from '../types';

export function DuelScreen() {
    const navigate = useNavigate();
    const {
        privateState, gameState, currentDuel, duelResult,
        hasSubmittedAction, submitAction, isEliminated
    } = useGame();

    const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);

    // Handle phase changes
    useEffect(() => {
        if (!gameState) {
            navigate('/');
            return;
        }

        if (gameState.phase === 'lobby') {
            navigate('/lobby');
        } else if (gameState.phase === 'meeting') {
            navigate('/meeting');
        } else if (gameState.phase === 'ended') {
            navigate('/end');
        }
    }, [gameState, navigate]);

    useEffect(() => {
        if (isEliminated) {
            navigate('/eliminated');
        }
    }, [isEliminated, navigate]);

    // Show result modal when duel resolves
    useEffect(() => {
        if (duelResult) {
            setShowResult(true);
        }
    }, [duelResult]);

    if (!privateState || !currentDuel) {
        return (
            <div className="container">
                <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                        Waiting for duel assignment...
                    </p>
                </div>
            </div>
        );
    }

    const handleConfirm = () => {
        if (!selectedAction) return;

        if (selectedAction === 'number' && selectedCardId) {
            submitAction('number', selectedCardId);
        } else if (selectedAction !== 'number') {
            submitAction(selectedAction);
        }

        // Reset selection
        setSelectedAction(null);
        setSelectedCardId(null);
    };

    const canConfirm = selectedAction && (selectedAction !== 'number' || selectedCardId);

    return (
        <div className="container">
            <div className="screen">
                {/* Header with Timer */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
                        Round {gameState?.round} • Duel
                    </h2>
                    {gameState?.phaseEndsAt && <Timer endsAt={gameState.phaseEndsAt} />}
                </div>

                {/* Opponent Info */}
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                        Dueling against
                    </p>
                    <h3 style={{ fontSize: 'var(--font-size-xl)' }}>
                        {currentDuel.opponent.name}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                        {currentDuel.opponent.numberCardCount} cards
                    </p>
                </div>

                {/* Your Role */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <RoleBadge role={privateState.role} />
                </div>

                {/* Action Status */}
                {hasSubmittedAction ? (
                    <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(34, 197, 94, 0.2))' }}>
                        <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
                            ✓ Action Submitted
                        </p>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Waiting for opponent...
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Special Cards */}
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <p style={{
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-sm)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                Special Actions
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center' }}>
                                {privateState.zombieCard && (
                                    <SpecialCardComponent
                                        type="zombie"
                                        selected={selectedAction === 'zombie'}
                                        onClick={() => {
                                            setSelectedAction(selectedAction === 'zombie' ? null : 'zombie');
                                            setSelectedCardId(null);
                                        }}
                                    />
                                )}
                                {privateState.vaccineCard && (
                                    <SpecialCardComponent
                                        type="vaccine"
                                        selected={selectedAction === 'vaccine'}
                                        onClick={() => {
                                            setSelectedAction(selectedAction === 'vaccine' ? null : 'vaccine');
                                            setSelectedCardId(null);
                                        }}
                                    />
                                )}
                                {privateState.hasShotgun && (
                                    <SpecialCardComponent
                                        type="shotgun"
                                        selected={selectedAction === 'shotgun'}
                                        onClick={() => {
                                            setSelectedAction(selectedAction === 'shotgun' ? null : 'shotgun');
                                            setSelectedCardId(null);
                                        }}
                                    />
                                )}
                                {!privateState.zombieCard && !privateState.vaccineCard && !privateState.hasShotgun && (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        No special cards
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Number Cards */}
                        <div className="card">
                            <div className="card-header">
                                <span>Your Cards</span>
                                <span
                                    style={{
                                        color: selectedAction === 'number' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                >
                                    {selectedAction === 'number' ? 'Select a card' : 'Tap to select'}
                                </span>
                            </div>
                            <div className="card-hand">
                                {privateState.numberCards
                                    .sort((a, b) => {
                                        // Sort by suit then value
                                        if (a.suit !== b.suit) {
                                            return a.suit.localeCompare(b.suit);
                                        }
                                        return a.value - b.value;
                                    })
                                    .map(card => (
                                        <PlayingCardComponent
                                            key={card.id}
                                            card={card}
                                            selected={selectedCardId === card.id}
                                            onClick={() => {
                                                if (selectedCardId === card.id) {
                                                    setSelectedCardId(null);
                                                    setSelectedAction(null);
                                                } else {
                                                    setSelectedCardId(card.id);
                                                    setSelectedAction('number');
                                                }
                                            }}
                                        />
                                    ))}
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <button
                            className="btn btn-primary"
                            disabled={!canConfirm}
                            onClick={handleConfirm}
                            style={{ marginTop: 'var(--spacing-md)' }}
                        >
                            {selectedAction === 'shotgun' ? '🔫 Use Shotgun' :
                                selectedAction === 'vaccine' ? '💉 Use Vaccine' :
                                    selectedAction === 'zombie' ? '🧟 Play Zombie Card' :
                                        selectedCardId ? 'Confirm Play' : 'Select an Action'}
                        </button>
                    </>
                )}

                {/* Result Modal */}
                {showResult && duelResult && (
                    <Modal title="Duel Result" onClose={() => setShowResult(false)}>
                        <div className="duel-result">
                            <div className={`outcome ${duelResult.outcome}`}>
                                {duelResult.outcome === 'win' ? '🏆 Victory!' :
                                    duelResult.outcome === 'lose' ? '💀 Defeat' : '🤝 Draw'}
                            </div>

                            {duelResult.infected && (
                                <p style={{ color: 'var(--zombie-green)', marginBottom: 'var(--spacing-sm)' }}>
                                    🦠 You were infected! You are now a zombie.
                                </p>
                            )}

                            {duelResult.cured && (
                                <p style={{ color: 'var(--accent-purple)', marginBottom: 'var(--spacing-sm)' }}>
                                    💊 You were cured! You are now human.
                                </p>
                            )}

                            {duelResult.shotgunUsed && (
                                <p style={{
                                    color: duelResult.shotgunResult === 'killed_zombie' ? 'var(--success)' : 'var(--warning)',
                                    marginBottom: 'var(--spacing-sm)'
                                }}>
                                    {duelResult.shotgunResult === 'killed_zombie'
                                        ? '🔫 You killed a zombie!'
                                        : '🔫 Your shot missed... opponent was human.'}
                                </p>
                            )}

                            {duelResult.cardStolen && (
                                <p style={{ color: 'var(--accent-green)', marginBottom: 'var(--spacing-sm)' }}>
                                    📥 You stole a card from your opponent!
                                </p>
                            )}

                            {duelResult.cardLost && (
                                <p style={{ color: 'var(--accent-red)', marginBottom: 'var(--spacing-sm)' }}>
                                    📤 You lost a card to your opponent.
                                </p>
                            )}

                            {duelResult.opponentEliminated && (
                                <p style={{ color: 'var(--success)', marginBottom: 'var(--spacing-sm)' }}>
                                    ☠️ Your opponent was eliminated!
                                </p>
                            )}

                            <button
                                className="btn btn-primary"
                                onClick={() => setShowResult(false)}
                                style={{ marginTop: 'var(--spacing-md)' }}
                            >
                                Continue
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}
