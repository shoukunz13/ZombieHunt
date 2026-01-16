/**
 * ZOMBIE HUNT — Shotgun Death Overlay
 * 
 * Dramatic laser-targeting death animation with sound effects.
 * Shows a laser beam targeting the player then "killing" them.
 */

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { shakeScreen, createGlitchText, easing } from '../animations/effects';
import { emitParticleBurst } from '../animations/particles';

interface ShotgunDeathOverlayProps {
    onComplete: () => void;
}

// Sound effects
const playLaserCharge = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.3, audioContext.currentTime + 0.8);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
    } catch (e) {
        console.log('Audio not available');
    }
};

const playLaserFire = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(3000, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not available');
    }
};

const playImpact = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Low impact thud
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Noise burst
        const bufferSize = audioContext.sampleRate * 0.2;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = audioContext.createGain();
        noise.connect(noiseGain);
        noiseGain.connect(audioContext.destination);

        noiseGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        noise.start(audioContext.currentTime);
    } catch (e) {
        console.log('Audio not available');
    }
};

export function ShotgunDeathOverlay({ onComplete }: ShotgunDeathOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const initApp = async () => {
            const app = new Application();

            await app.init({
                width: containerRef.current!.clientWidth,
                height: containerRef.current!.clientHeight,
                backgroundColor: 0x000000,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const centerX = app.screen.width / 2;
            const centerY = app.screen.height / 2;

            // Main container for shake effects
            const mainContainer = new Container();
            app.stage.addChild(mainContainer);

            // Laser targeting reticle
            const reticle = new Container();
            reticle.x = centerX;
            reticle.y = centerY;
            mainContainer.addChild(reticle);

            // Outer ring
            const outerRing = new Graphics();
            outerRing.circle(0, 0, 80);
            outerRing.stroke({ color: 0xff0000, width: 2 });
            reticle.addChild(outerRing);

            // Inner ring
            const innerRing = new Graphics();
            innerRing.circle(0, 0, 40);
            innerRing.stroke({ color: 0xff0000, width: 2 });
            reticle.addChild(innerRing);

            // Crosshairs
            const crosshairs = new Graphics();
            crosshairs.moveTo(-100, 0).lineTo(-50, 0);
            crosshairs.moveTo(50, 0).lineTo(100, 0);
            crosshairs.moveTo(0, -100).lineTo(0, -50);
            crosshairs.moveTo(0, 50).lineTo(0, 100);
            crosshairs.stroke({ color: 0xff0000, width: 2 });
            reticle.addChild(crosshairs);

            // Center dot
            const centerDot = new Graphics();
            centerDot.circle(0, 0, 5);
            centerDot.fill(0xff0000);
            reticle.addChild(centerDot);

            // Start animation sequence
            reticle.alpha = 0;
            reticle.scale.set(2);

            // Phase 1: Reticle appears and locks on
            playLaserCharge();

            const lockOnAnimation = () => {
                return new Promise<void>((resolve) => {
                    const startTime = Date.now();
                    const duration = 1000;

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const easedProgress = easing.easeOutCubic(progress);

                        reticle.alpha = easedProgress;
                        reticle.scale.set(2 - easedProgress);

                        // Spin effect
                        outerRing.rotation = progress * Math.PI * 2;
                        innerRing.rotation = -progress * Math.PI * 4;

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };
                    animate();
                });
            };

            // Phase 2: Laser fires
            const laserFire = () => {
                return new Promise<void>((resolve) => {
                    playLaserFire();

                    // Flash the screen red
                    const flash = new Graphics();
                    flash.rect(0, 0, app.screen.width, app.screen.height);
                    flash.fill(0xff0000);
                    flash.alpha = 0.8;
                    mainContainer.addChild(flash);

                    // Fade flash
                    const fadeFlash = () => {
                        flash.alpha -= 0.1;
                        if (flash.alpha > 0) {
                            requestAnimationFrame(fadeFlash);
                        } else {
                            mainContainer.removeChild(flash);
                        }
                    };
                    setTimeout(fadeFlash, 50);

                    // Shake screen
                    shakeScreen(mainContainer, 20, 500);

                    setTimeout(resolve, 300);
                });
            };

            // Phase 3: Impact and shatter
            const impact = () => {
                return new Promise<void>((resolve) => {
                    playImpact();

                    // Hide reticle
                    reticle.visible = false;

                    // Create crack effect
                    const cracks = new Graphics();
                    cracks.x = centerX;
                    cracks.y = centerY;

                    // Draw crack lines radiating from center
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2;
                        const length = 100 + Math.random() * 200;
                        cracks.moveTo(0, 0);
                        cracks.lineTo(
                            Math.cos(angle) * length,
                            Math.sin(angle) * length
                        );
                    }
                    cracks.stroke({ color: 0xffffff, width: 3 });
                    mainContainer.addChild(cracks);

                    // Red particle burst
                    emitParticleBurst(mainContainer, centerX, centerY, {
                        count: 50,
                        color: [0xff0000, 0xff4444, 0xff8888],
                        minSize: 3,
                        maxSize: 8,
                        minSpeed: 5,
                        maxSpeed: 15,
                        minLife: 500,
                        maxLife: 1500,
                        gravity: 0.1,
                        spread: Math.PI * 2,
                        fadeOut: true
                    });

                    setTimeout(resolve, 1000);
                });
            };

            // Phase 4: Show ELIMINATED text
            const showResult = () => {
                // Calculate responsive font size based on screen width
                const maxWidth = app.screen.width * 0.9;
                const fontSize = Math.min(72, maxWidth / 10);

                const eliminatedText = createGlitchText('ELIMINATED', {
                    fontFamily: 'Courier New, monospace',
                    fontSize: fontSize,
                    fontWeight: 'bold',
                    fill: '#ff0000',
                    letterSpacing: Math.max(2, fontSize / 10),
                });
                eliminatedText.x = centerX;
                eliminatedText.y = centerY;
                eliminatedText.alpha = 0;
                mainContainer.addChild(eliminatedText);

                // Fade in
                const fadeIn = () => {
                    eliminatedText.alpha = Math.min(eliminatedText.alpha + 0.1, 1);
                    if (eliminatedText.alpha < 1) {
                        requestAnimationFrame(fadeIn);
                    }
                };
                fadeIn();
            };

            // Run animation sequence
            await lockOnAnimation();
            await laserFire();
            await impact();
            showResult();

            // Complete after showing result
            setTimeout(() => {
                onComplete();
            }, 2000);
        };

        initApp();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, [onComplete]);

    return (
        <div
            ref={containerRef}
            className="shotgun-death-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 3000,
                backgroundColor: 'rgba(0, 0, 0, 0.98)',
            }}
        />
    );
}
