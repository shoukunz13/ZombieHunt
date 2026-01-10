# 🧟 Zombie Hunt

An IRL (In Real Life) multiplayer web game inspired by **Alice in Borderland**. Players join from their phones, form alliances, duel opponents, and try to survive as either humans or zombies!

## 🎮 Game Overview

### Concept
- 20 players, divided into 4 teams
- Each team has ONE secret zombie
- Players duel each other using cards
- Zombies can infect humans with the Zombie Card
- Humans can kill zombies with Shotguns
- Vaccines can cure infections
- **The side with more survivors at Round 20 wins!**

### Cards
- **Number Cards (1-13)**: Used in duels. Higher value wins.
- **🧟 Zombie Card**: Trumps all number cards and infects the loser.
- **💉 Vaccine Card**: Nullifies a Zombie Card and cures the opponent.
- **🔫 Shotgun**: Kills any zombie opponent instantly (wasted on humans).

### Game Flow
1. **Lobby Phase** (Indefinite): Players choose opponents for dueling
2. **Duel Phase** (3 min): All paired players duel simultaneously
3. **Meeting Phase** (1 min): Return to meeting area, see anonymized events
4. Repeat for 20 rounds

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
4. When the host starts the game, you'll see your role (Human/Zombie)
5. Select an opponent in the lobby
6. Once paired, wait for all players to pair
7. During the duel, choose your action:
   - Play a number card (must match suit if one is already played)
   - Use special cards (Zombie, Vaccine, Shotgun)
8. After duels, return to the meeting area
9. Repeat for 20 rounds!

## 🎛️ Host Dashboard

Access: `http://localhost:3000/host`

Default PIN: `1234` (set via `HOST_PIN` environment variable)

### Host Controls
- **Start Game**: Begin the game (minimum 6 players)
- **Force Duel**: Manually start duel phase
- **Force Meeting**: End duels early
- **Next Round**: Skip to next round
- **Kick Player**: Remove a player from the game

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
  HOST_PIN: '1234',
  
  TEAM_COUNT: 4,
  MIN_PLAYERS: 6,
  ROUNDS: 20,
  
  STARTING_NUMBER_CARDS: 7,
  NUMBER_CARD_MAX_VALUE: 13,
  
  DUEL_DURATION_SEC: 180,  // 3 minutes
  MEETING_DURATION_SEC: 60, // 1 minute
  
  VACCINE_RATIO: 0.25,  // 25% of players get vaccines
  
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
│   │   ├── simulator.ts      # Bot simulator
│   │   └── *.test.ts     # Unit tests
│   └── package.json
└── client/               # Frontend (React + TypeScript)
    ├── src/
    │   ├── App.tsx       # Main app with routing
    │   ├── index.css     # Global styles
    │   ├── types.ts      # Client types
    │   ├── context/      # React contexts
    │   │   ├── GameContext.tsx
    │   │   └── HostContext.tsx
    │   ├── components/   # Shared components
    │   │   └── shared.tsx
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
- Server validates:
  - Card ownership before plays
  - Special card usage (can't reuse shotgun)
  - Action timing

## 🌐 Socket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `join_game` | Join/rejoin a game |
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

### Game state corrupted
- Delete `game_state.json` in the server folder
- Restart the server

### Players disconnecting
- Disconnected players will auto-play their lowest valid card
- They can rejoin with the same name to reconnect

## 📜 License

MIT

---

**Have fun hunting! 🧟‍♂️🔫**
