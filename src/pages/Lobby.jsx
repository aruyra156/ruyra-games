import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'

export default function Lobby() {
  const navigate = useNavigate()
  const { state: bet } = useLocation()
  const user = useUser()
  const [players, setPlayers] = useState([])
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Buscando sala...')
  const roomRef = useRef(null)
  const subRef = useRef(null)

  useEffect(() => {
    if (!user || !bet) return
    let cancelled = false

    const enter = async () => {
      // 1. Find or create room
      const { data: roomId, error: roomErr } = await supabase
        .rpc('find_or_create_room', {
          p_bet: bet.amount,
          p_prize: bet.prize,
          p_max_players: bet.players,
        })
      if (roomErr || cancelled) { setError(roomErr?.message); return }
      roomRef.current = roomId
      setStatus('Uniéndote a la sala...')

      // 2. Deduct fee + join
      const { error: joinErr } = await supabase.rpc('join_room', {
        p_room_id: roomId,
        p_bet: bet.amount,
      })
      if (joinErr || cancelled) { setError(joinErr?.message ?? 'Error al unirse'); return }

      // 3. Get current players
      const { data: current } = await supabase
        .from('room_players')
        .select('user_id')
        .eq('room_id', roomId)
      if (!cancelled) setPlayers(current ?? [])
      setStatus('Esperando jugadores...')

      // 4. Subscribe to player joins
      subRef.current = supabase
        .channel(`room-${roomId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          setPlayers(prev => {
            const updated = [...prev, payload.new]
            if (updated.length >= bet.players) {
              // All players in — start game
              supabase.from('game_rooms')
                .update({ status: 'playing' })
                .eq('id', roomId)
                .then(() => {
                  if (!cancelled) navigate('/game', {
                    state: { bet, roomId, seed: payload.new.room_id },
                  })
                })
              // Fetch seed separately
              supabase.from('game_rooms').select('seed').eq('id', roomId).single()
                .then(({ data }) => {
                  if (!cancelled) navigate('/game', { state: { bet, roomId, seed: data?.seed } })
                })
            }
            return updated
          })
        })
        .subscribe()

      // If room was already full on join (rare), go straight to game
      if ((current?.length ?? 0) >= bet.players) {
        const { data: room } = await supabase
          .from('game_rooms').select('seed').eq('id', roomId).single()
        if (!cancelled) navigate('/game', { state: { bet, roomId, seed: room?.seed } })
      }
    }

    enter()
    return () => {
      cancelled = true
      subRef.current?.unsubscribe()
    }
  }, [user, bet, navigate])

  if (error) return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white items-center justify-center px-6 gap-4">
      <p className="text-red-400 font-bold text-center">{error}</p>
      <button onClick={() => navigate('/')} className="text-purple-400 underline text-sm">Volver</button>
    </div>
  )

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white items-center justify-center px-6">
      <div className="text-center">
        <div className="relative w-28 h-28 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-purple-900/40" />
          <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-black text-purple-400">
              {players.length}/{bet?.players ?? 3}
            </span>
          </div>
        </div>
        <h2 className="text-2xl font-black mb-2">{status}</h2>
        <p className="text-gray-400 text-sm mb-8">Necesitamos {bet?.players ?? 3} jugadores para empezar</p>

        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: bet?.players ?? 3 }).map((_, i) => (
            <div key={i} className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
              i < players.length
                ? 'border-purple-500 bg-purple-900/40'
                : 'border-purple-900/30 bg-[#1A1A2E]'
            }`}>
              <span className="text-xl">{i < players.length ? '👤' : '?'}</span>
            </div>
          ))}
        </div>

        <div className="bg-[#1A1A2E] rounded-2xl px-6 py-4 border border-purple-900/30 text-left">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-400 text-sm">Apuesta</span>
            <span className="font-bold">{bet?.amount}€</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Premio si ganas</span>
            <span className="font-bold text-green-400">{bet?.prize}€</span>
          </div>
        </div>

        <button onClick={() => navigate('/')} className="mt-6 text-gray-600 text-sm underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}
