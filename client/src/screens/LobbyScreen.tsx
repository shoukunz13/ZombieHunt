/**
 * Zombie Hunt - Lobby Screen
 * Players wait here, see other players, and select opponents.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
    ConnectionStatus, RoleBadge, SpecialIcons, StatusBadge
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
                <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                        Loading...
                    </p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)' }}>
                        {gameState?.phase === 'waiting' ? 'Waiting Room' : `Round ${gameState?.round} • Lobby`}
                    </h2>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Your Info Panel */}
                <div className="info-panel">
                    <div className="info-row">
                        <span className="info-label">You</span>
                        <span className="info-value">{privateState.name}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Role</span>
                        <RoleBadge role={privateState.role} />
                    </div>
                    <div className="info-row">
                        <span className="info-label">Team</span>
                        <span className="info-value">Team {privateState.teamId + 1}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Cards</span>
                        <span className="info-value">{privateState.numberCards.length} cards</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Special</span>
                        <SpecialIcons
                            hasZombie={!!privateState.zombieCard}
                            hasVaccine={!!privateState.vaccineCard}
                            hasShotgun={privateState.hasShotgun}
                        />
                    </div>
                </div>

                {/* Pairing Status */}
                {isPaired ? (
                    <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))' }}>
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <StatusBadge status="paired" label="✓ Paired" />
                        </div>
                        <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                            Waiting for all players to pair up...
                        </p>
                        <button className="btn btn-secondary btn-sm" onClick={cancelSelection}>
                            Cancel Pairing
                        </button>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <span>Select Opponent</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {pairingStatus ? `${pairingStatus.pairedCount}/${pairingStatus.totalPlayers} paired` : ''}
                            </span>
                        </div>

                        {availablePlayers.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-lg)' }}>
                                {gameState?.phase === 'waiting'
                                    ? 'Waiting for more players to join...'
                                    : 'No available opponents. All paired!'}
                            </p>
                        ) : (
                            <div className="player-list">
                                {availablePlayers.map(player => (
                                    <div
                                        key={player.id}
                                        className="player-item"
                                        onClick={() => handleSelectOpponent(player.id)}
                                    >
                                        <span className="player-name">{player.name}</span>
                                        <div className="player-meta">
                                            <span>{player.numberCardCount} cards</span>
                                            {player.isConnected ? '🟢' : '🔴'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* All Players List */}
                <div className="card" style={{ marginTop: 'auto' }}>
                    <div className="card-header">
                        <span>All Players</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            {players.filter(p => p.isAlive).length} alive
                        </span>
                    </div>
                    <div className="player-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {players.map(player => (
                            <div
                                key={player.id}
                                className={`player-item disabled`}
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    opacity: player.isAlive ? 1 : 0.5
                                }}
                            >
                                <span className="player-name">
                                    {player.name}
                                    {player.id === playerId && ' (You)'}
                                </span>
                                <div className="player-meta">
                                    {player.isPaired && <StatusBadge status="paired" label="Paired" />}
                                    {!player.isAlive && <StatusBadge status="dead" label="Dead" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
