/**
 * ZOMBIE HUNT — Host Dashboard
 * 
 * Design: Cinematic control panel
 * - Same color palette as player screens
 * - Larger typography for TV/projector
 * - Emphasize phase changes
 * - Ceremonial endgame reveal
 */

import { useState, useEffect } from 'react';
import { useHost, HostProvider } from '../context/HostContext';
import { ConnectionStatus, EventItem, DisplayTitle, SystemMessage } from '../components/shared';
import { IntroVideo } from '../components/IntroVideo';
import { EndGameReveal } from '../components/EndGameReveal';
import { FinalReveal } from '../types';


function HostDashboardContent() {
    const {
        isConnected, isAuthenticated, hostState, events, authError,
        currentGameCode, authenticate, createGame, startGame, forcePhase, kickPlayer, endGame,
        completeIntro, updateSettings, revealComplete, restartGame
    } = useHost();

    const [pin, setPin] = useState('');
    const [newGameCode, setNewGameCode] = useState('');
    const [showReveal, setShowReveal] = useState(true);

    // Reset showReveal to true when game enters ended phase
    useEffect(() => {
        if (hostState?.phase === 'ended') {
            setShowReveal(true);
        }
    }, [hostState?.phase]);

    // Helper to calculate slider background gradient for progress-fill effect
    const getSliderStyle = (value: number, min: number, max: number): React.CSSProperties => {
        const percentage = ((value - min) / (max - min)) * 100;
        return {
            width: '100%',
            background: `linear-gradient(to right, #c1121f 0%, #c1121f ${percentage}%, #1a1a1a ${percentage}%, #1a1a1a 100%)`
        };
    };

    // Create FinalReveal from hostState for end game reveal
    const getFinalReveal = (): FinalReveal | null => {
        if (!hostState || hostState.phase !== 'ended') return null;

        const winnerSide: 'humans' | 'zombies' | 'tie' =
            hostState.humanCount > hostState.zombieCount ? 'humans' :
                hostState.zombieCount > hostState.humanCount ? 'zombies' : 'tie';

        return {
            humans: [],
            zombies: [],
            winnerSide,
            humanCount: hostState.humanCount,
            zombieCount: hostState.zombieCount,
        };
    };

    const finalReveal = getFinalReveal();

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
            {/* Intro Video - fullscreen overlay */}
            {hostState?.phase === 'intro' && (
                <IntroVideo onComplete={completeIntro} />
            )}

            {/* End Game Reveal - fullscreen overlay */}
            {hostState?.phase === 'ended' && finalReveal && showReveal && (
                <EndGameReveal
                    finalReveal={finalReveal}
                    onComplete={() => {
                        revealComplete(); // Tell server to send results to players
                        setShowReveal(false);
                    }}
                />
            )}

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
                                    <div className="stat-value">{hostState.round}/{hostState.settings?.maxRounds || 20}</div>
                                    <div className="stat-label">ROUND</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value">???</div>
                                    <div className="stat-label">SURVIVORS</div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                        ???
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

                {/* Settings - Only during waiting phase */}
                {hostState && hostState.phase === 'waiting' && hostState.settings && (
                    <div className="host-section">
                        <h3>GAME SETTINGS</h3>

                        {/* Recommended Settings Button */}
                        <button
                            className="btn btn-secondary"
                            style={{ marginBottom: 'var(--space-md)', width: '100%' }}
                            onClick={() => {
                                const count = hostState.players.length;
                                // Apply recommended settings based on player count
                                if (count <= 8) {
                                    updateSettings({ zombieCount: 1, startingCards: 10, vaccineCount: 2, shotgunRatio: 50, maxInfections: 0 });
                                } else if (count <= 12) {
                                    updateSettings({ zombieCount: 2, startingCards: 12, vaccineCount: 3, shotgunRatio: 40, maxInfections: 5 });
                                } else if (count <= 16) {
                                    updateSettings({ zombieCount: 2, startingCards: 15, vaccineCount: 4, shotgunRatio: 40, maxInfections: 6 });
                                } else {
                                    updateSettings({ zombieCount: 2, startingCards: 20, vaccineCount: 5, shotgunRatio: 40, maxInfections: 8 });
                                }
                            }}
                        >
                            ⚡ APPLY RECOMMENDED ({hostState.players.length} players)
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {/* Max Rounds */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    MAX ROUNDS: {hostState.settings.maxRounds}
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="20"
                                    value={hostState.settings.maxRounds}
                                    onChange={(e) => updateSettings({ maxRounds: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.maxRounds, 5, 20)}
                                />
                            </div>

                            {/* Zombie Count */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    STARTING ZOMBIES: {hostState.settings.zombieCount}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    value={hostState.settings.zombieCount}
                                    onChange={(e) => updateSettings({ zombieCount: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.zombieCount, 1, 8)}
                                />
                            </div>

                            {/* Starting Cards */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    STARTING CARDS: {hostState.settings.startingCards}
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="25"
                                    value={hostState.settings.startingCards}
                                    onChange={(e) => updateSettings({ startingCards: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.startingCards, 5, 25)}
                                />
                            </div>

                            {/* Vaccine Count */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    VACCINES: {hostState.settings.vaccineCount}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={hostState.settings.vaccineCount}
                                    onChange={(e) => updateSettings({ vaccineCount: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.vaccineCount, 0, 10)}
                                />
                            </div>

                            {/* Shotgun Ratio */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    SHOTGUN %: {hostState.settings.shotgunRatio}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={hostState.settings.shotgunRatio}
                                    onChange={(e) => updateSettings({ shotgunRatio: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.shotgunRatio, 0, 100)}
                                />
                            </div>

                            {/* Max Infections (per zombie) */}
                            <div>
                                <label className="text-system" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                                    INFECTIONS/ZOMBIE: {hostState.settings.maxInfections === 0 ? 'Unlimited' : hostState.settings.maxInfections}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value={hostState.settings.maxInfections}
                                    onChange={(e) => updateSettings({ maxInfections: parseInt(e.target.value) })}
                                    style={getSliderStyle(hostState.settings.maxInfections, 0, 20)}
                                />
                            </div>

                            {/* Annihilation Rule Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <input
                                    type="checkbox"
                                    id="annihilationRule"
                                    checked={hostState.settings.annihilationRule}
                                    onChange={(e) => updateSettings({ annihilationRule: e.target.checked })}
                                />
                                <label htmlFor="annihilationRule" className="text-system">
                                    ANNIHILATION RULE (all zombies = everyone dies)
                                </label>
                            </div>
                        </div>
                    </div>
                )}

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
                            className="btn btn-primary"
                            onClick={() => restartGame()}
                            disabled={!hostState || hostState.phase !== 'ended'}
                        >
                            PLAY AGAIN
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
