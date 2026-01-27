/**
 * ZOMBIE HUNT — Join Lobby Screen
 * 
 * Enter a 6-character lobby code to join a game.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DisplayTitle, SystemMessage } from '../components/shared';

export function JoinLobbyScreen() {
    const navigate = useNavigate();
    const [lobbyCode, setLobbyCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const code = lobbyCode.trim().toUpperCase();
        
        // Basic validation
        if (code.length < 4 || code.length > 8) {
            setError('Lobby code must be 4-8 characters');
            return;
        }

        if (!/^[A-Z0-9]+$/.test(code)) {
            setError('Lobby code can only contain letters and numbers');
            return;
        }

        // Navigate to the game join screen with lobby code
        navigate(`/game/${code}`);
    };

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Title Block */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="3xl">JOIN LOBBY</DisplayTitle>
                    <SystemMessage>ENTER ACCESS CODE</SystemMessage>
                </div>

                {/* Join Form */}
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px' }}>
                    {/* Lobby Code Input */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="text-system" style={{
                            display: 'block',
                            marginBottom: 'var(--space-xs)',
                            fontSize: 'var(--font-size-xs)'
                        }}>
                            LOBBY CODE
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="ENTER CODE_"
                            value={lobbyCode}
                            onChange={(e) => {
                                setLobbyCode(e.target.value.toUpperCase());
                                setError(null);
                            }}
                            maxLength={8}
                            autoComplete="off"
                            autoFocus
                            style={{
                                textAlign: 'center',
                                fontSize: 'var(--font-size-xl)',
                                letterSpacing: '0.2em',
                            }}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            marginBottom: 'var(--space-md)',
                            padding: 'var(--space-md)',
                            border: '1px solid var(--accent-red)',
                            background: 'rgba(193, 18, 31, 0.1)'
                        }}>
                            <span className="text-system" style={{ color: 'var(--accent-red)' }}>
                                {error}
                            </span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={!lobbyCode.trim()}
                        style={{ fontSize: 'var(--font-size-lg)' }}
                    >
                        JOIN GAME
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary btn-block"
                        onClick={() => navigate('/')}
                        style={{ marginTop: 'var(--space-md)' }}
                    >
                        BACK
                    </button>
                </form>

                {/* Info */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    textAlign: 'center'
                }}>
                    <p className="text-system" style={{
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-xs)'
                    }}>
                        ASK YOUR HOST FOR THE CODE
                    </p>
                </div>
            </div>
        </div>
    );
}
