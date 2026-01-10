/**
 * Zombie Hunt - Main App Component
 * Sets up routing and providers.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
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
                {/* Host dashboard has its own provider */}
                <Route path="/host" element={<HostDashboard />} />

                {/* Player routes wrapped in GameProvider */}
                <Route
                    path="/*"
                    element={
                        <GameProvider>
                            <Routes>
                                <Route path="/" element={<JoinScreen />} />
                                <Route path="/lobby" element={<LobbyScreen />} />
                                <Route path="/duel" element={<DuelScreen />} />
                                <Route path="/meeting" element={<MeetingScreen />} />
                                <Route path="/eliminated" element={<EliminatedScreen />} />
                                <Route path="/end" element={<EndScreen />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </GameProvider>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
