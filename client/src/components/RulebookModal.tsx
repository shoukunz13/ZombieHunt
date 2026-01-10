/**
 * ZOMBIE HUNT — Rulebook Modal
 * 
 * Fullscreen modal with game rules and guide
 * Players can open this from any screen to reference the rules
 */

import { useState } from 'react';

interface RulebookModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function RulebookModal({ isOpen, onClose }: RulebookModalProps) {
    const [activeSection, setActiveSection] = useState(0);

    if (!isOpen) return null;

    const sections = [
        {
            title: 'OVERVIEW',
            content: (
                <>
                    <p className="mb-md">
                        <strong>Zombie Hunt</strong> is a social deduction card game.
                        Players are divided into teams, with <span style={{ color: 'var(--accent-red)' }}>one infected zombie</span> secretly
                        placed on each team.
                    </p>
                    <p className="mb-md">
                        <strong>Goal:</strong> Survivors must identify and eliminate the zombies.
                        Zombies must infect all survivors on their team.
                    </p>
                    <p>
                        The game progresses through rounds of duels followed by discussion meetings.
                    </p>
                </>
            )
        },
        {
            title: 'ROLES',
            content: (
                <>
                    <div className="mb-lg">
                        <h4 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
                            🧑 SURVIVOR
                        </h4>
                        <p>
                            Your goal is to survive and help eliminate the zombie on your team.
                            Win duels to stay in the game and gather information about who might be infected.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--accent-red)', marginBottom: 'var(--space-sm)' }}>
                            🧟 INFECTED
                        </h4>
                        <p>
                            You appear as a survivor but are secretly a zombie.
                            Use your <strong>Zombie Card</strong> during duels to infect opponents.
                            Win by infecting all survivors on your team.
                        </p>
                    </div>
                </>
            )
        },
        {
            title: 'DUELS',
            content: (
                <>
                    <p className="mb-md">
                        Each round, players pair up for duels.
                        <strong> Click on an opponent's name</strong> to send a duel invite.
                    </p>
                    <div className="mb-md">
                        <h4 style={{ marginBottom: 'var(--space-sm)' }}>Playing Cards:</h4>
                        <ul style={{ paddingLeft: 'var(--space-lg)' }}>
                            <li>Select 1-5 cards of the <strong>same suit</strong></li>
                            <li>Card values are summed together</li>
                            <li>Higher total wins the duel</li>
                            <li>Loser gives one card to the winner</li>
                        </ul>
                    </div>
                    <p style={{ color: 'var(--accent-red)' }}>
                        ⚠️ If you run out of cards, you are <strong>eliminated</strong>!
                    </p>
                </>
            )
        },
        {
            title: 'SPECIAL CARDS',
            content: (
                <>
                    <div className="mb-lg">
                        <h4 style={{ color: 'var(--accent-red)', marginBottom: 'var(--space-sm)' }}>
                            🧟 ZOMBIE CARD
                        </h4>
                        <p>
                            <strong>Infected only.</strong> Play this to infect your opponent,
                            converting them to a zombie. The newly infected gains a zombie card too.
                        </p>
                    </div>
                    <div className="mb-lg">
                        <h4 style={{ color: 'var(--success)', marginBottom: 'var(--space-sm)' }}>
                            💉 VACCINE CARD
                        </h4>
                        <p>
                            Cures zombie infection! If played against a zombie using their zombie card,
                            the vaccine cures you and you remain human.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--warning)', marginBottom: 'var(--space-sm)' }}>
                            🔫 SHOTGUN
                        </h4>
                        <p>
                            <strong>One-time use.</strong> Instantly eliminates a zombie opponent.
                            But if used on a human, it's wasted!
                        </p>
                    </div>
                </>
            )
        },
        {
            title: 'WINNING',
            content: (
                <>
                    <div className="mb-lg">
                        <h4 style={{ color: 'var(--success)', marginBottom: 'var(--space-sm)' }}>
                            🏆 SURVIVORS WIN IF:
                        </h4>
                        <ul style={{ paddingLeft: 'var(--space-lg)' }}>
                            <li>All zombies are eliminated</li>
                            <li>At least one survivor remains</li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--accent-red)', marginBottom: 'var(--space-sm)' }}>
                            💀 ZOMBIES WIN IF:
                        </h4>
                        <ul style={{ paddingLeft: 'var(--space-lg)' }}>
                            <li>All survivors on their team are infected or eliminated</li>
                            <li>The infection spreads to everyone</li>
                        </ul>
                    </div>
                </>
            )
        }
    ];

    return (
        <div
            className="result-overlay"
            style={{
                background: 'rgba(0, 0, 0, 0.95)',
                justifyContent: 'flex-start',
                padding: 'var(--space-lg)',
                overflowY: 'auto'
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div style={{
                width: '100%',
                maxWidth: '600px',
                margin: '0 auto'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <h1 className="heading-display" style={{ fontSize: 'var(--font-size-2xl)' }}>
                        📖 RULEBOOK
                    </h1>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onClose}
                    >
                        CLOSE
                    </button>
                </div>

                {/* Section Tabs */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-xs)',
                    marginBottom: 'var(--space-lg)',
                    overflowX: 'auto',
                    paddingBottom: 'var(--space-sm)'
                }}>
                    {sections.map((section, index) => (
                        <button
                            key={section.title}
                            className={`btn btn-sm ${activeSection === index ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveSection(index)}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>

                {/* Active Section Content */}
                <div className="card" style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: 'var(--space-lg)'
                }}>
                    <h2 className="heading-display mb-lg" style={{ fontSize: 'var(--font-size-lg)' }}>
                        {sections[activeSection].title}
                    </h2>
                    <div style={{ lineHeight: '1.6' }}>
                        {sections[activeSection].content}
                    </div>
                </div>

                {/* Navigation Hint */}
                <p className="text-muted text-center mt-lg" style={{ fontSize: 'var(--font-size-xs)' }}>
                    Tap outside or press CLOSE to return to the game
                </p>
            </div>
        </div>
    );
}

/**
 * Rulebook Button - Fixed position button to open rulebook
 */
interface RulebookButtonProps {
    onClick: () => void;
}

export function RulebookButton({ onClick }: RulebookButtonProps) {
    return (
        <button
            className="btn btn-secondary"
            onClick={onClick}
            style={{
                position: 'fixed',
                bottom: 'var(--space-lg)',
                right: 'var(--space-lg)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-lg)',
                zIndex: 100,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
            title="Open Rulebook"
        >
            📖
        </button>
    );
}
