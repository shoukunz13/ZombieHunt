/**
 * ZOMBIE HUNT — Host Dashboard
 * 
 * Design: Cinematic control panel
 * - Same color palette as player screens
 * - Larger typography for TV/projector
 * - Emphasize phase changes
 * - Ceremonial endgame reveal
 */

import { useState } from 'react';
import { useHost, HostProvider } from '../context/HostContext';
import { ConnectionStatus, EventItem, DisplayTitle, SystemMessage } from '../components/shared';

function HostDashboardContent() {
    const {
        isConnected, isAuthenticated, hostState, events, authError,
        currentGameCode, authenticate, createGame, startGame, forcePhase, kickPlayer, endGame
    } = useHost();

    const [pin, setPin] = useState('');
    const [newGameCode, setNewGameCode] = useState('');

    // Auth screen
    if (!isAuthenticated) {
        return (
            <div className="container">
                <div className="screen screen-centered">
                    <div style={{ marginBottom: 'var(--space-3xl)' }}>
                        <DisplayTitle size="3xl">HOST</DisplayTitle>
                        <DisplayTitle size="3xl">CONTROL</DisplayTitle>
                    </div>

                    <SystemMessage>AUTHENTICATION REQUIRED</SystemMessage>

                    <ConnectionStatus isConnected={isConnected} />

                    <form
                        onSubmit={(e) => { e.preventDefault(); authenticate(pin); }}
                        style={{
                            width: '100%',
                            maxWidth: '280px',
                            marginTop: 'var(--space-xl)'
                        }}
                    >
                        <input
                            type="password"
                            className="input"
                            placeholder="ENTER PIN_"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            style={{ marginBottom: 'var(--space-md)' }}
                            autoFocus
                        />

                        {authError && (
                            <div style={{
                                marginBottom: 'var(--space-md)',
                                padding: 'var(--space-md)',
                                border: '1px solid var(--accent-red)'
                            }}>
                                <span className="text-system text-red">{authError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={!isConnected || !pin}
                        >
                            AUTHENTICATE
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const handleCreateGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (newGameCode.trim()) {
            createGame(newGameCode.trim());
            setNewGameCode('');
        }
    };

    // Dashboard
    return (
        <div className="container host-dashboard">
            <div className="screen">
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <div>
                        <h1 className="heading-display" style={{ fontSize: 'var(--font-size-2xl)' }}>
                            HOST CONTROL
                        </h1>
                        <SystemMessage>GAME MASTER INTERFACE</SystemMessage>
                    </div>
                    <ConnectionStatus isConnected={isConnected} />
                </div>

                {/* Game Session */}
                <div className="host-section">
                    <h3>GAME SESSION</h3>
                    {currentGameCode ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl)',
                            border: '2px solid var(--accent-red)',
                            marginBottom: 'var(--space-md)'
                        }}>
                            <SystemMessage>ACCESS CODE</SystemMessage>
                            <p className="heading-display" style={{
                                fontSize: 'var(--font-size-4xl)',
                                letterSpacing: '0.2em',
                                color: 'var(--accent-red)'
                            }}>
                                {currentGameCode}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl)',
                            border: '1px solid var(--border-muted)'
                        }}>
                            <SystemMessage>NO ACTIVE GAME</SystemMessage>
                        </div>
                    )}

                    <form onSubmit={handleCreateGame}>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="NEW GAME CODE_"
                                value={newGameCode}
                                onChange={(e) => setNewGameCode(e.target.value.toUpperCase())}
                                style={{ flex: 1 }}
                                maxLength={12}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!newGameCode.trim()}
                            >
                                {currentGameCode ? 'RESET' : 'CREATE'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Game Status */}
                <div className="host-section">
                    <h3>STATUS</h3>
                    {hostState ? (
                        <>
                            <div className="stats-grid">
                                <div className="stat-box">
                                    <div className="stat-value" style={{ textTransform: 'uppercase' }}>
                                        {hostState.phase}
                                    </div>
                                    <div className="stat-label">PHASE</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{hostState.round}/20</div>
                                    <div className="stat-label">ROUND</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">{hostState.humanCount}</div>
                                    <div className="stat-label">SURVIVORS</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                        {hostState.zombieCount}
                                    </div>
                                    <div className="stat-label">INFECTED</div>
                                </div>
                            </div>

                            {hostState.phaseEndsAt && (
                                <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
                                    <span className="text-system text-muted">
                                        ENDS: {new Date(hostState.phaseEndsAt).toLocaleTimeString()}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="stat-box">
                            <SystemMessage>AWAITING GAME START</SystemMessage>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="host-section">
                    <h3>CONTROLS</h3>
                    <div className="host-controls">
                        <button
                            className="btn btn-primary"
                            onClick={startGame}
                            disabled={!hostState || hostState.phase !== 'waiting'}
                        >
                            START GAME
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('duel')}
                            disabled={!hostState || hostState.phase !== 'lobby'}
                        >
                            FORCE DUEL
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('meeting')}
                            disabled={!hostState || hostState.phase !== 'duel'}
                        >
                            FORCE MEETING
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => forcePhase('lobby')}
                            disabled={!hostState || hostState.phase !== 'meeting'}
                        >
                            NEXT ROUND
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                if (confirm('END GAME? This will remove all players and delete the lobby.')) {
                                    endGame();
                                }
                            }}
                            disabled={!currentGameCode}
                        >
                            END GAME
                        </button>
                    </div>
                </div>

                {/* Team Breakdown */}
                {hostState && hostState.teamBreakdown && hostState.phase !== 'waiting' && (
                    <div className="host-section">
                        <h3>TEAMS</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 'var(--space-sm)'
                        }}>
                            {hostState.teamBreakdown.map(team => (
                                <div key={team.teamId} className="stat-box" style={{ textAlign: 'center' }}>
                                    <div className="stat-label">TEAM {team.teamId + 1}</div>
                                    <div style={{
                                        marginTop: 'var(--space-xs)',
                                        fontSize: 'var(--font-size-xs)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        <span>{team.humans}H</span>
                                        <span style={{ color: 'var(--text-muted)' }}> / </span>
                                        <span style={{ color: 'var(--accent-red)' }}>{team.zombies}Z</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Players */}
                {hostState && hostState.players && (
                    <div className="host-section">
                        <h3>PARTICIPANTS ({hostState.players.length})</h3>
                        <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-muted)'
                        }}>
                            <table style={{
                                width: '100%',
                                fontSize: 'var(--font-size-xs)',
                                fontFamily: 'var(--font-mono)',
                                borderCollapse: 'collapse'
                            }}>
                                <thead>
                                    <tr style={{
                                        textAlign: 'left',
                                        color: 'var(--text-muted)',
                                        borderBottom: '1px solid var(--border-muted)'
                                    }}>
                                        <th style={{ padding: 'var(--space-sm)' }}>NAME</th>
                                        <th style={{ padding: 'var(--space-sm)' }}>TEAM</th>
                                        <th style={{ padding: 'var(--space-sm)' }}>ROLE</th>
                                        <th style={{ padding: 'var(--space-sm)' }}>STATUS</th>
                                        <th style={{ padding: 'var(--space-sm)' }}>CARDS</th>
                                        <th style={{ padding: 'var(--space-sm)' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hostState.players.map(player => (
                                        <tr
                                            key={player.id}
                                            style={{
                                                opacity: player.status === 'alive' ? 1 : 0.4,
                                                borderBottom: '1px solid var(--border-muted)'
                                            }}
                                        >
                                            <td style={{ padding: 'var(--space-sm)', textTransform: 'uppercase' }}>
                                                {player.name}
                                                {!player.isConnected && (
                                                    <span className="status-dot disconnected" style={{ marginLeft: '0.5rem' }} />
                                                )}
                                            </td>
                                            <td style={{ padding: 'var(--space-sm)' }}>
                                                {player.teamId + 1}
                                            </td>
                                            <td style={{
                                                padding: 'var(--space-sm)',
                                                color: player.role === 'zombie' ? 'var(--accent-red)' : 'var(--text-primary)'
                                            }}>
                                                {player.role === 'zombie' ? 'INF' : 'SUR'}
                                            </td>
                                            <td style={{
                                                padding: 'var(--space-sm)',
                                                color: player.status === 'alive' ? 'var(--text-primary)' : 'var(--accent-red)'
                                            }}>
                                                {player.status === 'alive' ? 'ALIVE' : 'DEAD'}
                                            </td>
                                            <td style={{ padding: 'var(--space-sm)' }}>
                                                {player.numberCardCount}
                                                {player.hasZombieCard && <span style={{ color: 'var(--accent-red)' }}> ☠</span>}
                                                {player.hasVaccine && ' ✚'}
                                                {player.hasShotgun && ' ×'}
                                            </td>
                                            <td style={{ padding: 'var(--space-sm)' }}>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}
                                                    onClick={() => kickPlayer(player.id)}
                                                    disabled={player.status !== 'alive'}
                                                >
                                                    KICK
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
                        <h3>ACTIVE DUELS</h3>
                        <div className="player-list" style={{ border: '1px solid var(--border-muted)' }}>
                            {hostState.duels.map(duel => (
                                <div key={duel.id} className="player-item disabled">
                                    <span className="player-name">
                                        {duel.player1Name} VS {duel.player2Name}
                                    </span>
                                    <span className={`status-badge ${duel.status === 'resolved' ? 'alive' : 'paired'}`}>
                                        {duel.status === 'resolved' ? 'DONE' : 'ACTIVE'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Events */}
                <div className="host-section">
                    <h3>EVENT LOG</h3>
                    {events.length === 0 ? (
                        <div className="stat-box">
                            <SystemMessage>NO EVENTS</SystemMessage>
                        </div>
                    ) : (
                        <div style={{
                            maxHeight: '120px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-muted)',
                            padding: 'var(--space-md)'
                        }}>
                            <div className="event-feed">
                                {events.slice().reverse().map(event => (
                                    <EventItem key={event.id} type={event.type} message={event.message} />
                                ))}
                            </div>
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
