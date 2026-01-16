/**
 * ZOMBIE HUNT — Cure Overlay (Redesigned)
 * 
 * Phase 1: Yellow syringe animation with healing particles (no text)
 * Phase 2: "CURED" screen with continue button
 * Uses PixiJS for advanced 2D animation.
 */

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { emitParticleBurst } from '../animations/particles';

interface CureOverlayProps {
    onComplete: () => void;
}

export function CureOverlay({ onComplete }: CureOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const initApp = async () => {
            const app = new Application();

            await app.init({
                width: containerRef.current!.clientWidth,
                height: containerRef.current!.clientHeight,
                backgroundColor: 0x2a2a0a, // Dark yellow/gold tint
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const centerX = app.screen.width / 2;
            const centerY = app.screen.height / 2;

            // Main container
            const mainContainer = new Container();
            mainContainer.x = centerX;
            mainContainer.y = centerY;
            app.stage.addChild(mainContainer);

            // ========== DRAW SYRINGE ==========
            const syringeContainer = new Container();
            syringeContainer.scale.set(0);
            syringeContainer.rotation = -Math.PI / 4;
            mainContainer.addChild(syringeContainer);

            const syringeColor = 0xffdd00; // Yellow
            const liquidColor = 0x88ff88; // Light green cure liquid

            // Syringe barrel
            const barrel = new Graphics();
            barrel.roundRect(-15, -80, 30, 120, 4);
            barrel.fill(0x444444);
            barrel.roundRect(-12, -75, 24, 110, 3);
            barrel.fill(0xeeeeee);
            syringeContainer.addChild(barrel);

            // Cure liquid inside
            const liquid = new Graphics();
            liquid.roundRect(-10, 0, 20, 35, 2);
            liquid.fill(liquidColor);
            syringeContainer.addChild(liquid);

            // Plunger
            const plunger = new Graphics();
            plunger.roundRect(-10, -100, 20, 25, 3);
            plunger.fill(syringeColor);
            plunger.rect(-3, -115, 6, 20);
            plunger.fill(syringeColor);
            syringeContainer.addChild(plunger);

            // Needle
            const needle = new Graphics();
            needle.moveTo(0, 40);
            needle.lineTo(0, 80);
            needle.stroke({ color: 0xaaaaaa, width: 4 });
            needle.moveTo(-2, 80);
            needle.lineTo(0, 90);
            needle.lineTo(2, 80);
            needle.fill(0xaaaaaa);
            syringeContainer.addChild(needle);

            // ========== ANIMATION PHASES ==========

            // Phase 1: Syringe appears with zoom
            const zoomIn = () => {
                return new Promise<void>((resolve) => {
                    const startTime = Date.now();
                    const duration = 600;

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

                        syringeContainer.scale.set(eased * 1.5);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };
                    animate();
                });
            };

            // Phase 2: Injection animation (plunger moves down, liquid shrinks)
            const inject = () => {
                return new Promise<void>((resolve) => {
                    const startTime = Date.now();
                    const duration = 800;
                    const startY = plunger.y;

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        plunger.y = startY + progress * 70;
                        liquid.scale.y = 1 - progress;
                        liquid.alpha = 1 - progress * 0.5;

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };
                    animate();
                });
            };

            // Phase 3: Healing burst and syringe fade
            const healingBurst = () => {
                return new Promise<void>((resolve) => {
                    // Yellow/green healing particles burst from center
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            emitParticleBurst(app.stage, centerX, centerY, {
                                count: 40,
                                color: [0xffdd00, 0x88ff88, 0xaaffaa, 0xffffff],
                                minSize: 3,
                                maxSize: 10,
                                minSpeed: 3,
                                maxSpeed: 8,
                                minLife: 800,
                                maxLife: 1500,
                                gravity: -0.02,
                                spread: Math.PI * 2,
                                fadeOut: true
                            });
                        }, i * 200);
                    }

                    // Fade out syringe
                    const startTime = Date.now();
                    const duration = 600;

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        syringeContainer.alpha = 1 - progress;
                        syringeContainer.scale.set(1.5 + progress * 0.5);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };
                    animate();
                });
            };

            // Phase 4: Screen glows golden
            const goldenGlow = () => {
                return new Promise<void>((resolve) => {
                    const glow = new Graphics();
                    glow.circle(0, 0, 500);
                    glow.fill({ color: 0xffdd00, alpha: 0 });
                    mainContainer.addChildAt(glow, 0);

                    const startTime = Date.now();
                    const duration = 500;

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        glow.alpha = progress * 0.3;

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };
                    animate();
                });
            };

            // Run animation sequence
            await zoomIn();
            await inject();
            await healingBurst();
            await goldenGlow();

            // Wait a moment then complete
            setTimeout(() => {
                onComplete();
            }, 500);
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
            className="cure-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 2000,
                backgroundColor: 'rgba(42, 42, 10, 0.98)', // Dark yellow tint
            }}
        />
    );
}
