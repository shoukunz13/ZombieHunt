/**
 * ZOMBIE HUNT — Lobby Screen
 * 
 * Design: Tense waiting room atmosphere
 * - Show invite states (sent invite, received invite)
 * - Click player name to send invite
 * - Accept incoming invite to start duel
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    ConnectionStatus, RoleBadge, SystemMessage, SpecialIcons
} from '../components/shared';
import { RulebookModal, RulebookButton } from '../components/RulebookModal';
import { GameStartAlert } from '../components/GameStartAlert';

export function LobbyScreen() {
    const navigate = useNavigate();
    const {
        isConnected, privateState, gameState, players, playerId,
        pairingStatus, selectOpponent, cancelSelection, declineInvite, currentDuel,
        isEliminated, leaveGame
    } = useGame();

    // State for modals/alerts
    const [showRulebook, setShowRulebook] = useState(false);
    const [showGameStart, setShowGameStart] = useState(false);
    const prevPhaseRef = useRef<string | null>(null);

    // Handle phase changes
    useEffect(() => {
        console.log('[LobbyScreen] Navigation check:', {
            gameState: gameState?.phase,
            currentDuel: !!currentDuel
        });

        if (!gameState) {
            navigate('/');
            return;
        }

        const lobbyCode = gameState.gameCode;

        // Navigate to duel when assigned
        if (currentDuel) {
            console.log('[LobbyScreen] Navigating to duel');
            navigate(`/game/${lobbyCode}/duel`);
        } else if (gameState.phase === 'meeting') {
            console.log('[LobbyScreen] Navigating to meeting');
            navigate(`/game/${lobbyCode}/meeting`);
        } else if (gameState.phase === 'ended') {
            console.log('[LobbyScreen] Navigating to end');
            navigate(`/game/${lobbyCode}/end`);
        }
    }, [gameState, currentDuel, navigate]);

    useEffect(() => {
        if (isEliminated && gameState) {
            navigate(`/game/${gameState.gameCode}/eliminated`);
        }
    }, [isEliminated, gameState, navigate]);

    // Detect game start (transition from 'intro' to 'lobby', after host video completes)
    useEffect(() => {
        if (prevPhaseRef.current === 'intro' && gameState?.phase === 'lobby') {
            setShowGameStart(true);
        }
        prevPhaseRef.current = gameState?.phase || null;
    }, [gameState?.phase]);

    // Show intro waiting screen when in intro phase
    if (gameState?.phase === 'intro') {
        return (
            <div className="container">
                <div className="screen screen-centered">
                    <div style={{ textAlign: 'center' }}>
                        <h1 className="heading-display" style={{
                            fontSize: 'var(--font-size-3xl)',
                            marginBottom: 'var(--space-xl)'
                        }}>
                            GAME STARTING
                        </h1>
                        <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
                            PLEASE WATCH THE SCREEN
                        </p>
                        <div className="spinner" />
                    </div>
                </div>
            </div>
        );
    }

    if (!privateState || !gameState) {
        return (
            <div className="container">
                <div className="screen screen-centered">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    // Find current player in list
    const currentPlayerPublic = players.find(p => p.id === playerId);
    const hasOutgoingInvite = currentPlayerPublic?.hasOutgoingInvite || false;
    const incomingInviteFromId = currentPlayerPublic?.incomingInviteFromId || null;
    const isInDuel = currentPlayerPublic?.isInDuel || false;
    const isPaired = currentPlayerPublic?.isPaired || false;
    const hasCompletedDuel = isPaired && !isInDuel && !hasOutgoingInvite;

    // Find the player who invited us
    const inviterPlayer = incomingInviteFromId ? players.find(p => p.id === incomingInviteFromId) : null;

    // Find who we invited
    const invitedPlayer = hasOutgoingInvite
        ? players.find(p => p.incomingInviteFromId === playerId)
        : null;

    // Available opponents (alive, not in duel, not busy, not self)
    const availablePlayers = players.filter(p =>
        p.id !== playerId &&
        p.isAlive &&
        !p.isPaired &&
        !p.isInDuel &&
        !p.hasOutgoingInvite
    );

    const handleSelectOpponent = (opponentId: string) => {
        if (!hasOutgoingInvite && !incomingInviteFromId && !isInDuel && !hasCompletedDuel) {
            selectOpponent(opponentId);
        }
    };

    const handleAcceptInvite = () => {
        if (incomingInviteFromId) {
            selectOpponent(incomingInviteFromId);
        }
    };

    const handleDeclineInvite = () => {
        if (incomingInviteFromId) {
            declineInvite(incomingInviteFromId);
        }
    };

    return (
        <div className="container">
            <div className="screen">
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <div>
                        <h2 className="heading-display" style={{ fontSize: 'var(--font-size-xl)' }}>
                            {gameState?.phase === 'waiting' ? 'WAITING ROOM' : `ROUND ${gameState?.round}`}
                        </h2>
                        <SystemMessage>
                            {gameState?.phase === 'waiting' ? 'STANDBY FOR ORDERS' : 'SELECT YOUR TARGET'}
                        </SystemMessage>
                    </div>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Your Status Panel */}
                <div className="info-panel" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="info-row">
                        <span className="info-label">DESIGNATION</span>
                        <span className="info-value">{privateState.name}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">STATUS</span>
                        <RoleBadge role={privateState.role} />
                    </div>
                    <div className="info-row">
                        <span className="info-label">TEAM</span>
                        <span className="info-value">{privateState.teamId + 1}</span>
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

                {/* INCOMING INVITE - Show prominently */}
                {incomingInviteFromId && inviterPlayer && (
                    <div className="card" style={{
                        textAlign: 'center',
                        borderColor: 'var(--accent-red)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-lg)',
                            color: 'var(--accent-red)',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            DUEL REQUEST
                        </p>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-2xl)',
                            marginBottom: 'var(--space-md)'
                        }}>
                            {inviterPlayer.name}
                        </p>
                        <SystemMessage>CHALLENGES YOU TO DUEL</SystemMessage>
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-md)',
                            marginTop: 'var(--space-lg)',
                            justifyContent: 'center'
                        }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleAcceptInvite}
                            >
                                ACCEPT
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleDeclineInvite}
                            >
                                DECLINE
                            </button>
                        </div>
                    </div>
                )}

                {/* OUTGOING INVITE - Waiting for response */}
                {hasOutgoingInvite && !incomingInviteFromId && (
                    <div className="card" style={{
                        textAlign: 'center',
                        borderColor: 'var(--text-muted)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-lg)',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            INVITE SENT
                        </p>
                        {invitedPlayer && (
                            <p className="heading-display" style={{
                                fontSize: 'var(--font-size-2xl)',
                                marginBottom: 'var(--space-md)'
                            }}>
                                {invitedPlayer.name}
                            </p>
                        )}
                        <SystemMessage>AWAITING RESPONSE</SystemMessage>
                        <div className="spinner" style={{ margin: 'var(--space-lg) auto' }} />
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={cancelSelection}
                        >
                            CANCEL INVITE
                        </button>
                    </div>
                )}

                {/* COMPLETED DUEL - Waiting for others */}
                {hasCompletedDuel && (
                    <div className="card" style={{
                        textAlign: 'center',
                        borderColor: 'var(--text-muted)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-lg)',
                            marginBottom: 'var(--space-md)'
                        }}>
                            DUEL COMPLETE
                        </p>
                        <SystemMessage>AWAITING OTHER PARTICIPANTS</SystemMessage>
                        <div className="spinner" style={{ margin: 'var(--space-lg) auto' }} />
                    </div>
                )}

                {/* OPPONENT SELECTION - Only show if not in other states */}
                {!hasOutgoingInvite && !incomingInviteFromId && !hasCompletedDuel && !isInDuel && (
                    <div className="card">
                        <div className="card-header">
                            <span>SELECT TARGET</span>
                            <span style={{ color: 'var(--accent-red)' }}>
                                {pairingStatus ? `${pairingStatus.pairedCount}/${pairingStatus.totalPlayers}` : ''}
                            </span>
                        </div>

                        {availablePlayers.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-xl)'
                            }}>
                                {gameState?.phase === 'waiting' ? (
                                    <SystemMessage>AWAITING PARTICIPANTS</SystemMessage>
                                ) : (
                                    <>
                                        <p className="heading-display" style={{
                                            fontSize: 'var(--font-size-xl)',
                                            color: 'var(--accent-green)',
                                            marginBottom: 'var(--space-md)'
                                        }}>
                                            ✓ SAFE THIS ROUND
                                        </p>
                                        <SystemMessage>ALL TARGETS UNAVAILABLE</SystemMessage>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="player-list">
                                {availablePlayers.map(player => (
                                    <div
                                        key={player.id}
                                        className="player-item"
                                        onClick={() => handleSelectOpponent(player.id)}
                                    >
                                        <span className="player-name">{player.name}</span>
                                        <span className="player-status">
                                            STATS HIDDEN
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Game Info */}
                {gameState?.phase === 'waiting' && (
                    <div style={{
                        marginTop: 'var(--space-xl)',
                        textAlign: 'center'
                    }}>
                        <SystemMessage>
                            {players.filter(p => p.isAlive).length} PARTICIPANTS CONNECTED
                        </SystemMessage>
                        <button
                            className="btn btn-secondary"
                            onClick={leaveGame}
                            style={{ marginTop: 'var(--space-lg)' }}
                        >
                            LEAVE GAME
                        </button>
                    </div>
                )}
            </div>

            {/* Rulebook Button & Modal */}
            <RulebookButton onClick={() => setShowRulebook(true)} />
            <RulebookModal
                isOpen={showRulebook}
                onClose={() => setShowRulebook(false)}
            />


            {/* Game Start Alert */}
            {showGameStart && privateState && (
                <GameStartAlert
                    round={gameState?.round || 1}
                    role={privateState.role as 'human' | 'zombie'}
                    onComplete={() => setShowGameStart(false)}
                />
            )}
        </div>
    );
}
