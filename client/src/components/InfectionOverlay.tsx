/**
 * ZOMBIE HUNT — Infection Overlay (Redesigned)
 * 
 * Phase 1: Green virus particles taking over the screen (no text)
 * Phase 2: "INFECTED" screen with continue button
 * Uses PixiJS for advanced 2D animation.
 */

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';

interface InfectionOverlayProps {
    onComplete: () => void;
}

// Virus particle class for the swarm effect
interface VirusParticle {
    graphics: Graphics;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
    rotation: number;
    rotationSpeed: number;
    size: number;
    pulsePhase: number;
}

export function InfectionOverlay({ onComplete }: InfectionOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const initApp = async () => {
            const app = new Application();

            await app.init({
                width: containerRef.current!.clientWidth,
                height: containerRef.current!.clientHeight,
                backgroundColor: 0x0a1a0a, // Dark green tint
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const centerX = app.screen.width / 2;
            const centerY = app.screen.height / 2;

            // Main container for virus swarm
            const virusContainer = new Container();
            app.stage.addChild(virusContainer);

            // Create a single virus shape
            const createVirus = (size: number): Graphics => {
                const virus = new Graphics();
                const virusColor = 0x00ff44;

                // Central body
                virus.circle(0, 0, size);
                virus.fill({ color: virusColor, alpha: 0.8 });

                // Spikes around the virus
                const spikeCount = 8;
                for (let i = 0; i < spikeCount; i++) {
                    const angle = (i / spikeCount) * Math.PI * 2;
                    const spikeLength = size * 0.6;
                    const tipX = Math.cos(angle) * (size + spikeLength);
                    const tipY = Math.sin(angle) * (size + spikeLength);

                    virus.circle(tipX, tipY, size * 0.25);
                    virus.fill({ color: virusColor, alpha: 0.9 });
                }

                // Inner darker circle
                virus.circle(0, 0, size * 0.5);
                virus.fill({ color: 0x004a00, alpha: 0.5 });

                return virus;
            };

            // Array to hold all virus particles
            const viruses: VirusParticle[] = [];
            const virusCount = 40;

            // Spawn viruses from edges, moving toward center
            for (let i = 0; i < virusCount; i++) {
                const size = 8 + Math.random() * 15;
                const graphics = createVirus(size);

                // Start from random edge
                const edge = Math.floor(Math.random() * 4);
                let x: number, y: number;
                switch (edge) {
                    case 0: // Top
                        x = Math.random() * app.screen.width;
                        y = -50;
                        break;
                    case 1: // Right
                        x = app.screen.width + 50;
                        y = Math.random() * app.screen.height;
                        break;
                    case 2: // Bottom
                        x = Math.random() * app.screen.width;
                        y = app.screen.height + 50;
                        break;
                    default: // Left
                        x = -50;
                        y = Math.random() * app.screen.height;
                        break;
                }

                graphics.x = x;
                graphics.y = y;
                graphics.alpha = 0;

                virusContainer.addChild(graphics);

                viruses.push({
                    graphics,
                    x,
                    y,
                    targetX: centerX + (Math.random() - 0.5) * 200,
                    targetY: centerY + (Math.random() - 0.5) * 200,
                    speed: 1 + Math.random() * 2,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.05,
                    size,
                    pulsePhase: Math.random() * Math.PI * 2,
                });
            }

            // Green toxic haze that grows
            const haze = new Graphics();
            haze.circle(centerX, centerY, 10);
            haze.fill({ color: 0x00ff00, alpha: 0.1 });
            app.stage.addChildAt(haze, 0);

            // Heartbeat / pulse effect on screen
            let hazeSize = 10;
            let hazeAlpha = 0;

            // Animation loop
            let startTime = Date.now();
            const totalDuration = 3000;

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / totalDuration, 1);

                // Update all viruses
                viruses.forEach((v, index) => {
                    // Delay spawn based on index
                    const spawnDelay = (index / virusCount) * 800;
                    const particleProgress = Math.max(0, (elapsed - spawnDelay) / (totalDuration - spawnDelay));

                    if (particleProgress > 0) {
                        // Fade in
                        v.graphics.alpha = Math.min(particleProgress * 2, 0.9);

                        // Move toward target
                        const dx = v.targetX - v.x;
                        const dy = v.targetY - v.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist > 5) {
                            v.x += (dx / dist) * v.speed * (1 + progress);
                            v.y += (dy / dist) * v.speed * (1 + progress);
                        }

                        // Add some wobble
                        v.x += Math.sin(elapsed * 0.003 + index) * 0.5;
                        v.y += Math.cos(elapsed * 0.003 + index) * 0.5;

                        v.graphics.x = v.x;
                        v.graphics.y = v.y;

                        // Rotate
                        v.rotation += v.rotationSpeed;
                        v.graphics.rotation = v.rotation;

                        // Pulse size
                        const pulse = 1 + Math.sin(elapsed * 0.01 + v.pulsePhase) * 0.1;
                        v.graphics.scale.set(pulse);
                    }
                });

                // Grow toxic haze
                hazeSize = 10 + progress * 400;
                hazeAlpha = progress * 0.4;
                haze.clear();
                haze.circle(centerX, centerY, hazeSize);
                haze.fill({ color: 0x00ff00, alpha: hazeAlpha });

                // Screen pulse effect
                if (progress > 0.5) {
                    const pulseIntensity = Math.sin((elapsed - totalDuration * 0.5) * 0.02) * 0.1;
                    virusContainer.alpha = 0.9 + pulseIntensity;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Final flash
                    const flash = new Graphics();
                    flash.rect(0, 0, app.screen.width, app.screen.height);
                    flash.fill({ color: 0x00ff00, alpha: 0.5 });
                    app.stage.addChild(flash);

                    // Fade out flash and show result
                    let flashAlpha = 0.5;
                    const fadeFlash = () => {
                        flashAlpha -= 0.05;
                        flash.alpha = Math.max(flashAlpha, 0);

                        if (flashAlpha > 0) {
                            requestAnimationFrame(fadeFlash);
                        } else {
                            // Complete after flash
                            setTimeout(() => {
                                onComplete();
                            }, 300);
                        }
                    };
                    fadeFlash();
                }
            };

            animate();
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
            className="infection-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 2000,
                backgroundColor: 'rgba(10, 26, 10, 0.98)', // Dark green tint
            }}
        />
    );
}
