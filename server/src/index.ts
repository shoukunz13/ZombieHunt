/**
 * Zombie Hunt - Server Entry Point
 * Express + Socket.io server for the game.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { CONFIG } from './config';
import { initializeSocketHandlers } from './socketHandlers';

const app = express();
const httpServer = createServer(app);

// Parse allowed origins from environment or use defaults
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

// In development, allow all origins for LAN testing
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
    // Allow any origin in development for LAN play
    ALLOWED_ORIGINS.push('*');
}

// Configure CORS for both Express and Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: isDevelopment ? '*' : (origin, callback) => {
            if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS not allowed'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    maxHttpBufferSize: 1e5, // 100kb max payload
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for game
}));

// CORS middleware with same origin checking
app.use(cors({
    origin: isDevelopment ? '*' : ALLOWED_ORIGINS,
    credentials: true,
}));

// JSON parsing with size limit
app.use(express.json({ limit: '10kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// API endpoint to get server info
app.get('/api/info', (req, res) => {
    res.json({
        serverTime: Date.now(),
        config: {
            minPlayers: CONFIG.MIN_PLAYERS,
            rounds: CONFIG.ROUNDS,
            duelDuration: CONFIG.DUEL_DURATION_SEC,
            meetingDuration: CONFIG.MEETING_DURATION_SEC,
        },
    });
});

// Initialize Socket.io handlers
initializeSocketHandlers(io);

// Start server
httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
    const pinDisplay = isDevelopment ? CONFIG.HOST_PIN : '[SET VIA HOST_PIN ENV]';
    console.log(`
╔══════════════════════════════════════════════════════════╗
║              🧟 ZOMBIE HUNT SERVER 🧟                     ║
╠══════════════════════════════════════════════════════════╣
║  Server running on port ${CONFIG.PORT}                          ║
║  Host PIN: ${pinDisplay}                                    ║
║  Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}                              ║
║                                                          ║
║  For LAN play, connect to:                               ║
║  http://<your-local-ip>:${CONFIG.PORT}                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

