import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PlayersPage from './pages/PlayersPage'
import LivePage from './pages/LivePage'
import LineupsPage from './pages/LineupsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Navbar />
        <main className="pb-12">
          <Routes>
            {/* Ao Vivo é a tela principal — concentra a maior parte do uso. */}
            <Route path="/" element={<LivePage />} />
            <Route path="/elencos" element={<LineupsPage />} />
            <Route path="/jogadores" element={<PlayersPage />} />
            {/* /live mantido pra não quebrar bookmarks/links antigos. */}
            <Route path="/live" element={<LivePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
