/**
 * ZOMBIE HUNT — PixiJS Canvas Wrapper
 * 
 * Reusable component that creates a PixiJS application
 * and manages its lifecycle.
 */

import { useRef, useEffect, ReactNode } from 'react';
import { Application, Container } from 'pixi.js';

interface PixiCanvasProps {
    width?: number;
    height?: number;
    backgroundColor?: number;
    className?: string;
    onApp?: (app: Application) => void;
    children?: ReactNode;
}

export function PixiCanvas({
    width,
    height,
    backgroundColor = 0x000000,
    className = '',
    onApp
}: PixiCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const initApp = async () => {
            const app = new Application();

            await app.init({
                width: width || containerRef.current!.clientWidth,
                height: height || containerRef.current!.clientHeight,
                backgroundColor,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            if (onApp) {
                onApp(app);
            }

            // Handle resize
            const handleResize = () => {
                if (!containerRef.current || !app) return;
                const newWidth = width || containerRef.current.clientWidth;
                const newHeight = height || containerRef.current.clientHeight;
                app.renderer.resize(newWidth, newHeight);
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        };

        initApp();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, [width, height, backgroundColor, onApp]);

    return (
        <div
            ref={containerRef}
            className={`pixi-canvas ${className}`}
            style={{
                width: width || '100%',
                height: height || '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
        />
    );
}

/**
 * Create a centered container within a PixiJS app
 */
export function createCenteredContainer(app: Application): Container {
    const container = new Container();
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
    app.stage.addChild(container);
    return container;
}
