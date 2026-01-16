/**
 * ZOMBIE HUNT — Card Reveal Animation
 * 
 * PixiJS-based card flip animation that reveals duel results
 * with dramatic one-by-one card flipping.
 */

import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { NumberCard } from '../types';
import { easing } from '../animations/effects';

interface CardRevealAnimationProps {
    yourCards: NumberCard[];
    opponentCards: NumberCard[];
    outcome: 'win' | 'lose' | 'draw';
    onComplete: () => void;
}

const CARD_WIDTH = 70;
const CARD_HEIGHT = 100;
const CARD_GAP = 15;
const FLIP_DURATION = 400;
const DELAY_BETWEEN_CARDS = 300;
const RESULT_DELAY = 800;

export function CardRevealAnimation({
    yourCards,
    opponentCards,
    outcome,
    onComplete
}: CardRevealAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const [phase, setPhase] = useState<'flipping' | 'result' | 'done'>('flipping');

    useEffect(() => {
        if (!containerRef.current) return;

        const initApp = async () => {
            const app = new Application();

            await app.init({
                width: containerRef.current!.clientWidth,
                height: containerRef.current!.clientHeight,
                backgroundColor: 0x0a0a0a,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            // Create main container
            const mainContainer = new Container();
            mainContainer.x = app.screen.width / 2;
            mainContainer.y = app.screen.height / 2;
            app.stage.addChild(mainContainer);

            // Create opponent cards row (top)
            const opponentRow = new Container();
            opponentRow.y = -120;
            mainContainer.addChild(opponentRow);

            // Create your cards row (bottom)
            const yourRow = new Container();
            yourRow.y = 120;
            mainContainer.addChild(yourRow);

            // Create labels
            const labelStyle = new TextStyle({
                fontFamily: 'Courier New, monospace',
                fontSize: 14,
                fill: '#666666',
                letterSpacing: 2,
            });

            const opponentLabel = new Text({ text: 'OPPONENT', style: labelStyle });
            opponentLabel.anchor.set(0.5);
            opponentLabel.y = -200;
            mainContainer.addChild(opponentLabel);

            const yourLabel = new Text({ text: 'YOU', style: labelStyle });
            yourLabel.anchor.set(0.5);
            yourLabel.y = 200;
            mainContainer.addChild(yourLabel);

            // Create sum displays - positioned to the right side
            const sumStyle = new TextStyle({
                fontFamily: 'Courier New, monospace',
                fontSize: 48,
                fontWeight: 'bold',
                fill: '#ffffff',
            });

            // Opponent sum on top right
            const opponentSum = new Text({ text: '0', style: sumStyle });
            opponentSum.anchor.set(0.5);
            opponentSum.x = 250;
            opponentSum.y = -60;
            opponentSum.alpha = 0;
            mainContainer.addChild(opponentSum);

            // "VS" text in center
            const vsStyle = new TextStyle({
                fontFamily: 'Courier New, monospace',
                fontSize: 24,
                fontWeight: 'bold',
                fill: '#666666',
            });
            const vsText = new Text({ text: 'VS', style: vsStyle });
            vsText.anchor.set(0.5);
            vsText.x = 250;
            vsText.y = 0;
            vsText.alpha = 0;
            mainContainer.addChild(vsText);

            // Your sum on bottom right
            const yourSum = new Text({ text: '0', style: sumStyle });
            yourSum.anchor.set(0.5);
            yourSum.x = 250;
            yourSum.y = 60;
            yourSum.alpha = 0;
            mainContainer.addChild(yourSum);

            // Create card backs
            const createCardBack = () => {
                const card = new Container();
                const bg = new Graphics();
                bg.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 8);
                bg.fill(0x1a1a2e);
                bg.stroke({ color: 0x4a4a6a, width: 2 });

                // Pattern
                const pattern = new Graphics();
                for (let i = 0; i < 3; i++) {
                    pattern.circle(0, (i - 1) * 20, 5);
                }
                pattern.fill(0x4a4a6a);

                card.addChild(bg, pattern);
                return card;
            };

            // Create card face
            const createCardFace = (numberCard: NumberCard) => {
                const card = new Container();
                const isRed = numberCard.suit === 'hearts' || numberCard.suit === 'diamonds';
                const color = isRed ? 0xff4444 : 0xffffff;

                const bg = new Graphics();
                bg.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 8);
                bg.fill(0xffffff);
                bg.stroke({ color: 0x333333, width: 2 });

                const suitSymbols: Record<string, string> = {
                    hearts: '♥',
                    diamonds: '♦',
                    clubs: '♣',
                    spades: '♠'
                };

                const valueMap: Record<number, string> = {
                    1: 'A', 11: 'J', 12: 'Q', 13: 'K'
                };
                const valueText = valueMap[numberCard.value] || String(numberCard.value);

                const valueStyle = new TextStyle({
                    fontFamily: 'Georgia, serif',
                    fontSize: 24,
                    fontWeight: 'bold',
                    fill: isRed ? '#ff4444' : '#000000',
                });

                const value = new Text({ text: valueText, style: valueStyle });
                value.anchor.set(0.5);
                value.y = -15;

                const suitStyle = new TextStyle({
                    fontFamily: 'Georgia, serif',
                    fontSize: 28,
                    fill: isRed ? '#ff4444' : '#000000',
                });

                const suit = new Text({ text: suitSymbols[numberCard.suit], style: suitStyle });
                suit.anchor.set(0.5);
                suit.y = 20;

                card.addChild(bg, value, suit);
                return card;
            };

            // Position cards
            const positionCards = (cards: NumberCard[], row: Container) => {
                const totalWidth = cards.length * CARD_WIDTH + (cards.length - 1) * CARD_GAP;
                const startX = -totalWidth / 2 + CARD_WIDTH / 2;

                return cards.map((card, i) => {
                    const back = createCardBack();
                    back.x = startX + i * (CARD_WIDTH + CARD_GAP);
                    row.addChild(back);

                    const face = createCardFace(card);
                    face.x = back.x;
                    face.scale.x = 0;
                    face.visible = false;
                    row.addChild(face);

                    return { back, face, card };
                });
            };

            const yourCardObjs = positionCards(yourCards, yourRow);
            const opponentCardObjs = positionCards(opponentCards, opponentRow);

            // Flip animation
            const flipCard = (back: Container, face: Container): Promise<void> => {
                return new Promise((resolve) => {
                    const startTime = Date.now();

                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / FLIP_DURATION, 1);
                        const easedProgress = easing.easeOutCubic(progress);

                        if (progress < 0.5) {
                            // First half: shrink back
                            back.scale.x = 1 - easedProgress * 2;
                        } else {
                            // Second half: show face
                            back.visible = false;
                            face.visible = true;
                            face.scale.x = (easedProgress - 0.5) * 2;
                        }

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            resolve();
                        }
                    };

                    animate();
                });
            };

            // Run reveal sequence
            const runReveal = async () => {
                let yourTotal = 0;
                let opponentTotal = 0;

                const maxCards = Math.max(yourCardObjs.length, opponentCardObjs.length);

                for (let i = 0; i < maxCards; i++) {
                    const flips: Promise<void>[] = [];

                    // Flip your card
                    if (i < yourCardObjs.length) {
                        flips.push(flipCard(yourCardObjs[i].back, yourCardObjs[i].face));
                        yourTotal += yourCardObjs[i].card.value;
                    }

                    // Flip opponent card
                    if (i < opponentCardObjs.length) {
                        flips.push(flipCard(opponentCardObjs[i].back, opponentCardObjs[i].face));
                        opponentTotal += opponentCardObjs[i].card.value;
                    }

                    await Promise.all(flips);

                    // Update sums with animation
                    yourSum.text = String(yourTotal);
                    opponentSum.text = String(opponentTotal);
                    yourSum.alpha = 1;
                    opponentSum.alpha = 1;
                    vsText.alpha = 1;

                    // Pulse effect on sum
                    yourSum.scale.set(1.3);
                    opponentSum.scale.set(1.3);
                    setTimeout(() => {
                        yourSum.scale.set(1);
                        opponentSum.scale.set(1);
                    }, 150);

                    if (i < maxCards - 1) {
                        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CARDS));
                    }
                }

                // Show result
                await new Promise(r => setTimeout(r, RESULT_DELAY));
                setPhase('result');

                // Highlight winner
                const resultStyle = new TextStyle({
                    fontFamily: 'Courier New, monospace',
                    fontSize: 48,
                    fontWeight: 'bold',
                    fill: outcome === 'win' ? '#00ff88' : outcome === 'lose' ? '#ff4444' : '#ffffff',
                    letterSpacing: 4,
                });

                const resultText = new Text({
                    text: outcome.toUpperCase(),
                    style: resultStyle
                });
                resultText.anchor.set(0.5);
                resultText.y = 0;
                resultText.alpha = 0;
                mainContainer.addChild(resultText);

                // Fade in result
                const fadeIn = () => {
                    resultText.alpha = Math.min(resultText.alpha + 0.1, 1);
                    if (resultText.alpha < 1) {
                        requestAnimationFrame(fadeIn);
                    } else {
                        // After showing result, complete
                        setTimeout(() => {
                            setPhase('done');
                            onComplete();
                        }, 1500);
                    }
                };
                fadeIn();
            };

            runReveal();
        };

        initApp();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, [yourCards, opponentCards, outcome, onComplete]);

    return (
        <div
            ref={containerRef}
            className="card-reveal-animation"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
            }}
        />
    );
}
