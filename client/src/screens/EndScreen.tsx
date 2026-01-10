/**
 * Zombie Hunt - End Screen
 * Shows final game results and reveals all roles.
 */

import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function EndScreen() {
    const navigate = useNavigate();
    const { privateState, finalReveal, yourOutcome } = useGame();

    if (!finalReveal) {
        return (
            <div className="container">
                <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                        Loading results...
                    </p>
                </div>
            </div>
        );
    }

    const winnerIcon = finalReveal.winnerSide === 'humans' ? '👤' :
        finalReveal.winnerSide === 'zombies' ? '🧟' : '🤝';
    const winnerLabel = finalReveal.winnerSide === 'humans' ? 'Humans Win!' :
        finalReveal.winnerSide === 'zombies' ? 'Zombies Win!' : 'It\'s a Tie!';

    const outcomeColor = yourOutcome === 'won' ? 'var(--success)' :
        yourOutcome === 'lost' ? 'var(--danger)' : 'var(--warning)';
    const outcomeLabel = yourOutcome === 'won' ? '🏆 You Won!' :
        yourOutcome === 'lost' ? '💀 You Lost' : '🤝 Tie Game';

    return (
        <div className="container">
            <div className="screen">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ fontSize: '80px', marginBottom: 'var(--spacing-md)' }}>
                        {winnerIcon}
                    </div>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        marginBottom: 'var(--spacing-md)',
                        background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        GAME OVER
                    </h1>
                    <h2 style={{ fontSize: 'var(--font-size-xl)' }}>
                        {winnerLabel}
                    </h2>
                </div>

                {/* Your Outcome */}
                <div
                    className="card"
                    style={{
                        textAlign: 'center',
                        background: `linear-gradient(135deg, ${outcomeColor}22, ${outcomeColor}11)`,
                        border: `1px solid ${outcomeColor}44`
                    }}
                >
                    <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: outcomeColor }}>
                        {outcomeLabel}
                    </p>
                    {privateState && (
                        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
                            You were a {privateState.role === 'zombie' ? '🧟 Zombie' : '👤 Human'}
                        </p>
                    )}
                </div>

                {/* Final Counts */}
                <div className="card">
                    <div className="card-header">
                        <span>Final Count</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', padding: 'var(--spacing-md)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--human-blue)' }}>
                                {finalReveal.humanCount}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                👤 Humans
                            </div>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--zombie-green)' }}>
                                {finalReveal.zombieCount}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                🧟 Zombies
                            </div>
                        </div>
                    </div>
                </div>

                {/* Survivors List */}
                <div className="card">
                    <div className="card-header">
                        <span>👤 Surviving Humans</span>
                        <span style={{ color: 'var(--human-blue)' }}>{finalReveal.humans.length}</span>
                    </div>
                    {finalReveal.humans.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-sm)' }}>
                            None survived
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                            {finalReveal.humans.map(player => (
                                <span
                                    key={player.id}
                                    style={{
                                        background: 'rgba(96, 165, 250, 0.2)',
                                        color: 'var(--human-blue)',
                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                >
                                    {player.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <span>🧟 Surviving Zombies</span>
                        <span style={{ color: 'var(--zombie-green)' }}>{finalReveal.zombies.length}</span>
                    </div>
                    {finalReveal.zombies.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-sm)' }}>
                            None survived
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                            {finalReveal.zombies.map(player => (
                                <span
                                    key={player.id}
                                    style={{
                                        background: 'rgba(34, 197, 94, 0.2)',
                                        color: 'var(--zombie-green)',
                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                >
                                    {player.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Play Again */}
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/')}
                    style={{ marginTop: 'auto' }}
                >
                    Play Again
                </button>
            </div>
        </div>
    );
}
