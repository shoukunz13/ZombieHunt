/**
 * ZOMBIE HUNT — Game Start Alert with Role Reveal
 * 
 * Two-phase dramatic overlay:
 * 1. "GAME START" screen (5 seconds)
 * 2. Role reveal screen (Survivor or Infected - more dramatic)
 * 
 * No sound effects to preserve anonymity
 */

import { useEffect, useState } from 'react';
import { playGameStartSound } from '../utils/sounds';

type AlertPhase = 'game-start' | 'role-reveal' | 'done';

interface GameStartAlertProps {
    round: number;
    role: 'human' | 'zombie';
    onComplete: () => void;
}

export function GameStartAlert({ round, role, onComplete }: GameStartAlertProps) {
    const [phase, setPhase] = useState<AlertPhase>('game-start');
    const [animState, setAnimState] = useState<'enter' | 'show' | 'exit'>('enter');

    useEffect(() => {
        // Play game start sound
        playGameStartSound();

        // Phase 1: Game Start (5 seconds)
        const enterTimer = setTimeout(() => setAnimState('show'), 100);

        // Transition to role reveal after 5 seconds
        const roleTimer = setTimeout(() => {
            setAnimState('exit');
            setTimeout(() => {
                setPhase('role-reveal');
                setAnimState('enter');
                setTimeout(() => setAnimState('show'), 100);
            }, 500);
        }, 5000);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(roleTimer);
        };
    }, []);

    // Handle role reveal phase completion
    useEffect(() => {
        if (phase === 'role-reveal' && animState === 'show') {
            // Auto-dismiss after 4 seconds, or user can tap
            const dismissTimer = setTimeout(() => {
                setAnimState('exit');
                setTimeout(onComplete, 500);
            }, 4000);

            return () => clearTimeout(dismissTimer);
        }
    }, [phase, animState, onComplete]);

    const handleTap = () => {
        if (phase === 'role-reveal') {
            setAnimState('exit');
            setTimeout(onComplete, 300);
        }
    };

    const isInfected = role === 'zombie';
    const isFirstRound = round === 1;

    if (phase === 'done') return null;

    return (
        <div
            className={`game-start-overlay ${animState} ${phase === 'role-reveal' && isInfected ? 'infected' : ''}`}
            onClick={handleTap}
        >
            {phase === 'game-start' && (
                <div className="game-start-content">
                    {/* Decorative lines */}
                    <div className="game-start-line top" />

                    {/* Main text */}
                    <div className="game-start-text">
                        {isFirstRound ? (
                            <>
                                <div className="game-start-subtitle">THE HUNT BEGINS</div>
                                <h1 className="game-start-title glitch-text" data-text="GAME START">
                                    GAME START
                                </h1>
                            </>
                        ) : (
                            <>
                                <div className="game-start-subtitle">PREPARE FOR BATTLE</div>
                                <h1 className="game-start-title">
                                    ROUND {round}
                                </h1>
                            </>
                        )}
                    </div>

                    <div className="game-start-line bottom" />
                </div>
            )}

            {phase === 'role-reveal' && (
                <div className={`role-reveal-content ${isInfected ? 'infected' : 'survivor'}`}>
                    {isInfected ? (
                        // INFECTED REVEAL - More dramatic
                        <>
                            <div className="role-reveal-icon infected-pulse">
                                🧟
                            </div>
                            <h1 className="role-reveal-title glitch-text" data-text="INFECTED">
                                INFECTED
                            </h1>
                            <p className="role-reveal-subtitle">
                                YOU ARE THE ZOMBIE
                            </p>
                            <div className="role-reveal-instructions">
                                <p>• SPREAD THE INFECTION</p>
                                <p>• CONVERT YOUR TEAM</p>
                                <p>• STAY HIDDEN</p>
                            </div>
                        </>
                    ) : (
                        // SURVIVOR REVEAL - Clean and calm
                        <>
                            <div className="role-reveal-icon">
                                🧑
                            </div>
                            <h1 className="role-reveal-title">
                                SURVIVOR
                            </h1>
                            <p className="role-reveal-subtitle">
                                YOU ARE HUMAN
                            </p>
                            <div className="role-reveal-instructions">
                                <p>• WIN DUELS TO SURVIVE</p>
                                <p>• IDENTIFY THE INFECTED</p>
                                <p>• PROTECT YOUR TEAM</p>
                            </div>
                        </>
                    )}

                    <p className="role-reveal-hint">
                        TAP TO CONTINUE
                    </p>
                </div>
            )}
        </div>
    );
}
