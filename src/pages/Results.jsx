import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Results() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { bet, roomId, players = [], myUserId } = state ?? {}
  const [newBalance, setNewBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const myRank = sorted.findIndex(p => p.user_id === myUserId)
  const isWinner = myRank === 0
  const myScore = players.find(p => p.user_id === myUserId)?.score ?? 0

  useEffect(() => {
    if (!roomId) { setLoading(false); return }

    const finish = async () => {
      // Pagar premio (función idempotente — solo premia una vez aunque la llamen varios)
      await supabase.rpc('award_prize', { p_room_id: roomId })

      // Leer nuevo saldo
      const { data } = await supabase
        .from('wallets').select('balance').eq('user_id', myUserId).single()
      setNewBalance(data?.balance ?? null)
      setLoading(false)
    }

    finish()
  }, [roomId, myUserId])

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">

      {/* Banner resultado */}
      <div className={`pt-14 pb-10 px-6 text-center ${
        isWinner
          ? 'bg-gradient-to-b from-yellow-900/30 to-transparent'
          : 'bg-gradient-to-b from-purple-900/20 to-transparent'
      }`}>
        <p className="text-5xl mb-4">{MEDALS[myRank] ?? '💪'}</p>
        <h1 className="text-4xl font-black mb-2">
          {isWinner ? '¡GANASTE!' : myRank === 1 ? '2º puesto' : '3º puesto'}
        </h1>
        <p className="text-xl font-bold text-purple-300">{myScore} puntos</p>

        {isWinner && (
          <div className="mt-4 bg-green-900/30 border border-green-700/40 rounded-2xl px-6 py-4 inline-block">
            <p className="text-green-400 font-black text-2xl">+{bet?.prize}€</p>
            <p className="text-green-600 text-sm">añadidos a tu wallet</p>
          </div>
        )}

        {!isWinner && (
          <p className="text-gray-500 text-sm mt-3">
            Perdiste {bet?.amount}€ · Sigue practicando
          </p>
        )}
      </div>

      {/* Clasificación */}
      <div className="px-5 py-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Clasificación final</p>
        {sorted.map((p, i) => {
          const isMe = p.user_id === myUserId
          return (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${
              isMe
                ? 'bg-purple-900/30 border-purple-600/50'
                : 'bg-[#1A1A2E] border-purple-900/20'
            }`}>
              <span className="text-2xl w-8 text-center">{MEDALS[i] ?? '💀'}</span>
              <div className="flex-1">
                <p className={`font-bold ${isMe ? 'text-purple-300' : 'text-gray-300'}`}>
                  {isMe ? 'Tú' : `Jugador ${i + 2}`}
                  {isMe && <span className="text-purple-500 text-xs ml-2">(yo)</span>}
                </p>
                <p className="text-gray-500 text-sm">{p.score ?? 0} puntos</p>
              </div>
              {i === 0 && (
                <span className="text-green-400 font-black">+{bet?.prize}€</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Nuevo saldo */}
      {!loading && newBalance !== null && (
        <div className="mx-5 bg-[#1A1A2E] rounded-2xl px-5 py-4 border border-purple-900/20 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Tu saldo ahora</span>
          <span className="font-black text-lg text-green-400">{Number(newBalance).toFixed(2)}€</span>
        </div>
      )}

      {/* Botones */}
      <div className="px-5 pb-10 mt-6 flex flex-col gap-3">
        <button
          onClick={() => navigate('/lobby', { state: bet })}
          className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black text-lg py-5 rounded-2xl transition-all"
        >
          REVANCHA · {bet?.amount}€
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-[#1A1A2E] text-gray-400 font-semibold text-base py-4 rounded-2xl border border-purple-900/20"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
