/**
 * Zombie Hunt - Host Dashboard
 * Game control panel for the host/organizer.
 */

import { useState } from 'react';
import { useHost, HostProvider } from '../context/HostContext';
import { ConnectionStatus, EventItem } from '../components/shared';

function HostDashboardContent() {
    const {
        isConnected, isAuthenticated, hostState, events, authError,
        authenticate, startGame, forcePhase, kickPlayer
    } = useHost();

    const [pin, setPin] = useState('');

    // Auth screen
    if (!isAuthenticated) {
        return (
            <div className="container">
                <div className="screen" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                        <h1 className="title">🎮 Host Dashboard</h1>
                        <p className="subtitle">Enter PIN to access</p>
                    </div>

                    <ConnectionStatus isConnected={isConnected} />

                    <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                        <form onSubmit={(e) => { e.preventDefault(); authenticate(pin); }}>
                            <input
                                type="password"
                                className="input"
                                placeholder="Enter HOST PIN..."
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                style={{ marginBottom: 'var(--spacing-md)' }}
                                autoFocus
                            />

                            {authError && (
                                <div style={{
                                    color: 'var(--accent-red)',
                                    marginBottom: 'var(--spacing-md)',
                                    textAlign: 'center'
                                }}>
                                    {authError}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!isConnected || !pin}
                            >
                                Authenticate
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // Dashboard
    return (
        <div className="container host-dashboard">
            <div className="screen">
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <h1 style={{ fontSize: 'var(--font-size-xl)' }}>🎮 Host Dashboard</h1>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Game Status */}
                <div className="host-section">
                    <h3>📊 Game Status</h3>
                    {hostState ? (
                        <>
                            <div className="stats-grid">
                                <div className="stat-box">
                                    <div className="stat-value" style={{ textTransform: 'capitalize' }}>
                                        {hostState.phase}
                                    </div>
                                    <div className="stat-label">Phase</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{hostState.round} / 20</div>
                                    <div className="stat-label">Round</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value" style={{ color: 'var(--human-blue)' }}>
                                        {hostState.humanCount}
                                    </div>
                                    <div className="stat-label">Humans</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value" style={{ color: 'var(--zombie-green)' }}>
                                        {hostState.zombieCount}
                                    </div>
                                    <div className="stat-label">Zombies</div>
                                </div>
                            </div>

                            {hostState.phaseEndsAt && (
                                <div style={{
                                    textAlign: 'center',
                                    marginTop: 'var(--spacing-md)',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Phase ends: {new Date(hostState.phaseEndsAt).toLocaleTimeString()}
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>No active game</p>
                    )}
                </div>

                {/* Controls */}
                <div className="host-section">
                    <h3>🎛️ Controls</h3>
                    <div className="host-controls">
                        <button
                            className="btn btn-success"
                            onClick={startGame}
                            disabled={!hostState || hostState.phase !== 'waiting'}
                        >
                            ▶️ Start Game
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('duel')}
                            disabled={!hostState || hostState.phase !== 'lobby'}
                        >
                            ⚔️ Force Duel
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('meeting')}
                            disabled={!hostState || hostState.phase !== 'duel'}
                        >
                            📍 Force Meeting
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('lobby')}
                            disabled={!hostState || hostState.phase !== 'meeting'}
                        >
                            🔄 Next Round
                        </button>
                    </div>
                </div>

                {/* Team Breakdown */}
                {hostState && hostState.teamBreakdown && (
                    <div className="host-section">
                        <h3>👥 Team Breakdown</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--spacing-sm)' }}>
                            {hostState.teamBreakdown.map(team => (
                                <div
                                    key={team.teamId}
                                    className="stat-box"
                                    style={{ textAlign: 'left', padding: 'var(--spacing-sm)' }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }}>
                                        Team {team.teamId + 1}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                        <span style={{ color: 'var(--human-blue)' }}>👤 {team.humans}</span>
                                        {' • '}
                                        <span style={{ color: 'var(--zombie-green)' }}>🧟 {team.zombies}</span>
                                        {' • '}
                                        <span>Alive: {team.alive}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Players */}
                {hostState && hostState.players && (
                    <div className="host-section">
                        <h3>👥 Players ({hostState.players.length})</h3>
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: 'var(--spacing-xs)' }}>Name</th>
                                        <th style={{ padding: 'var(--spacing-xs)' }}>Team</th>
                                        <th style={{ padding: 'var(--spacing-xs)' }}>Role</th>
                                        <th style={{ padding: 'var(--spacing-xs)' }}>Status</th>
                                        <th style={{ padding: 'var(--spacing-xs)' }}>Cards</th>
                                        <th style={{ padding: 'var(--spacing-xs)' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hostState.players.map(player => (
                                        <tr
                                            key={player.id}
                                            style={{
                                                opacity: player.status === 'alive' ? 1 : 0.5,
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            <td style={{ padding: 'var(--spacing-xs)' }}>
                                                {player.name}
                                                {!player.isConnected && ' 🔴'}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-xs)' }}>
                                                {player.teamId + 1}
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-xs)',
                                                color: player.role === 'zombie' ? 'var(--zombie-green)' : 'var(--human-blue)'
                                            }}>
                                                {player.role === 'zombie' ? '🧟' : '👤'}
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-xs)',
                                                color: player.status === 'alive' ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {player.status}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-xs)' }}>
                                                {player.numberCardCount}
                                                {player.hasZombieCard && ' 🧟'}
                                                {player.hasVaccine && ' 💉'}
                                                {player.hasShotgun && ' 🔫'}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-xs)' }}>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    style={{ padding: '4px 8px', minWidth: 'auto' }}
                                                    onClick={() => kickPlayer(player.id)}
                                                    disabled={player.status !== 'alive'}
                                                >
                                                    Kick
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Current Duels */}
                {hostState && hostState.duels && hostState.duels.length > 0 && (
                    <div className="host-section">
                        <h3>⚔️ Current Duels</h3>
                        <div className="player-list">
                            {hostState.duels.map(duel => (
                                <div key={duel.id} className="player-item" style={{ cursor: 'default' }}>
                                    <span>{duel.player1Name} vs {duel.player2Name}</span>
                                    <span
                                        className={`status-badge ${duel.status === 'resolved' ? 'status-alive' :
                                            duel.status === 'in_progress' ? 'status-waiting' : 'status-dead'
                                            }`}
                                    >
                                        {duel.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Events */}
                <div className="host-section">
                    <h3>📢 Event Log</h3>
                    {events.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No events yet</p>
                    ) : (
                        <div className="event-feed" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {events.slice().reverse().map(event => (
                                <EventItem key={event.id} type={event.type} message={event.message} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function HostDashboard() {
    return (
        <HostProvider>
            <HostDashboardContent />
        </HostProvider>
    );
}
