/**
 * Zombie Hunt - Server Entry Point
 * Express + Socket.io server for the game.
 * 
 * Multi-tenant architecture: Supports multiple concurrent lobbies.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { CONFIG } from './config';
import { initializeSocketHandlers } from './socketHandlers';
import * as lobbyManager from './lobbyManager';

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

// Trust proxy for correct IP detection behind Nginx/Cloudflare
// Set to 1 for single proxy, or 'loopback' for localhost only
if (!isDevelopment) {
    app.set('trust proxy', 1);
}

// Connection tracking for DoS prevention
const connectionsPerIP = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 10;

// Metrics tracking
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalEvents: 0,
    rateLimitBlocks: 0,
};

// Normalize IP addresses (handle IPv6 localhost, proxied IPs)
function normalizeIP(ip: string): string {
    // Normalize localhost variations
    if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
        return 'localhost';
    }
    // Remove IPv6 prefix if present
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
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
    connectTimeout: 10000,  // 10 sec connection timeout
    pingTimeout: 5000,      // 5 sec ping timeout
    pingInterval: 10000,    // 10 sec ping interval
});

// Connection limiting middleware
io.use((socket, next) => {
    const rawIP = socket.handshake.address;
    const ip = normalizeIP(rawIP);
    const currentCount = connectionsPerIP.get(ip) || 0;

    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
        console.log(`[SECURITY] Connection rejected - IP ${ip} exceeded ${MAX_CONNECTIONS_PER_IP} connections`);
        next(new Error('Too many connections from this IP'));
        return;
    }

    connectionsPerIP.set(ip, currentCount + 1);
    metrics.totalConnections++;
    metrics.activeConnections++;

    socket.on('disconnect', () => {
        const count = connectionsPerIP.get(ip) || 1;
        if (count <= 1) {
            connectionsPerIP.delete(ip);
        } else {
            connectionsPerIP.set(ip, count - 1);
        }
        metrics.activeConnections--;
    });

    next();
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
app.get('/health', (_req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        lobbies: lobbyManager.getLobbyCount(),
    });
});

// API endpoint to get server info
app.get('/api/info', (_req, res) => {
    res.json({
        serverTime: Date.now(),
        config: {
            minPlayers: CONFIG.MIN_PLAYERS,
            rounds: CONFIG.ROUNDS,
            duelDuration: CONFIG.DUEL_DURATION_SEC,
            meetingDuration: CONFIG.MEETING_DURATION_SEC,
            maxLobbies: lobbyManager.MAX_LOBBIES,
            maxPlayersPerLobby: lobbyManager.MAX_PLAYERS_PER_LOBBY,
        },
    });
});

// Metrics endpoint (protected in production)
app.get('/api/metrics', (req, res) => {
    if (!isDevelopment && req.headers['x-metrics-key'] !== process.env.METRICS_KEY) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    res.json({
        ...metrics,
        lobbyCount: lobbyManager.getLobbyCount(),
        connectionsPerIPCount: connectionsPerIP.size,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
    });
});

// Initialize Socket.io handlers with metrics reference
initializeSocketHandlers(io, metrics);

// Start lobby cleanup interval
lobbyManager.startCleanupInterval();

// Start server
httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
    const pinDisplay = isDevelopment ? CONFIG.HOST_PIN : '[SET VIA HOST_PIN ENV]';
    console.log(`
╔══════════════════════════════════════════════════════════╗
║              🧟 ZOMBIE HUNT SERVER 🧟                     ║
╠══════════════════════════════════════════════════════════╣
║  Server running on port ${CONFIG.PORT}                          ║
║  Admin PIN: ${pinDisplay}                                   ║
║  Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}                              ║
║  Max connections/IP: ${MAX_CONNECTIONS_PER_IP}                              ║
║  Max lobbies: ${lobbyManager.MAX_LOBBIES}                                     ║
║                                                          ║
║  Multi-tenant: Anyone can create lobbies                 ║
║  Admin dashboard: /host (requires PIN)                   ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    lobbyManager.stopCleanupInterval();
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Export metrics for other modules
export { metrics };
