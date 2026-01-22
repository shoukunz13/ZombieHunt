/**
 * ZOMBIE HUNT — Animation Effects
 * 
 * Common visual effects for PixiJS animations.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Screen shake effect
 */
export function shakeScreen(
    container: Container,
    intensity: number = 10,
    duration: number = 500
): Promise<void> {
    return new Promise((resolve) => {
        const startX = container.x;
        const startY = container.y;
        const startTime = Date.now();

        const shake = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                container.x = startX;
                container.y = startY;
                resolve();
                return;
            }

            const currentIntensity = intensity * (1 - progress);
            container.x = startX + (Math.random() - 0.5) * currentIntensity * 2;
            container.y = startY + (Math.random() - 0.5) * currentIntensity * 2;

            requestAnimationFrame(shake);
        };

        shake();
    });
}

/**
 * Fade in effect
 */
export function fadeIn(
    container: Container,
    duration: number = 300
): Promise<void> {
    return new Promise((resolve) => {
        container.alpha = 0;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            container.alpha = progress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        };

        animate();
    });
}

/**
 * Fade out effect
 */
export function fadeOut(
    container: Container,
    duration: number = 300
): Promise<void> {
    return new Promise((resolve) => {
        const startAlpha = container.alpha;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            container.alpha = startAlpha * (1 - progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        };

        animate();
    });
}

/**
 * Scale pulse effect
 */
export function pulseScale(
    container: Container,
    minScale: number = 0.9,
    maxScale: number = 1.1,
    duration: number = 1000,
    loops: number = 1
): Promise<void> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let currentLoop = 0;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const loopProgress = (elapsed % duration) / duration;

            // Sine wave for smooth pulsing
            const scale = minScale + (maxScale - minScale) * (0.5 + 0.5 * Math.sin(loopProgress * Math.PI * 2));
            container.scale.set(scale);

            const newLoop = Math.floor(elapsed / duration);
            if (newLoop > currentLoop) {
                currentLoop = newLoop;
                if (loops > 0 && currentLoop >= loops) {
                    container.scale.set(1);
                    resolve();
                    return;
                }
            }

            requestAnimationFrame(animate);
        };

        animate();
    });
}

/**
 * Glitch text effect
 */
export function createGlitchText(
    text: string,
    style: Partial<TextStyle>
): Container {
    const container = new Container();

    const mainText = new Text({ text, style: new TextStyle(style) });
    mainText.anchor.set(0.5);

    // Red offset layer
    const redText = new Text({
        text,
        style: new TextStyle({ ...style, fill: '#ff0000' })
    });
    redText.anchor.set(0.5);
    redText.alpha = 0.5;
    redText.x = 2;

    // Cyan offset layer
    const cyanText = new Text({
        text,
        style: new TextStyle({ ...style, fill: '#00ffff' })
    });
    cyanText.anchor.set(0.5);
    cyanText.alpha = 0.5;
    cyanText.x = -2;

    container.addChild(cyanText, redText, mainText);

    // Animate glitch
    const glitch = () => {
        if (!container.parent) return;

        if (Math.random() < 0.1) {
            redText.x = (Math.random() - 0.5) * 6;
            redText.y = (Math.random() - 0.5) * 4;
            cyanText.x = (Math.random() - 0.5) * 6;
            cyanText.y = (Math.random() - 0.5) * 4;
        } else {
            redText.x = 2;
            redText.y = 0;
            cyanText.x = -2;
            cyanText.y = 0;
        }

        requestAnimationFrame(glitch);
    };
    glitch();

    return container;
}

/**
 * Draw a playing card shape
 */
export function drawCard(
    graphics: Graphics,
    width: number,
    height: number,
    fillColor: number = 0xffffff,
    strokeColor: number = 0x333333
): void {
    const radius = 8;

    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill(fillColor);
    graphics.stroke({ color: strokeColor, width: 2 });
}

/**
 * Easing functions
 */
export const easing = {
    linear: (t: number) => t,
    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    easeOutElastic: (t: number) => {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },
    easeOutBounce: (t: number) => {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }
};
