import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';
import Stats from './pages/Stats';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout fullScreen><Home /></Layout>} />
        <Route path="/play" element={<Layout fullScreen><Game /></Layout>} />
        <Route path="/leaderboard" element={<Layout><Leaderboard /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
        <Route path="/stats" element={<Layout><Stats /></Layout>} />
      </Routes>
    </HashRouter>
  );
}
