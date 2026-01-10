/**
 * ZOMBIE HUNT — Duel Screen
 * 
 * Design: High stakes confrontation
 * - Fullscreen countdown at top
 * - Opponent name centered
 * - Card grid with red highlights
 * - Desaturated screen when locked
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    Timer, PlayingCardComponent, SpecialCardComponent,
    RoleBadge, Modal, DisplayTitle, SystemMessage, Spinner
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
                <div className="screen screen-centered">
                    <Spinner />
                    <SystemMessage>AWAITING ASSIGNMENT</SystemMessage>
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

        setSelectedAction(null);
        setSelectedCardId(null);
    };

    const canConfirm = selectedAction && (selectedAction !== 'number' || selectedCardId);

    return (
        <div className={`container ${hasSubmittedAction ? 'desaturated' : ''}`}>
            <div className="screen">
                {/* Header with Timer */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <SystemMessage>ROUND {gameState?.round}</SystemMessage>
                    {gameState?.phaseEndsAt && <Timer endsAt={gameState.phaseEndsAt} />}
                </div>

                {/* Opponent */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 'var(--space-xl)',
                    padding: 'var(--space-lg)',
                    border: '1px solid var(--border-muted)'
                }}>
                    <SystemMessage>OPPONENT</SystemMessage>
                    <DisplayTitle size="2xl">{currentDuel.opponent.name}</DisplayTitle>
                    <p className="text-system mt-sm" style={{ color: 'var(--text-muted)' }}>
                        {currentDuel.opponent.numberCardCount} CARDS REMAINING
                    </p>
                </div>

                {/* Your Role */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                    <RoleBadge role={privateState.role} />
                </div>

                {/* Action Area */}
                {hasSubmittedAction ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                    }}>
                        <DisplayTitle size="xl">ACTION LOCKED</DisplayTitle>
                        <SystemMessage>AWAITING OPPONENT</SystemMessage>
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <Spinner />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Special Cards */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <p className="text-system mb-sm" style={{ fontSize: 'var(--font-size-xs)' }}>
                                SPECIAL ACTIONS
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-sm)',
                                justifyContent: 'center'
                            }}>
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
                                    <span className="text-muted">NO SPECIAL CARDS</span>
                                )}
                            </div>
                        </div>

                        {/* Number Cards */}
                        <div className="card" style={{ flex: 1 }}>
                            <div className="card-header">
                                <span>YOUR HAND</span>
                                <span>{privateState.numberCards.length}</span>
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
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <SystemMessage>YOUR ACTION IS FINAL</SystemMessage>
                            <button
                                className="btn btn-primary btn-block mt-md"
                                disabled={!canConfirm}
                                onClick={handleConfirm}
                            >
                                {selectedAction === 'shotgun' ? 'FIRE SHOTGUN' :
                                    selectedAction === 'vaccine' ? 'ADMINISTER CURE' :
                                        selectedAction === 'zombie' ? 'INFECT TARGET' :
                                            selectedCardId ? 'CONFIRM PLAY' : 'SELECT ACTION'}
                            </button>
                        </div>
                    </>
                )}

                {/* Result Modal */}
                {showResult && duelResult && (
                    <Modal title="DUEL RESULT" onClose={() => setShowResult(false)}>
                        <div style={{ textAlign: 'center' }}>
                            <DisplayTitle size="2xl">
                                {duelResult.outcome === 'win' ? 'VICTORY' :
                                    duelResult.outcome === 'lose' ? 'DEFEAT' : 'DRAW'}
                            </DisplayTitle>

                            <div style={{
                                marginTop: 'var(--space-lg)',
                                textAlign: 'left'
                            }}>
                                {duelResult.infected && (
                                    <p className="text-system text-red mb-sm">
                                        ► YOU HAVE BEEN INFECTED
                                    </p>
                                )}

                                {duelResult.cured && (
                                    <p className="text-system mb-sm">
                                        ► YOU HAVE BEEN CURED
                                    </p>
                                )}

                                {duelResult.shotgunUsed && (
                                    <p className={`text-system mb-sm ${duelResult.shotgunResult === 'killed_zombie' ? '' : 'text-red'}`}>
                                        {duelResult.shotgunResult === 'killed_zombie'
                                            ? '► TARGET ELIMINATED'
                                            : '► SHOT MISSED — TARGET WAS HUMAN'}
                                    </p>
                                )}

                                {duelResult.cardStolen && (
                                    <p className="text-system mb-sm">
                                        ► CARD ACQUIRED FROM OPPONENT
                                    </p>
                                )}

                                {duelResult.cardLost && (
                                    <p className="text-system text-red mb-sm">
                                        ► CARD LOST TO OPPONENT
                                    </p>
                                )}

                                {duelResult.opponentEliminated && (
                                    <p className="text-system mb-sm">
                                        ► OPPONENT ELIMINATED
                                    </p>
                                )}
                            </div>

                            <button
                                className="btn btn-secondary btn-block mt-lg"
                                onClick={() => setShowResult(false)}
                            >
                                CONTINUE
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}
