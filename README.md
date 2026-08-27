# 🧟 Zombie Hunt

An IRL (In Real Life) multiplayer web game inspired by **Alice in Borderland**. Players join from their phones, form alliances, duel opponents, and try to survive as either humans or zombies!

## 🎮 Game Overview

### Concept
- 4-20 players, divided into teams
- Secret zombies hidden among players
- Players duel each other using cards
- Zombies can infect humans with the Zombie Card
- Humans can kill zombies with Shotguns
- Vaccines can cure infected zombies
- **The side with more survivors at the end wins!**

### Cards
- **Number Cards (1-13)**: Used in duels. Higher value wins.
- **🧟 Zombie Card**: Trumps all number cards and infects the loser.
- **💉 Vaccine Card**: Nullifies a Zombie Card and **cures** the zombie opponent.
- **🔫 Shotgun**: Kills any zombie opponent instantly (wasted on humans).

### Game Flow
1. **Lobby Phase** (Indefinite): Players choose opponents for dueling
2. **Duel Phase** (3 min): All paired players duel simultaneously
3. **Meeting Phase** (1 min): Return to meeting area, see anonymized events
4. Repeat until max rounds or one side wins

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Clone and enter the directory
cd zombie-hunt

# Install all dependencies
npm run install:all
```

### Running for Development

```bash
# Start both server and client concurrently
npm run dev
```

This will start:
- **Server**: http://localhost:3001
- **Client**: http://localhost:3000

### Running on LAN (for phones)

1. Find your local IP address:
   ```bash
   # macOS
   ipconfig getifaddr en0
   
   # Linux
   hostname -I
   
   # Windows
   ipconfig
   ```

2. Start the game:
   ```bash
   npm run dev
   ```

3. On phones, navigate to:
   - Player App: `http://<YOUR-IP>:3000`
   - Host Dashboard: `http://<YOUR-IP>:3000/host`

## 📱 Player Instructions

1. Open `http://<HOST-IP>:3000` on your phone
2. Enter your name and the game code (default: `ZOMBIE`)
3. Wait in the lobby for other players
4. **Leave Game**: Click the leave button if you need to exit before the game starts
5. When the host starts the game, you'll see your role (Human/Zombie)
6. Select an opponent in the lobby
7. Once paired, wait for all players to pair
8. During the duel, choose your action:
   - Play a number card (must match suit if one is already played)
   - Use special cards (Zombie, Vaccine, Shotgun)
9. After duels, return to the meeting area
10. Repeat for all rounds!

### Session Persistence
- **Refresh-safe**: If you refresh or switch tabs, you'll automatically rejoin your game
- **No re-login needed**: Your session is saved until you leave or the game ends

## 🎛️ Host Dashboard

Access: `http://localhost:3000/host`

Default PIN in local development: `1234` (set via `HOST_PIN` environment variable)

### Host Controls
- **Create Game**: Set up a new game with a custom code
- **Start Game**: Begin the game (minimum 4 players)
- **Force Duel**: Manually start duel phase
- **Force Meeting**: End duels early
- **Next Round**: Skip to next round
- **Kick Player**: Remove a player from the game
- **End Game**: Finish the game immediately

### Game Settings (Host Configurable)

| Setting | Range | Description |
|---------|-------|-------------|
| **Max Rounds** | 5-20 | Number of rounds before game ends |
| **Starting Zombies** | 1-8 | Total zombies at game start |
| **Starting Cards** | 5-25 | Number cards per player |
| **Vaccines** | 0-10 | Total vaccines distributed |
| **Shotgun %** | 0-100% | Percentage of players with shotguns |
| **Infections/Zombie** | 0-20 | Max infections per zombie (0=unlimited) |
| **Annihilation Rule** | On/Off | If all become zombies, everyone dies |

### ⚡ Recommended Settings Button
Click to auto-configure balanced settings based on player count:
- **≤8 players**: 1 zombie, 10 cards, 2 vaccines
- **9-12 players**: 2 zombies, 12 cards, 3 vaccines, max 5 infections
- **13-16 players**: 2 zombies, 15 cards, 4 vaccines, max 6 infections
- **17+ players**: 2 zombies, 20 cards, 5 vaccines, max 8 infections

### Host View
- Full visibility of all roles and cards
- Human vs Zombie counts
- Team breakdown
- All duel statuses
- Event log

