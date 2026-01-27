/**
 * ZOMBIE HUNT — End Screen
 * 
 * Design: Ceremonial reveal
 * - Delayed fade-in effect
 * - Final red/white contrast
 * - Winner announcement
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { DisplayTitle, SystemMessage, Spinner } from '../components/shared';

export function EndScreen() {
    const navigate = useNavigate();
    const {
        privateState, finalReveal, yourOutcome, gameState,
        lobbyDestroyed, clearLobbyDestroyed,
        lobbyRestarted, clearLobbyRestarted,
        leaveGame
    } = useGame();

    // Redirect to home if lobby was destroyed
    useEffect(() => {
        if (lobbyDestroyed) {
            clearLobbyDestroyed();
            navigate('/');
        }
    }, [lobbyDestroyed, clearLobbyDestroyed, navigate]);

    // Auto-redirect to lobby when host clicks Play Again
    useEffect(() => {
        if (lobbyRestarted && gameState) {
            clearLobbyRestarted();
            navigate(`/game/${gameState.gameCode}/lobby`);
        }
    }, [lobbyRestarted, clearLobbyRestarted, navigate, gameState]);

    if (!finalReveal) {
        return (
            <div className="container">
                <div className="screen screen-centered">
                    <Spinner />
                    <SystemMessage>CALCULATING RESULTS</SystemMessage>
                </div>
            </div>
        );
    }

    const isWinner = yourOutcome === 'won';
    const isTie = yourOutcome === 'tie';

    return (
        <div className="container">
            <div className="screen screen-centered animate-fade-in">
                {/* Winner Announcement */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <SystemMessage>THE GAME HAS ENDED</SystemMessage>
                    <div style={{ marginTop: 'var(--space-xl)' }}>
                        <DisplayTitle size="4xl">
                            {finalReveal.winnerSide === 'humans' ? 'SURVIVORS' :
                                finalReveal.winnerSide === 'zombies' ? 'INFECTED' : 'STALEMATE'}
                        </DisplayTitle>
                        {!isTie && (
                            <DisplayTitle size="2xl">PREVAIL</DisplayTitle>
                        )}
                    </div>
                </div>

                {/* Your Outcome */}
                <div style={{
                    padding: 'var(--space-xl)',
                    border: isWinner ? '2px solid var(--text-primary)' : '2px solid var(--accent-red)',
                    marginBottom: 'var(--space-2xl)',
                    textAlign: 'center',
                    minWidth: '200px'
                }}>
                    <DisplayTitle size="xl">
                        {isWinner ? 'YOU WON' : isTie ? 'DRAW' : 'YOU LOST'}
                    </DisplayTitle>
                    {privateState && (
                        <p className="text-system mt-md" style={{
                            color: privateState.role === 'zombie' ? 'var(--accent-red)' : 'var(--text-primary)'
                        }}>
                            YOU WERE {privateState.role === 'zombie' ? 'INFECTED' : 'A SURVIVOR'}
                        </p>
                    )}
                </div>

                {/* Final Count */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-xl)',
                    marginBottom: 'var(--space-2xl)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-4xl)',
                            color: 'var(--text-primary)'
                        }}>
                            {finalReveal.humanCount}
                        </p>
                        <SystemMessage>SURVIVORS</SystemMessage>
                    </div>
                    <div style={{
                        width: '1px',
                        background: 'var(--border-muted)',
                        alignSelf: 'stretch'
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <p className="heading-display" style={{
                            fontSize: 'var(--font-size-4xl)',
                            color: 'var(--accent-red)'
                        }}>
                            {finalReveal.zombieCount}
                        </p>
                        <SystemMessage>INFECTED</SystemMessage>
                    </div>
                </div>

                {/* Survivors List */}
                <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: 'var(--space-md)' }}>
                    <div className="card-header">
                        <span>SURVIVING HUMANS</span>
                        <span>{finalReveal.humans.length}</span>
                    </div>
                    {finalReveal.humans.length === 0 ? (
                        <p className="text-system text-center" style={{
                            padding: 'var(--space-md)',
                            color: 'var(--text-muted)'
                        }}>
                            NONE
                        </p>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 'var(--space-sm)',
                            padding: 'var(--space-sm) 0'
                        }}>
                            {finalReveal.humans.map(player => (
                                <span
                                    key={player.id}
                                    className="text-system"
                                    style={{
                                        padding: 'var(--space-xs) var(--space-sm)',
                                        border: '1px solid var(--text-primary)',
                                        fontSize: 'var(--font-size-xs)'
                                    }}
                                >
                                    {player.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: 'var(--space-xl)' }}>
                    <div className="card-header">
                        <span>SURVIVING INFECTED</span>
                        <span style={{ color: 'var(--accent-red)' }}>{finalReveal.zombies.length}</span>
                    </div>
                    {finalReveal.zombies.length === 0 ? (
                        <p className="text-system text-center" style={{
                            padding: 'var(--space-md)',
                            color: 'var(--text-muted)'
                        }}>
                            NONE
                        </p>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 'var(--space-sm)',
                            padding: 'var(--space-sm) 0'
                        }}>
                            {finalReveal.zombies.map(player => (
                                <span
                                    key={player.id}
                                    className="text-system"
                                    style={{
                                        padding: 'var(--space-xs) var(--space-sm)',
                                        border: '1px solid var(--accent-red)',
                                        color: 'var(--accent-red)',
                                        fontSize: 'var(--font-size-xs)'
                                    }}
                                >
                                    {player.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {lobbyRestarted && gameState ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                clearLobbyRestarted();
                                navigate(`/game/${gameState.gameCode}/lobby`);
                            }}
                        >
                            RETURN TO LOBBY
                        </button>
                    ) : (
                        <SystemMessage>WAITING FOR HOST TO START NEW GAME...</SystemMessage>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            leaveGame();
                            navigate('/');
                        }}
                    >
                        LEAVE GAME
                    </button>
                </div>
            </div>
        </div>
    );
}
