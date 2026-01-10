/**
 * ZOMBIE HUNT — Intro Video Component
 * 
 * Fullscreen video player for host dashboard
 * Plays game instructions video before game starts
 * Video file: /public/videos/intro.mp4
 */

import { useRef, useState } from 'react';

interface IntroVideoProps {
    onComplete: () => void;
}

export function IntroVideo({ onComplete }: IntroVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isEnded, setIsEnded] = useState(false);
    const [error, setError] = useState(false);

    const handleVideoEnd = () => {
        setIsEnded(true);
        // Small delay before calling onComplete to let the last frame show
        setTimeout(onComplete, 500);
    };

    const handleVideoError = () => {
        console.error('Failed to load intro video');
        setError(true);
    };

    const handleSkip = () => {
        if (videoRef.current) {
            videoRef.current.pause();
        }
        onComplete();
    };

    // If video failed to load, show error and allow skip
    if (error) {
        return (
            <div className="intro-video-container">
                <div className="intro-video-error">
                    <h2>VIDEO NOT FOUND</h2>
                    <p>Place intro.mp4 in /public/videos/</p>
                    <button className="btn btn-primary" onClick={onComplete}>
                        CONTINUE WITHOUT VIDEO
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="intro-video-container">
            <video
                ref={videoRef}
                className="intro-video"
                autoPlay
                playsInline
                onEnded={handleVideoEnd}
                onError={handleVideoError}
            >
                <source src="/videos/intro.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Skip button - always visible but subtle */}
            {!isEnded && (
                <button
                    className="intro-video-skip"
                    onClick={handleSkip}
                >
                    SKIP VIDEO →
                </button>
            )}

            {/* Loading overlay until video starts */}
            <div className="intro-video-loading">
                LOADING...
            </div>
        </div>
    );
}
