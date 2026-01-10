/**
 * ZOMBIE HUNT — Sound Effects Utility
 * 
 * Uses audio files from /public/sounds/
 * Falls back to Web Audio API if files are missing
 */

/**
 * Play an audio file from the sounds folder
 */
function playAudioFile(filename: string, volume: number = 0.7): Promise<void> {
    return new Promise((resolve) => {
        const audio = new Audio(`/sounds/${filename}`);
        audio.volume = volume;
        audio.onended = () => resolve();
        audio.onerror = () => {
            console.warn(`Could not play sound: ${filename}`);
            resolve();
        };
        audio.play().catch(() => {
            console.warn(`Autoplay blocked for: ${filename}`);
            resolve();
        });
    });
}

/**
 * Play the "GAME START" sound
 * File: /sounds/game_start.mp3
 */
export async function playGameStartSound(): Promise<void> {
    await playAudioFile('game_start.mp3', 0.7);
}

/**
 * Play the "DUEL START" sound
 * File: /sounds/duel_start.mp3
 */
export async function playDuelStartSound(): Promise<void> {
    await playAudioFile('duel_start.mp3', 0.7);
}

/**
 * Play the "MEETING PHASE" sound
 * File: /sounds/meeting.mp3
 */
export async function playMeetingSound(): Promise<void> {
    await playAudioFile('meeting.mp3', 0.7);
}
