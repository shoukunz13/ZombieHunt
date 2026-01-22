/**
 * ZOMBIE HUNT — Particle System
 * 
 * Simple particle system for visual effects.
 */

import { Container, Graphics } from 'pixi.js';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: number;
    alpha: number;
    graphics: Graphics;
}

interface ParticleConfig {
    count: number;
    color: number | number[];
    minSize: number;
    maxSize: number;
    minSpeed: number;
    maxSpeed: number;
    minLife: number;
    maxLife: number;
    gravity?: number;
    spread?: number;
    fadeOut?: boolean;
}

/**
 * Emit particles in a burst pattern
 */
export function emitParticleBurst(
    container: Container,
    x: number,
    y: number,
    config: ParticleConfig
): Promise<void> {
    return new Promise((resolve) => {
        const particles: Particle[] = [];
        const {
            count,
            color,
            minSize,
            maxSize,
            minSpeed,
            maxSpeed,
            minLife,
            maxLife,
            gravity = 0,
            spread = Math.PI * 2,
            fadeOut = true
        } = config;

        // Create particles
        for (let i = 0; i < count; i++) {
            const angle = (Math.random() - 0.5) * spread;
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            const size = minSize + Math.random() * (maxSize - minSize);
            const life = minLife + Math.random() * (maxLife - minLife);
            const particleColor = Array.isArray(color)
                ? color[Math.floor(Math.random() * color.length)]
                : color;

            const graphics = new Graphics();
            graphics.circle(0, 0, size);
            graphics.fill(particleColor);
            graphics.x = x;
            graphics.y = y;
            container.addChild(graphics);

            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life,
                maxLife: life,
                size,
                color: particleColor,
                alpha: 1,
                graphics
            });
        }

        // Animate particles
        const animate = () => {
            let alive = false;

            for (const p of particles) {
                if (p.life <= 0) continue;
                alive = true;

                p.life -= 16; // ~60fps
                p.vy += gravity;
                p.x += p.vx;
                p.y += p.vy;

                p.graphics.x = p.x;
                p.graphics.y = p.y;

                if (fadeOut) {
                    p.graphics.alpha = p.life / p.maxLife;
                }
            }

            if (alive) {
                requestAnimationFrame(animate);
            } else {
                // Cleanup
                for (const p of particles) {
                    container.removeChild(p.graphics);
                    p.graphics.destroy();
                }
                resolve();
            }
        };

        animate();
    });
}

/**
 * Create a continuous particle emitter
 */
export function createParticleEmitter(
    container: Container,
    x: number,
    y: number,
    config: ParticleConfig & { emitRate: number }
): { stop: () => void; setPosition: (x: number, y: number) => void } {
    let running = true;
    let posX = x;
    let posY = y;
    const particles: Particle[] = [];

    const emit = () => {
        if (!running) return;

        const {
            color,
            minSize,
            maxSize,
            minSpeed,
            maxSpeed,
            minLife,
            maxLife,
            gravity = 0,
            spread = Math.PI * 2,
            fadeOut = true
        } = config;

        const angle = (Math.random() - 0.5) * spread - Math.PI / 2;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const size = minSize + Math.random() * (maxSize - minSize);
        const life = minLife + Math.random() * (maxLife - minLife);
        const particleColor = Array.isArray(color)
            ? color[Math.floor(Math.random() * color.length)]
            : color;

        const graphics = new Graphics();
        graphics.circle(0, 0, size);
        graphics.fill(particleColor);
        graphics.x = posX;
        graphics.y = posY;
        container.addChild(graphics);

        particles.push({
            x: posX,
            y: posY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size,
            color: particleColor,
            alpha: 1,
            graphics
        });
    };

    const emitInterval = setInterval(emit, 1000 / config.emitRate);

    const animate = () => {
        if (!running && particles.every(p => p.life <= 0)) return;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (p.life <= 0) {
                container.removeChild(p.graphics);
                p.graphics.destroy();
                particles.splice(i, 1);
                continue;
            }

            p.life -= 16;
            p.vy += config.gravity || 0;
            p.x += p.vx;
            p.y += p.vy;

            p.graphics.x = p.x;
            p.graphics.y = p.y;

            if (config.fadeOut !== false) {
                p.graphics.alpha = p.life / p.maxLife;
            }
        }

        requestAnimationFrame(animate);
    };

    animate();

    return {
        stop: () => {
            running = false;
            clearInterval(emitInterval);
        },
        setPosition: (newX: number, newY: number) => {
            posX = newX;
            posY = newY;
        }
    };
}