## ⚙️ Configuration

Edit `server/src/config.ts`:

```typescript
export const CONFIG = {
  PORT: 3001,
  HOST_PIN: process.env.HOST_PIN, // Required in production, 10+ chars recommended
  
  TEAM_COUNT: 4,
  MIN_PLAYERS: 4,
  ROUNDS: 20,
  
  STARTING_NUMBER_CARDS: 10,
  NUMBER_CARD_MAX_VALUE: 13,
  
  DUEL_DURATION_SEC: 180,  // 3 minutes
  MEETING_DURATION_SEC: 60, // 1 minute
  
  VACCINE_RATIO: 0.20,  // 20% of players get vaccines
  
  STEAL_MODE: 'random_number_only',
  NO_SUIT_FALLBACK: 'allow_any',
}
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run bot simulator (stress test)
npm run simulate -- 20  # Simulates 20 bot players
```

## 📂 Project Structure

```
zombie-hunt/
├── package.json          # Root package with scripts
├── server/               # Backend (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── config.ts     # Game configuration
│   │   ├── types.ts      # Type definitions
│   │   ├── gameState.ts  # Game state management
│   │   ├── cards.ts      # Card generation
│   │   ├── duelResolver.ts   # Duel logic
│   │   ├── socketHandlers.ts # Socket.io events
│   │   ├── persistence.ts    # JSON file persistence
│   │   └── *.test.ts     # Unit tests
│   └── package.json
└── client/               # Frontend (React + TypeScript)
    ├── src/
    │   ├── App.tsx       # Main app with routing
    │   ├── index.css     # Global styles
    │   ├── types.ts      # Client types
    │   ├── context/      # React contexts
    │   │   ├── GameContext.tsx  # Player state + session persistence
    │   │   └── HostContext.tsx  # Host dashboard state
    │   ├── components/   # Shared components
    │   │   ├── shared.tsx
    │   │   ├── IntroVideo.tsx
    │   │   ├── EndGameReveal.tsx
    │   │   └── RulebookModal.tsx
    │   └── screens/      # UI screens
    │       ├── JoinScreen.tsx
    │       ├── LobbyScreen.tsx
    │       ├── DuelScreen.tsx
    │       ├── MeetingScreen.tsx
    │       ├── EliminatedScreen.tsx
    │       ├── EndScreen.tsx
    │       └── HostDashboard.tsx
    └── package.json
```

## 🔒 Security & Anti-Cheat

- **Server-Authoritative**: All game logic runs on the server
- The client never sees:
  - Other players' roles
  - Human/Zombie totals until game end
  - Other players' cards
  - Who infected whom (secret until end reveal)
- Server validates:
  - Card ownership before plays
  - Special card usage (can't reuse shotgun)
  - Action timing
  - Infection limits per zombie

## 🌐 Socket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `join_game` | Join a game |
| `rejoin_game` | Rejoin from saved session |
| `leave_game` | Leave game voluntarily (waiting phase only) |
| `lobby_select_opponent` | Select opponent for duel |
| `lobby_cancel_selection` | Cancel current pairing |
| `duel_submit_action` | Submit duel action |

### Server → Client
| Event | Description |
|-------|-------------|
| `joined` | Confirm join with initial state |
| `lobby_update` | Player list updates |
| `phase_change` | Game phase changed |
| `duel_assigned` | Duel partner assigned |
| `duel_resolution` | Duel result |
| `meeting_summary` | Round events |
| `eliminated` | Player eliminated |
| `game_ended` | Final results |

## 🐛 Troubleshooting

### Can't connect from phones
- Ensure firewall allows ports 3000 and 3001
- Use the correct LAN IP (not localhost)
- Check that server is running with `0.0.0.0` binding

### Public deployment startup fails
- Set `NODE_ENV=production`
- Set `HOST_PIN` to a strong value (minimum 10 chars)
- Set `ALLOWED_ORIGINS` to your exact frontend origin(s), comma-separated

### Game state corrupted
- Delete `game_state.json` in the server folder
- Restart the server

### Players disconnecting
- **Session Persistence**: Players auto-reconnect if they refresh or switch tabs
- Disconnected players will auto-play their lowest valid card
- They can rejoin with the same name to reconnect

## 📜 License

MIT

---

**Have fun hunting! 🧟‍♂️🔫**
