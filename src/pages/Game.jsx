import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'
import MemoriaGrid from '../components/games/MemoriaGrid'

export default function Game() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { bet, roomId, seed } = state ?? {}
  const user = useUser()
  const [myScore, setMyScore] = useState(null)
  const [rivals, setRivals] = useState([])
  const subRef = useRef(null)

  useEffect(() => {
    if (!roomId) return

    // Subscribe to all score updates in the room
    subRef.current = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, async () => {
        // Fetch all players with scores
        const { data } = await supabase
          .from('room_players')
          .select('user_id, score, finished_at')
          .eq('room_id', roomId)

        const others = (data ?? []).filter(p => p.user_id !== user?.id)
        setRivals(others)

        const allDone = (data ?? []).every(p => p.score !== null)
        if (allDone && data?.length === (bet?.players ?? 3)) {
          navigate('/results', { state: { bet, roomId, players: data, myUserId: user?.id } })
        }
      })
      .subscribe()

    return () => subRef.current?.unsubscribe()
  }, [roomId, user, bet, navigate])

  const handleFinish = async (score) => {
    setMyScore(score)
    await supabase
      .from('room_players')
      .update({ score, finished_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user?.id)
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">
      <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-purple-900/20">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Partida en vivo</p>
          <p className="text-sm font-bold text-purple-400">Memoria Grid</p>
        </div>
        <div className="bg-purple-900/30 rounded-xl px-3 py-1.5 border border-purple-800/40">
          <p className="text-xs text-gray-400">Premio</p>
          <p className="text-sm font-black text-green-400">{bet?.prize ?? '—'}€</p>
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 bg-[#12122A]/80">
        <span className="text-xs text-gray-500 mr-1">Rivales:</span>
        {rivals.length === 0
          ? <span className="text-xs text-purple-400">conectados...</span>
          : rivals.map((r, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
              r.score !== null ? 'bg-green-900/40 text-green-400' : 'bg-purple-900/30 text-purple-400'
            }`}>
              J{i + 2} {r.score !== null ? `· ${r.score}pts` : '· jugando'}
            </span>
          ))
        }
      </div>

      <div className="flex-1 flex flex-col py-4">
        {myScore === null ? (
          <MemoriaGrid seed={seed ?? 42} onFinish={handleFinish} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <p className="text-green-400 font-bold text-lg">¡Terminaste!</p>
            <p className="text-5xl font-black text-purple-400">{myScore}</p>
            <p className="text-gray-500 text-sm">Esperando a los rivales...</p>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-purple-600 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
