/**
 * ZOMBIE HUNT — Duel Screen
 * 
 * Design: High stakes confrontation
 * - Fullscreen countdown at top
 * - Opponent name centered
 * - Multi-card selection (up to 5 cards, same suit)
 * - DRAMATIC full-screen results for major events
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    Timer, PlayingCardComponent, SpecialCardComponent,
    RoleBadge, DisplayTitle, SystemMessage, Spinner
} from '../components/shared';
import { RulebookModal, RulebookButton } from '../components/RulebookModal';
import { ActionType, NumberCard } from '../types';
import { playDuelStartSound } from '../utils/sounds';

export function DuelScreen() {
    const navigate = useNavigate();
    const {
        privateState, gameState, currentDuel, duelResult,
        hasSubmittedAction, submitAction, isEliminated, clearDuel
    } = useGame();

    const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [showResult, setShowResult] = useState(false);
    const [showRulebook, setShowRulebook] = useState(false);

    // Handle phase changes - only navigate away if no longer in a duel
    useEffect(() => {
        if (!gameState) {
            navigate('/');
            return;
        }

        // Stay on duel screen while we have an active duel
        if (currentDuel) {
            return;
        }

        // Only navigate away if duel is complete (no currentDuel)
        if (gameState.phase === 'lobby') {
            navigate('/lobby');
        } else if (gameState.phase === 'meeting') {
            navigate('/meeting');
        } else if (gameState.phase === 'ended') {
            navigate('/end');
        }
    }, [gameState, currentDuel, navigate]);

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

    // Play duel start sound when entering duel
    const hasPlayedDuelSound = useRef(false);
    useEffect(() => {
        if (currentDuel && !hasPlayedDuelSound.current) {
            playDuelStartSound();
            hasPlayedDuelSound.current = true;
        }
    }, [currentDuel]);

    // Calculate selected cards sum and suit
    const selectedCardsInfo = useMemo(() => {
        if (!privateState || selectedCardIds.length === 0) {
            return { sum: 0, suit: null, cards: [] };
        }

        const cards = selectedCardIds
            .map(id => privateState.numberCards.find(c => c.id === id))
            .filter((c): c is NumberCard => c !== undefined);

        const sum = cards.reduce((acc, c) => acc + c.value, 0);
        const suit = cards.length > 0 ? cards[0].suit : null;

        return { sum, suit, cards };
    }, [privateState, selectedCardIds]);

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

    const handleCardClick = (card: NumberCard) => {
        if (selectedCardIds.includes(card.id)) {
            // Deselect
            setSelectedCardIds(prev => prev.filter(id => id !== card.id));
            if (selectedCardIds.length === 1) {
                setSelectedAction(null);
            }
        } else {
            // Select - check constraints
            if (selectedCardIds.length >= 5) {
                return; // Max 5 cards
            }

            // Must be same suit if other cards selected
            if (selectedCardsInfo.suit && card.suit !== selectedCardsInfo.suit) {
                return; // Different suit
            }

            setSelectedCardIds(prev => [...prev, card.id]);
            setSelectedAction('number');
        }
    };

    const handleConfirm = () => {
        console.log('[handleConfirm] Called with:', { selectedAction, selectedCardIds, currentDuel });
        if (!selectedAction) {
            console.log('[handleConfirm] No selectedAction, returning');
            return;
        }

        if (selectedAction === 'number' && selectedCardIds.length > 0) {
            console.log('[handleConfirm] Submitting number action with cards:', selectedCardIds);
            submitAction('number', selectedCardIds[0], selectedCardIds);
        } else if (selectedAction !== 'number') {
            console.log('[handleConfirm] Submitting special action:', selectedAction);
            submitAction(selectedAction);
        }

        setSelectedAction(null);
        setSelectedCardIds([]);
    };

    const handleSpecialAction = (action: ActionType) => {
        if (selectedAction === action) {
            setSelectedAction(null);
        } else {
            setSelectedAction(action);
            setSelectedCardIds([]); // Clear card selection when selecting special
        }
    };

    const handleCloseResult = () => {
        setShowResult(false);
        clearDuel(); // Clear duel state so navigation can proceed
    };

    const canConfirm = selectedAction && (selectedAction !== 'number' || selectedCardIds.length > 0);

    // Check if a card can be selected (must be same suit as already selected)
    const canSelectCard = (card: NumberCard): boolean => {
        if (selectedCardIds.length >= 5) return false;
        if (selectedCardIds.length === 0) return true;
        return card.suit === selectedCardsInfo.suit;
    };

    // Determine result overlay type
    const getResultOverlayClass = () => {
        if (!duelResult) return '';
        if (duelResult.infected) return 'infected';
        if (duelResult.youEliminated) return 'eliminated';
        if (duelResult.cured) return 'cured';
        if (duelResult.shotgunUsed && duelResult.shotgunResult === 'killed_zombie') return 'shotgun-kill victory';
        if (duelResult.outcome === 'win') return 'victory';
        if (duelResult.outcome === 'lose') return 'defeat';
        return '';
    };

    const getResultIcon = () => {
        if (!duelResult) return '';
        if (duelResult.infected) return '☠';
        if (duelResult.youEliminated) return '✕';
        if (duelResult.cured) return '✚';
        if (duelResult.shotgunUsed && duelResult.shotgunResult === 'killed_zombie') return '×';
        if (duelResult.outcome === 'win') return '▲';
        if (duelResult.outcome === 'lose') return '▼';
        return '●';
    };

    const getResultTitle = () => {
        if (!duelResult) return '';
        if (duelResult.infected) return 'INFECTED';
        if (duelResult.youEliminated) return 'ELIMINATED';
        if (duelResult.cured) return 'CURED';
        if (duelResult.shotgunUsed && duelResult.shotgunResult === 'killed_zombie') return 'TARGET DOWN';
        if (duelResult.outcome === 'win') return 'VICTORY';
        if (duelResult.outcome === 'lose') return 'DEFEAT';
        return 'DRAW';
    };

    const getResultSubtitle = () => {
        if (!duelResult) return '';
        if (duelResult.infected) return 'YOU HAVE BECOME ONE OF THEM';
        if (duelResult.youEliminated) return 'YOUR GAME IS OVER';
        if (duelResult.cured) return 'THE INFECTION HAS BEEN PURGED';
        if (duelResult.shotgunUsed && duelResult.shotgunResult === 'killed_zombie') return 'THREAT NEUTRALIZED';
        if (duelResult.shotgunUsed && duelResult.shotgunResult === 'wasted_on_human') return 'WRONG TARGET — WASTED SHOT';
        return '';
    };

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
                                        onClick={() => handleSpecialAction('zombie')}
                                    />
                                )}
                                {privateState.vaccineCard && (
                                    <SpecialCardComponent
                                        type="vaccine"
                                        selected={selectedAction === 'vaccine'}
                                        onClick={() => handleSpecialAction('vaccine')}
                                    />
                                )}
                                {privateState.hasShotgun && (
                                    <SpecialCardComponent
                                        type="shotgun"
                                        selected={selectedAction === 'shotgun'}
                                        onClick={() => handleSpecialAction('shotgun')}
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
                                <span>
                                    {selectedCardIds.length > 0 ? (
                                        <span style={{ color: 'var(--accent-red)' }}>
                                            {selectedCardIds.length} SELECTED = {selectedCardsInfo.sum}
                                        </span>
                                    ) : (
                                        privateState.numberCards.length
                                    )}
                                </span>
                            </div>
                            <p className="text-system mb-sm" style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-muted)'
                            }}>
                                SELECT UP TO 5 CARDS — SAME SUIT ONLY
                            </p>
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
                                            selected={selectedCardIds.includes(card.id)}
                                            disabled={!canSelectCard(card) && !selectedCardIds.includes(card.id)}
                                            onClick={() => handleCardClick(card)}
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
                                            selectedCardIds.length > 0 ? `PLAY ${selectedCardIds.length} CARD${selectedCardIds.length > 1 ? 'S' : ''} (${selectedCardsInfo.sum})` : 'SELECT ACTION'}
                            </button>
                        </div>
                    </>
                )}

                {/* DRAMATIC RESULT OVERLAY */}
                {showResult && duelResult && (
                    <div className={`result-overlay ${getResultOverlayClass()}`} onClick={handleCloseResult}>
                        <div className="result-content">
                            {/* Large Icon */}
                            <div className="result-icon">
                                {getResultIcon()}
                            </div>

                            {/* Title with glitch effect for dramatic results */}
                            <h1
                                className={`result-title ${duelResult.infected || duelResult.youEliminated ? 'glitch-text' : ''}`}
                                data-text={getResultTitle()}
                            >
                                {getResultTitle()}
                            </h1>

                            {/* Subtitle */}
                            {getResultSubtitle() && (
                                <p className="result-subtitle">
                                    {getResultSubtitle()}
                                </p>
                            )}

                            {/* Additional Details */}
                            <div className="result-details">
                                {duelResult.cardStolen && (
                                    <p className="result-detail-item success">
                                        ► CARD ACQUIRED FROM OPPONENT
                                    </p>
                                )}

                                {duelResult.cardLost && (
                                    <p className="result-detail-item danger">
                                        ► CARD LOST TO OPPONENT
                                    </p>
                                )}

                                {duelResult.opponentEliminated && (
                                    <p className="result-detail-item success">
                                        ► OPPONENT ELIMINATED
                                    </p>
                                )}

                                {duelResult.shotgunUsed && duelResult.shotgunResult === 'wasted_on_human' && (
                                    <p className="result-detail-item danger">
                                        ► SHOTGUN WASTED — TARGET WAS HUMAN
                                    </p>
                                )}
                            </div>

                            {/* Continue Button */}
                            <button
                                className="btn btn-secondary btn-block"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseResult();
                                }}
                            >
                                CONTINUE
                            </button>

                            <p className="text-system mt-lg" style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-muted)'
                            }}>
                                TAP ANYWHERE TO DISMISS
                            </p>
                        </div>
                    </div>
                )}

                {/* Rulebook Button & Modal */}
                <RulebookButton onClick={() => setShowRulebook(true)} />
                <RulebookModal
                    isOpen={showRulebook}
                    onClose={() => setShowRulebook(false)}
                />
            </div>
        </div>
    );
}
