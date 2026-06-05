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
  const [waitingDots, setWaitingDots] = useState('.')
  const pollRef = useRef(null)
  const dotsRef = useRef(null)
  const doneRef = useRef(false)

  // Animar puntos de espera
  useEffect(() => {
    dotsRef.current = setInterval(() => {
      setWaitingDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(dotsRef.current)
  }, [])

  const handleFinish = async (score) => {
    setMyScore(score)
    clearInterval(dotsRef.current)

    // Guardar mi puntuación
    await supabase
      .from('room_players')
      .update({ score, finished_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user?.id)

    // Polling cada 2s hasta que todos hayan terminado
    pollRef.current = setInterval(async () => {
      const { data: players } = await supabase
        .from('room_players')
        .select('user_id, score, finished_at')
        .eq('room_id', roomId)

      // Actualizar estado de rivales
      const others = (players ?? []).filter(p => p.user_id !== user?.id)
      setRivals(others)

      const total = players?.length ?? 0
      const finished = players?.filter(p => p.score !== null).length ?? 0

      // Si todos terminaron, ir a resultados
      if (finished >= total && total >= (bet?.players ?? 3) && !doneRef.current) {
        doneRef.current = true
        clearInterval(pollRef.current)
        navigate('/results', {
          state: { bet, roomId, players, myUserId: user?.id },
        })
      }

      // Timeout de seguridad: si pasan 45s desde que yo terminé, ir igualmente
    }, 2000)
  }

  // Timeout de seguridad: si llevas 45s esperando, ir a resultados
  useEffect(() => {
    if (myScore === null) return
    const timeout = setTimeout(async () => {
      if (doneRef.current) return
      doneRef.current = true
      clearInterval(pollRef.current)
      const { data: players } = await supabase
        .from('room_players')
        .select('user_id, score, finished_at')
        .eq('room_id', roomId)
      navigate('/results', { state: { bet, roomId, players: players ?? [], myUserId: user?.id } })
    }, 45000)
    return () => clearTimeout(timeout)
  }, [myScore])

  useEffect(() => () => clearInterval(pollRef.current), [])

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-purple-900/20">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">En vivo</p>
          <p className="text-lg font-black text-white">Memoria Grid</p>
        </div>
        <div className="bg-purple-900/30 rounded-2xl px-4 py-2 border border-purple-800/40 text-center">
          <p className="text-xs text-gray-400">Ganas si eres 1º</p>
          <p className="text-lg font-black text-green-400">+{bet?.prize}€</p>
        </div>
      </div>

      {/* Estado rivales */}
      <div className="flex gap-2 px-5 py-3 bg-[#12122A] flex-wrap">
        <span className="text-xs text-gray-500">Rivales:</span>
        {rivals.length === 0
          ? <span className="text-xs text-purple-400 animate-pulse">conectando{waitingDots}</span>
          : rivals.map((r, i) => (
            <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              r.score !== null
                ? 'bg-green-900/40 text-green-400'
                : 'bg-purple-900/30 text-purple-400'
            }`}>
              {r.score !== null ? `✓ ${r.score} pts` : `jugando${waitingDots}`}
            </span>
          ))
        }
      </div>

      {/* Juego */}
      <div className="flex-1 flex flex-col py-4">
        {myScore === null ? (
          <MemoriaGrid seed={Number(seed) || 42} onFinish={handleFinish} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
            <div className="bg-[#1A1A2E] rounded-3xl p-8 border border-purple-900/30 text-center w-full max-w-xs">
              <p className="text-gray-400 text-sm mb-2">Tu puntuación</p>
              <p className="text-6xl font-black text-purple-400 mb-1">{myScore}</p>
              <p className="text-gray-600 text-sm">puntos</p>
            </div>
            <p className="text-gray-500 text-sm text-center">
              Esperando que terminen los rivales{waitingDots}
            </p>
            <div className="flex gap-2">
              {rivals.map((r, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
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
