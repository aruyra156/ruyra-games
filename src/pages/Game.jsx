import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'

// Games
import MemoriaGrid from '../components/games/MemoriaGrid'
import Stack from '../components/games/Stack'
import PianoTiles from '../components/games/PianoTiles'
import ZigZag from '../components/games/ZigZag'
import AA from '../components/games/AA'

const GAME_COMPONENTS = {
  memoria: MemoriaGrid,
  stack: Stack,
  piano: PianoTiles,
  zigzag: ZigZag,
  aa: AA,
}

export default function Game() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { bet, roomId, seed, gameId = 'memoria' } = state ?? {}
  const user = useUser()
  const [myScore, setMyScore] = useState(null)
  const [rivals, setRivals] = useState([])
  const [waitingDots, setWaitingDots] = useState('.')
  const pollRef = useRef(null)
  const dotsRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    dotsRef.current = setInterval(() => {
      setWaitingDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(dotsRef.current)
  }, [])

  const handleFinish = async (score) => {
    setMyScore(score)
    clearInterval(dotsRef.current)

    await supabase
      .from('room_players')
      .update({ score, finished_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user?.id)

    pollRef.current = setInterval(async () => {
      const { data: players } = await supabase
        .from('room_players')
        .select('user_id, score, finished_at')
        .eq('room_id', roomId)

      const others = (players ?? []).filter(p => p.user_id !== user?.id)
      setRivals(others)

      const total = players?.length ?? 0
      const finished = players?.filter(p => p.score !== null).length ?? 0

      if (finished >= total && total >= (bet?.players ?? 3) && !doneRef.current) {
        doneRef.current = true
        clearInterval(pollRef.current)
        navigate('/results', { state: { bet, roomId, players, myUserId: user?.id } })
      }
    }, 2000)
  }

  useEffect(() => {
    if (myScore === null) return
    const timeout = setTimeout(async () => {
      if (doneRef.current) return
      doneRef.current = true
      clearInterval(pollRef.current)
      const { data: players } = await supabase
        .from('room_players').select('user_id, score, finished_at').eq('room_id', roomId)
      navigate('/results', { state: { bet, roomId, players: players ?? [], myUserId: user?.id } })
    }, 45000)
    return () => clearTimeout(timeout)
  }, [myScore])

  useEffect(() => () => clearInterval(pollRef.current), [])

  const GameComponent = GAME_COMPONENTS[gameId] ?? MemoriaGrid

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-purple-900/20">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">En vivo</p>
          <p className="text-base font-black text-white capitalize">{gameId}</p>
        </div>
        <div className="bg-purple-900/30 rounded-2xl px-4 py-2 border border-purple-800/40 text-center">
          <p className="text-xs text-gray-400">Premio</p>
          <p className="text-base font-black text-green-400">+{bet?.prize}€</p>
        </div>
      </div>

      {/* Rivals */}
      <div className="flex gap-2 px-5 py-2 bg-[#12122A] flex-wrap">
        <span className="text-xs text-gray-500">Rivales:</span>
        {rivals.length === 0
          ? <span className="text-xs text-purple-400 animate-pulse">conectando{waitingDots}</span>
          : rivals.map((r, i) => (
            <span key={i} className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              r.score !== null ? 'bg-green-900/40 text-green-400' : 'bg-purple-900/30 text-purple-400'
            }`}>
              {r.score !== null ? `✓ ${r.score}pts` : `jugando${waitingDots}`}
            </span>
          ))
        }
      </div>

      {/* Game or waiting screen */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {myScore === null ? (
          <GameComponent seed={Number(seed) || 42} onFinish={handleFinish} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
            <div className="bg-[#1A1A2E] rounded-3xl p-8 border border-purple-900/30 text-center w-full max-w-xs">
              <p className="text-gray-400 text-sm mb-2">Tu puntuación</p>
              <p className="text-6xl font-black text-purple-400 mb-1">{myScore}</p>
              <p className="text-gray-600 text-sm">puntos</p>
            </div>
            <p className="text-gray-500 text-sm">Esperando rivales{waitingDots}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {rivals.map((r, i) => (
                <div key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  r.score !== null ? 'bg-green-900/40 text-green-400' : 'bg-purple-900/30 text-purple-400'
                }`}>
                  {r.score !== null ? `✓ ${r.score}pts` : `jugando${waitingDots}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
