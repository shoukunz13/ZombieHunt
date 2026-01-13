/**
 * ZOMBIE HUNT — End Game Reveal Component
 * 
 * Dramatic reveal animation for the host screen:
 * 1. Scramble phase (3 seconds): Numbers rapidly randomize
 * 2. Slowdown phase (2 seconds): Numbers slow down to final values
 * 3. Reveal phase: Final numbers with winner announcement
 */

import { useState, useEffect } from 'react';
import { FinalReveal } from '../types';

interface EndGameRevealProps {
    finalReveal: FinalReveal;
    onComplete?: () => void;
}

type RevealPhase = 'scramble' | 'slowdown' | 'reveal';

const SCRAMBLE_SPEED = 50;

export function EndGameReveal({ finalReveal, onComplete }: EndGameRevealProps) {
    const [phase, setPhase] = useState<RevealPhase>('scramble');
    const [displayedHumans, setDisplayedHumans] = useState(0);
    const [displayedZombies, setDisplayedZombies] = useState(0);

    const { humanCount, zombieCount, winnerSide } = finalReveal;

    // Scramble effect
    useEffect(() => {
        if (phase === 'scramble') {
            const interval = setInterval(() => {
                setDisplayedHumans(Math.floor(Math.random() * 20));
                setDisplayedZombies(Math.floor(Math.random() * 20));
            }, SCRAMBLE_SPEED);

            // After 3 seconds, transition to slowdown
            const timeout = setTimeout(() => {
                setPhase('slowdown');
            }, 3000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [phase]);

    // Slowdown effect - gradually approach real numbers
    useEffect(() => {
        if (phase === 'slowdown') {
            let speed = 100;
            let step = 0;
            const totalSteps = 10;

            const interval = setInterval(() => {
                step++;
                // Gradually blend random with actual
                const blend = step / totalSteps;
                const randomH = Math.floor(Math.random() * 20);
                const randomZ = Math.floor(Math.random() * 20);

                setDisplayedHumans(Math.round(randomH * (1 - blend) + humanCount * blend));
                setDisplayedZombies(Math.round(randomZ * (1 - blend) + zombieCount * blend));

                speed += 50; // Slow down gradually

                if (step >= totalSteps) {
                    clearInterval(interval);
                    setPhase('reveal');
                }
            }, speed);

            return () => clearInterval(interval);
        }
    }, [phase, humanCount, zombieCount]);

    // Final reveal
    useEffect(() => {
        if (phase === 'reveal') {
            setDisplayedHumans(humanCount);
            setDisplayedZombies(zombieCount);

            // Notify completion after delay
            if (onComplete) {
                const timeout = setTimeout(onComplete, 5000);
                return () => clearTimeout(timeout);
            }
        }
    }, [phase, humanCount, zombieCount, onComplete]);

    const isHumanWin = winnerSide === 'humans';
    const isZombieWin = winnerSide === 'zombies';
    const isTie = winnerSide === 'tie';

    return (
        <div className="end-game-reveal">
            {/* Title */}
            <div className={`reveal-title ${phase === 'reveal' ? 'visible' : ''}`}>
                {phase === 'reveal' && (
                    isHumanWin ? 'HUMANITY SURVIVES' :
                        isZombieWin ? 'INFECTION SPREADS' :
                            'MUTUAL DESTRUCTION'
                )}
            </div>

            {/* Counter Display */}
            <div className="reveal-counters">
                <div className={`reveal-counter survivor ${isHumanWin && phase === 'reveal' ? 'winner' : ''}`}>
                    <div className={`counter-value ${phase === 'scramble' ? 'scrambling' : ''} ${phase === 'slowdown' ? 'slowing' : ''}`}>
                        {displayedHumans}
                    </div>
                    <div className="counter-label">SURVIVORS</div>
                </div>

                <div className="reveal-vs">VS</div>

                <div className={`reveal-counter infected ${isZombieWin && phase === 'reveal' ? 'winner' : ''}`}>
                    <div className={`counter-value ${phase === 'scramble' ? 'scrambling' : ''} ${phase === 'slowdown' ? 'slowing' : ''}`}>
                        {displayedZombies}
                    </div>
                    <div className="counter-label">INFECTED</div>
                </div>
            </div>

            {/* Victory Message */}
            {phase === 'reveal' && (
                <div className={`victory-message ${isHumanWin ? 'human' : isZombieWin ? 'zombie' : 'tie'}`}>
                    {isHumanWin && (
                        <>
                            <div className="victory-icon">🛡️</div>
                            <p>The survivors held the line. Humanity endures.</p>
                        </>
                    )}
                    {isZombieWin && (
                        <>
                            <div className="victory-icon">🧟</div>
                            <p>The infection has won. All hope is lost.</p>
                        </>
                    )}
                    {isTie && (
                        <>
                            <div className="victory-icon">💀</div>
                            <p>Neither side prevailed. Total annihilation.</p>
                        </>
                    )}
                </div>
            )}

            {/* Subtitle */}
            <div className="reveal-subtitle">
                {phase === 'scramble' && 'CALCULATING FATE...'}
                {phase === 'slowdown' && 'REVEALING TRUTH...'}
                {phase === 'reveal' && 'GAME OVER'}
            </div>
        </div>
    );
}
