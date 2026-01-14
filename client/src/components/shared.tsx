/**
 * ZOMBIE HUNT — Shared Components
 * Alice in Borderland Theme
 * 
 * Minimalist, oppressive, high-contrast
 */

import { NumberCard } from '../types';

/* ============================================
   CONNECTION STATUS
   ============================================ */
export function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
                className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}
            />
            <span className="text-system" style={{ fontSize: '0.625rem' }}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
        </div>
    );
}

/* ============================================
   TIMER — Large aggressive countdown
   ============================================ */
export function Timer({ endsAt }: { endsAt: number }) {
    const [timeLeft, setTimeLeft] = useState(Math.max(0, endsAt - Date.now()));

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, endsAt - Date.now());
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 100);
        return () => clearInterval(interval);
    }, [endsAt]);

    const seconds = Math.ceil(timeLeft / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const isWarning = seconds <= 10;

    return (
        <div className={`timer ${isWarning ? 'warning' : ''}`}>
            {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
    );
}

import { useState, useEffect, ReactNode } from 'react';

/* ============================================
   PLAYING CARD — Classified document style
   ============================================ */
export function PlayingCardComponent({
    card,
    selected = false,
    disabled = false,
    size = 'md',
    onClick
}: {
    card: NumberCard;
    selected?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}) {
    const suitSymbol = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
    }[card.suit];

    const valueDisplay = card.value === 1 ? 'A' :
        card.value === 11 ? 'J' :
            card.value === 12 ? 'Q' :
                card.value === 13 ? 'K' :
                    String(card.value);

    const suitClass = `suit-${card.suit}`;

    return (
        <div
            className={`playing-card ${suitClass} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} size-${size}`}
            style={size === 'sm' ? { width: '40px', height: '60px', fontSize: '0.8rem' } : undefined}
            onClick={disabled ? undefined : onClick}
        >
            <span className="playing-card-value">{valueDisplay}</span>
            <span className="playing-card-suit">{suitSymbol}</span>
        </div>
    );
}

/* ============================================
   SPECIAL CARD — Red highlighted
   ============================================ */
export function SpecialCardComponent({
    type,
    selected = false,
    disabled = false,
    onClick
}: {
    type: 'zombie' | 'vaccine' | 'shotgun';
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
}) {
    const config = {
        zombie: { icon: '☠', label: 'INFECT' },
        vaccine: { icon: '✚', label: 'CURE' },
        shotgun: { icon: '×', label: 'KILL' }
    }[type];

    return (
        <div
            className={`special-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
        >
            <span className="special-card-icon">{config.icon}</span>
            <span className="special-card-label">{config.label}</span>
        </div>
    );
}

/* ============================================
   ROLE BADGE
   ============================================ */
export function RoleBadge({ role }: { role: 'human' | 'zombie' }) {
    return (
        <span className={`role-badge ${role}`}>
            {role === 'zombie' ? 'INFECTED' : 'SURVIVOR'}
        </span>
    );
}

/* ============================================
   STATUS BADGE
   ============================================ */
export function StatusBadge({
    status,
    label
}: {
    status: 'alive' | 'dead' | 'paired' | 'waiting';
    label: string;
}) {
    return (
        <span className={`status-badge ${status}`}>
            {label}
        </span>
    );
}

/* ============================================
   SPECIAL ICONS — Minimal indicators
   ============================================ */
export function SpecialIcons({
    hasZombie,
    hasVaccine,
    hasShotgun
}: {
    hasZombie: boolean;
    hasVaccine: boolean;
    hasShotgun: boolean;
}) {
    if (!hasZombie && !hasVaccine && !hasShotgun) {
        return <span className="text-muted">—</span>;
    }

    return (
        <span style={{
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.25em',
            color: 'var(--accent-red)'
        }}>
            {hasZombie && '☠'}
            {hasVaccine && '✚'}
            {hasShotgun && '×'}
        </span>
    );
}

/* ============================================
   EVENT ITEM — Anonymous, text-only
   ============================================ */
export function EventItem({
    type,
    message
}: {
    type: string;
    message: string;
}) {
    const isDanger = type === 'elimination' || type === 'infection' || type === 'shotgun_kill';

    return (
        <div className={`event-item ${isDanger ? 'danger' : ''}`}>
            {message}
        </div>
    );
}

/* ============================================
   MODAL — Sharp, high contrast
   ============================================ */
export function Modal({
    title,
    children,
    onClose
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">{title}</div>
                {children}
            </div>
        </div>
    );
}

/* ============================================
   SPINNER
   ============================================ */
export function Spinner() {
    return <div className="spinner" />;
}

/* ============================================
   SYSTEM MESSAGE — Uppercase, intimidating
   ============================================ */
export function SystemMessage({ children }: { children: ReactNode }) {
    return (
        <p className="text-system" style={{ textAlign: 'center' }}>
            {children}
        </p>
    );
}

/* ============================================
   DISPLAY TITLE — Large, aggressive
   ============================================ */
export function DisplayTitle({
    children,
    size = '2xl'
}: {
    children: ReactNode;
    size?: 'xl' | '2xl' | '3xl' | '4xl' | 'massive';
}) {
    return (
        <h1
            className="heading-display"
            style={{ fontSize: `var(--font-size-${size})` }}
        >
            {children}
        </h1>
    );
}
