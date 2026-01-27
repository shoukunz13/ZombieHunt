/**
 * ZOMBIE HUNT — Splash Screen
 * 
 * Entry point with CREATE LOBBY and JOIN LOBBY options.
 * Design: Black screen, terminal aesthetic
 */

import { useNavigate } from 'react-router-dom';
import { DisplayTitle, SystemMessage } from '../components/shared';

export function SplashScreen() {
    const navigate = useNavigate();

    return (
        <div className="container">
            <div className="screen screen-centered">
                {/* Title Block */}
                <div style={{ marginBottom: 'var(--space-3xl)' }}>
                    <DisplayTitle size="4xl">ZOMBIE HUNT</DisplayTitle>
                    <SystemMessage>SURVIVAL IS NOT GUARANTEED</SystemMessage>
                </div>

                {/* Action Buttons */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 'var(--space-md)',
                    width: '100%',
                    maxWidth: '320px'
                }}>
                    <button
                        className="btn btn-primary btn-block"
                        onClick={() => navigate('/create')}
                        style={{ fontSize: 'var(--font-size-lg)' }}
                    >
                        CREATE LOBBY
                    </button>
                    
                    <button
                        className="btn btn-secondary btn-block"
                        onClick={() => navigate('/join')}
                        style={{ fontSize: 'var(--font-size-lg)' }}
                    >
                        JOIN LOBBY
                    </button>
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    textAlign: 'center'
                }}>
                    <p className="text-system" style={{
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-xs)'
                    }}>
                        THE INFECTION AWAITS
                    </p>
                </div>
            </div>
        </div>
    );
}
