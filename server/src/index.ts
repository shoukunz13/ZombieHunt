/**
 * Zombie Hunt - Server Entry Point
 * Express + Socket.io server for the game.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CONFIG } from './config';
import { initializeSocketHandlers } from './socketHandlers';

const app = express();
const httpServer = createServer(app);

// Configure CORS for both Express and Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Allow all origins for LAN play
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

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
    console.log(`
╔══════════════════════════════════════════════════════════╗
║              🧟 ZOMBIE HUNT SERVER 🧟                     ║
╠══════════════════════════════════════════════════════════╣
║  Server running on port ${CONFIG.PORT}                          ║
║  Host PIN: ${CONFIG.HOST_PIN}                                    ║
║                                                          ║
║  For LAN play, connect to:                               ║
║  http://<your-local-ip>:${CONFIG.PORT}                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
