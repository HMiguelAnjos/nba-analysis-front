import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PlayersPage from './pages/PlayersPage'
import LivePage from './pages/LivePage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Navbar />
        <main className="pb-12">
          <Routes>
            <Route path="/" element={<PlayersPage />} />
            <Route path="/live" element={<LivePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
