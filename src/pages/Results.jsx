import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Results() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { bet, roomId, players = [], myUserId } = state ?? {}
  const [prizeAwarded, setPrizeAwarded] = useState(false)
  const [newBalance, setNewBalance] = useState(null)

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const winner = sorted[0]
  const isWinner = winner?.user_id === myUserId

  useEffect(() => {
    if (!roomId) return
    // Award prize (idempotent — DB function ignores duplicate calls)
    supabase.rpc('award_prize', { p_room_id: roomId }).then(() => {
      setPrizeAwarded(true)
      // Refresh wallet balance
      supabase.from('wallets').select('balance').eq('user_id', myUserId).single()
        .then(({ data }) => setNewBalance(data?.balance))
    })
  }, [roomId, myUserId])

  const myData = players.find(p => p.user_id === myUserId)
  const myRank = sorted.findIndex(p => p.user_id === myUserId) + 1

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">
      <div className={`py-10 px-6 text-center ${isWinner ? 'bg-gradient-to-b from-green-900/40 to-transparent' : 'bg-gradient-to-b from-purple-900/20 to-transparent'}`}>
        <p className="text-4xl mb-3">{isWinner ? '🏆' : myRank === 2 ? '🥈' : '💪'}</p>
        <h1 className="text-3xl font-black mb-1">
          {isWinner ? '¡GANASTE!' : `${myRank}º puesto`}
        </h1>
        {isWinner ? (
          <div>
            <p className="text-green-400 font-bold text-xl">+{bet?.prize}€ en tu wallet</p>
            {newBalance !== null && (
              <p className="text-gray-400 text-sm mt-1">Saldo actual: {Number(newBalance).toFixed(2)}€</p>
            )}
          </div>
        ) : (
          <p className="text-gray-400">Tu puntuación: {myData?.score ?? 0} pts</p>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Clasificación</p>
        {sorted.map((p, i) => {
          const isMe = p.user_id === myUserId
          return (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border ${
              isMe ? 'bg-purple-900/30 border-purple-600/50' : 'bg-[#1A1A2E] border-purple-900/20'
            }`}>
              <span className={`text-2xl font-black w-8 text-center ${
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : 'text-orange-700'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className={`font-bold ${isMe ? 'text-purple-300' : 'text-white'}`}>
                  {isMe ? 'Tú' : `Jugador ${i + 1}`}
                </p>
                <p className="text-gray-500 text-sm">{p.score ?? 0} puntos</p>
              </div>
              {i === 0 && prizeAwarded && (
                <span className="text-green-400 font-black text-sm">+{bet?.prize}€</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-5 pb-10 mt-auto flex flex-col gap-3">
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
