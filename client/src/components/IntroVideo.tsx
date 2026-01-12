/**
 * ZOMBIE HUNT — Intro Video Component
 * 
 * Fullscreen video player for host dashboard
 * Plays game instructions video before game starts
 * Video file: /public/videos/intro.mp4
 */

import { useRef, useState, useCallback } from 'react';

interface IntroVideoProps {
    onComplete: () => void;
}

export function IntroVideo({ onComplete }: IntroVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasCompletedRef = useRef(false);
    const [isEnded, setIsEnded] = useState(false);
    const [error, setError] = useState(false);

    // Memoize complete handler to ensure it only fires once
    const triggerComplete = useCallback(() => {
        if (hasCompletedRef.current) return;
        hasCompletedRef.current = true;
        setIsEnded(true);
        console.log('IntroVideo: Triggering onComplete');
        // Small delay before calling onComplete to let the last frame show
        setTimeout(onComplete, 500);
    }, [onComplete]);

    const handleVideoEnd = () => {
        console.log('IntroVideo: onEnded fired');
        triggerComplete();
    };

    // Fallback: check if video reached near-end via timeupdate
    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (video && video.duration > 0) {
            // If within 0.5 seconds of end, trigger complete
            if (video.currentTime >= video.duration - 0.5) {
                console.log('IntroVideo: Near end via timeupdate');
                triggerComplete();
            }
        }
    };

    const handleVideoError = () => {
        console.error('Failed to load intro video');
        setError(true);
    };

    const handleSkip = () => {
        if (videoRef.current) {
            videoRef.current.pause();
        }
        triggerComplete();
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
                onTimeUpdate={handleTimeUpdate}
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
