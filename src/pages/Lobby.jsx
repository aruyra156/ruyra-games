import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'

export default function Lobby() {
  const navigate = useNavigate()
  const { state: bet } = useLocation()
  const user = useUser()
  const [playerCount, setPlayerCount] = useState(0)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Buscando sala...')
  const roomIdRef = useRef(null)
  const seedRef = useRef(null)
  const pollRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!user || !bet) return

    const enter = async () => {
      // Jitter aleatorio: desincroniza las llamadas de los 3 jugadores
      const jitter = 300 + Math.random() * 700
      await new Promise(r => setTimeout(r, jitter))

      setStatus('Uniéndote...')

      const { data, error: err } = await supabase
        .rpc('find_or_join_room', {
          p_bet: bet.amount,
          p_prize: bet.prize,
          p_max_players: bet.players,
          p_game_id: bet.gameId ?? 'memoria',
        })

      if (err) {
        setError(err.message.includes('insuficiente')
          ? 'Saldo insuficiente'
          : 'Error al unirse: ' + err.message)
        return
      }

      roomIdRef.current = data.room_id
      seedRef.current = data.seed
      setStatus('Esperando jugadores...')

      // Polling: comprueba jugadores Y status de la sala
      pollRef.current = setInterval(async () => {
        const [{ data: players }, { data: room }] = await Promise.all([
          supabase.from('room_players').select('user_id').eq('room_id', data.room_id),
          supabase.from('game_rooms').select('status, seed').eq('id', data.room_id).single(),
        ])

        const count = players?.length ?? 0
        setPlayerCount(count)

        // Navegar cuando la sala esté llena (status = 'playing' O count >= max)
        const isFull = room?.status === 'playing' || count >= (bet.players ?? 3)

        if (isFull && !doneRef.current) {
          doneRef.current = true
          clearInterval(pollRef.current)
          navigate('/game', {
            state: {
              bet,
              roomId: data.room_id,
              seed: room?.seed ?? data.seed,
            },
          })
        }
      }, 1500)
    }

    enter()
    return () => clearInterval(pollRef.current)
  }, [user, bet, navigate])

  const cancel = async () => {
    clearInterval(pollRef.current)
    if (roomIdRef.current) {
      await supabase.rpc('cancel_room_join', { p_room_id: roomIdRef.current })
    }
    navigate('/')
  }

  if (error) return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white items-center justify-center px-6 gap-4">
      <p className="text-4xl">😕</p>
      <p className="text-red-400 font-bold text-center">{error}</p>
      <button onClick={() => navigate('/')} className="text-purple-400 underline text-sm">Volver</button>
    </div>
  )

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white items-center justify-center px-6">
      <div className="text-center w-full max-w-sm">

        {/* Spinner con contador */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-purple-900/40" />
          <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-purple-400">{playerCount}</span>
            <span className="text-xs text-gray-500">de {bet?.players ?? 3}</span>
          </div>
        </div>

        <h2 className="text-2xl font-black mb-2">{status}</h2>
        <p className="text-gray-500 text-sm mb-8">
          {playerCount > 0
            ? `Faltan ${Math.max(0, (bet?.players ?? 3) - playerCount)} jugadores`
            : 'Conectando...'}
        </p>

        {/* Avatares */}
        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: bet?.players ?? 3 }).map((_, i) => (
            <div key={i} className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
              i < playerCount
                ? 'border-purple-500 bg-purple-900/40 scale-110'
                : 'border-purple-900/30 bg-[#1A1A2E]'
            }`}>
              <span className="text-2xl">{i < playerCount ? '👤' : '?'}</span>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-[#1A1A2E] rounded-2xl px-6 py-4 border border-purple-900/30 text-left mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Apuesta</span>
            <span className="font-bold text-red-400">-{bet?.amount}€</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Premio si ganas</span>
            <span className="font-bold text-green-400">+{bet?.prize}€</span>
          </div>
        </div>

        <button onClick={cancel} className="text-gray-600 text-sm underline">
          Cancelar (recuperar saldo)
        </button>
      </div>
    </div>
  )
}
