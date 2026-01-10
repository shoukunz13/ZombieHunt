/**
 * Shared Components
 */

import React, { useEffect, useState } from 'react';
import { NumberCard, Suit } from '../types';

// ============ Connection Status ============

interface ConnectionStatusProps {
    isConnected: boolean;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
    return (
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="connection-dot"></span>
            {isConnected ? 'Connected' : 'Disconnected'}
        </div>
    );
}

// ============ Timer ============

interface TimerProps {
    endsAt: number;
}

export function Timer({ endsAt }: TimerProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const update = () => {
            const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
            setTimeLeft(remaining);
        };

        update();
        const interval = setInterval(update, 1000);

        return () => clearInterval(interval);
    }, [endsAt]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    let className = 'timer';
    if (timeLeft <= 10) className += ' danger';
    else if (timeLeft <= 30) className += ' warning';

    return (
        <div className={className}>
            {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
    );
}

// ============ Playing Card ============

interface PlayingCardProps {
    card: NumberCard;
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const suitSymbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
};

export function PlayingCardComponent({ card, selected, onClick, disabled }: PlayingCardProps) {
    return (
        <div
            className={`playing-card ${card.suit} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
        >
            <span className="value">{card.value}</span>
            <span className="suit">{suitSymbols[card.suit]}</span>
        </div>
    );
}

// ============ Special Card ============

interface SpecialCardProps {
    type: 'zombie' | 'vaccine' | 'shotgun';
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const specialIcons: Record<string, string> = {
    zombie: '🧟',
    vaccine: '💉',
    shotgun: '🔫',
};

const specialLabels: Record<string, string> = {
    zombie: 'Zombie',
    vaccine: 'Vaccine',
    shotgun: 'Shotgun',
};

export function SpecialCardComponent({ type, selected, onClick, disabled }: SpecialCardProps) {
    return (
        <div
            className={`special-card ${type} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
            style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
            <span style={{ fontSize: '24px' }}>{specialIcons[type]}</span>
            <span>{specialLabels[type]}</span>
        </div>
    );
}

// ============ Role Badge ============

interface RoleBadgeProps {
    role: 'human' | 'zombie';
}

export function RoleBadge({ role }: RoleBadgeProps) {
    return (
        <div className={`role-badge role-${role}`}>
            {role === 'zombie' ? '🧟 Zombie' : '👤 Human'}
        </div>
    );
}

// ============ Status Badge ============

interface StatusBadgeProps {
    status: 'alive' | 'dead' | 'paired' | 'waiting';
    label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
    return (
        <span className={`status-badge status-${status}`}>
            {label || status}
        </span>
    );
}

// ============ Special Icons ============

interface SpecialIconsProps {
    hasZombie: boolean;
    hasVaccine: boolean;
    hasShotgun: boolean;
}

export function SpecialIcons({ hasZombie, hasVaccine, hasShotgun }: SpecialIconsProps) {
    return (
        <div className="special-icons">
            <span className={`special-icon zombie ${!hasZombie ? 'inactive' : ''}`}>🧟</span>
            <span className={`special-icon vaccine ${!hasVaccine ? 'inactive' : ''}`}>💉</span>
            <span className={`special-icon shotgun ${!hasShotgun ? 'inactive' : ''}`}>🔫</span>
        </div>
    );
}

// ============ Event Item ============

interface EventItemProps {
    type: string;
    message: string;
}

const eventIcons: Record<string, string> = {
    infection: '🦠',
    cure: '💊',
    shotgun_fired: '🔫',
    elimination: '💀',
    round_start: '🎮',
    round_end: '🏁',
};

export function EventItem({ type, message }: EventItemProps) {
    return (
        <div className="event-item">
            <span className="event-icon">{eventIcons[type] || '📢'}</span>
            <span>{message}</span>
        </div>
    );
}

// ============ Modal ============

interface ModalProps {
    title: string;
    children: React.ReactNode;
    onClose?: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">{title}</h2>
                {children}
            </div>
        </div>
    );
}

// ============ Loading Spinner ============

export function Spinner() {
    return <div className="spinner"></div>;
}
