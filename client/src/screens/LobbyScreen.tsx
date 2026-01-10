/**
 * ZOMBIE HUNT — Lobby Screen
 * 
 * Design: Tense, silent atmosphere
 * - Vertical player list
 * - Selected opponent turns RED
 * - Status text emphasizing distrust
 * - No timers, emphasize tension
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    ConnectionStatus, RoleBadge, SpecialIcons, StatusBadge,
    SystemMessage
} from '../components/shared';

export function LobbyScreen() {
    const navigate = useNavigate();
    const {
        isConnected, playerId, privateState, gameState,
        players, pairingStatus, selectOpponent, cancelSelection,
        isEliminated
    } = useGame();

    // Handle phase changes
    useEffect(() => {
        if (!gameState) {
            navigate('/');
            return;
        }

        if (gameState.phase === 'duel') {
            navigate('/duel');
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

    if (!privateState) {
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
    const isPaired = currentPlayerPublic?.isPaired || false;

    // Available opponents (alive, not paired, not self)
    const availablePlayers = players.filter(p =>
        p.id !== playerId &&
        p.isAlive &&
        !p.isPaired
    );

    const handleSelectOpponent = (opponentId: string) => {
        if (!isPaired) {
            selectOpponent(opponentId);
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
                            {gameState?.phase === 'waiting' ? 'STANDBY FOR ORDERS' : 'DISCUSSION PHASE'}
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

                {/* Pairing Status */}
                {isPaired ? (
                    <div className="card" style={{
                        textAlign: 'center',
                        borderColor: 'var(--accent-red)'
                    }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-lg)',
                            color: 'var(--accent-red)',
                            marginBottom: 'var(--space-md)'
                        }}>
                            OPPONENT LOCKED
                        </p>
                        <SystemMessage>AWAITING ALL PARTICIPANTS</SystemMessage>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={cancelSelection}
                            style={{ marginTop: 'var(--space-lg)' }}
                        >
                            CANCEL
                        </button>
                    </div>
                ) : (
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
                                <SystemMessage>
                                    {gameState?.phase === 'waiting'
                                        ? 'AWAITING PARTICIPANTS'
                                        : 'NO TARGETS AVAILABLE'}
                                </SystemMessage>
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
                                            {player.numberCardCount} CARDS
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* All Players */}
                <div className="card" style={{ marginTop: 'auto' }}>
                    <div className="card-header">
                        <span>ALL PARTICIPANTS</span>
                        <span>{players.filter(p => p.isAlive).length} ALIVE</span>
                    </div>
                    <div className="player-list" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                        {players.map(player => (
                            <div
                                key={player.id}
                                className={`player-item disabled`}
                                style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    opacity: player.isAlive ? 1 : 0.3
                                }}
                            >
                                <span className="player-name">
                                    {player.name}
                                    {player.id === playerId && ' [YOU]'}
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    {player.isPaired && <StatusBadge status="paired" label="PAIRED" />}
                                    {!player.isAlive && <StatusBadge status="dead" label="DEAD" />}
                                    {!player.isConnected && player.isAlive && (
                                        <span className="status-dot disconnected" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Warning */}
                <div style={{
                    marginTop: 'var(--space-lg)',
                    textAlign: 'center'
                }}>
                    <SystemMessage>TRUST NO ONE</SystemMessage>
                </div>
            </div>
        </div>
    );
}
