/**
 * Zombie Hunt - Main App Component
 * Sets up routing and providers for multi-tenant lobby system.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { SplashScreen } from './screens/SplashScreen';
import { CreateLobbyScreen } from './screens/CreateLobbyScreen';
import { JoinLobbyScreen } from './screens/JoinLobbyScreen';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { DuelScreen } from './screens/DuelScreen';
import { MeetingScreen } from './screens/MeetingScreen';
import { EliminatedScreen } from './screens/EliminatedScreen';
import { EndScreen } from './screens/EndScreen';
import { HostDashboard } from './screens/HostDashboard';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Entry Point */}
                <Route path="/" element={<SplashScreen />} />
                
                {/* Lobby Creation/Join */}
                <Route path="/create" element={<CreateLobbyScreen />} />
                <Route path="/join" element={<JoinLobbyScreen />} />

                {/* Admin dashboard (requires HOST_PIN) */}
                <Route path="/host" element={<HostDashboard />} />

                {/* Host dashboard for specific lobby (requires hostToken) */}
                <Route path="/host/:lobbyCode" element={<HostDashboard />} />

                {/* Player routes wrapped in GameProvider with lobbyCode param */}
                <Route
                    path="/game/:lobbyCode/*"
                    element={
                        <GameProvider>
                            <Routes>
                                <Route path="/" element={<JoinScreen />} />
                                <Route path="/lobby" element={<LobbyScreen />} />
                                <Route path="/duel" element={<DuelScreen />} />
                                <Route path="/meeting" element={<MeetingScreen />} />
                                <Route path="/eliminated" element={<EliminatedScreen />} />
                                <Route path="/end" element={<EndScreen />} />
                                <Route path="*" element={<Navigate to="." replace />} />
                            </Routes>
                        </GameProvider>
                    }
                />

                {/* Catch-all redirect to splash */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
