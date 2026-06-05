import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'

const BETS = [
  { amount: 2, players: 3, prize: 4, label: '2€' },
  { amount: 5, players: 3, prize: 10, label: '5€' },
  { amount: 10, players: 3, prize: 20, label: '10€' },
]

export default function Home() {
  const navigate = useNavigate()
  const user = useUser()
  const [selected, setSelected] = useState(0)
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setBalance(data?.balance ?? 0))
  }, [user])

  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador'

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <p className="text-xs text-purple-400 tracking-widest uppercase font-semibold">RUYRA</p>
          <h1 className="text-2xl font-black tracking-tight leading-none">GAMES</h1>
          <p className="text-xs text-gray-600 mt-0.5">Hola, {username}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#1A1A2E] rounded-2xl px-4 py-2 border border-purple-900/40">
            <p className="text-xs text-gray-400">Saldo</p>
            <p className="text-lg font-bold text-green-400">
              {balance === null ? '—' : `${Number(balance).toFixed(2)}€`}
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-[#1A1A2E] rounded-2xl px-3 py-3 border border-purple-900/40 text-gray-500 text-xs"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 pb-8 flex flex-col gap-6">
        {/* Game card */}
        <div className="bg-[#1A1A2E] rounded-3xl overflow-hidden border border-purple-900/30">
          <div className="bg-gradient-to-br from-purple-900/60 to-purple-800/20 p-6 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">HOT</span>
              <span className="text-xs text-gray-400">Habilidad pura</span>
            </div>
            <h2 className="text-2xl font-black mb-1">Memoria Grid</h2>
            <p className="text-gray-400 text-sm">Memoriza la secuencia y repítela más rápido que tus rivales. 3 jugadores. El mejor gana.</p>
          </div>
          <div className="flex divide-x divide-purple-900/30 px-4 py-3 bg-[#12122A]">
            <div className="flex-1 text-center">
              <p className="text-2xl font-black text-purple-400">3</p>
              <p className="text-xs text-gray-500">Jugadores</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-black text-purple-400">~90s</p>
              <p className="text-xs text-gray-500">Duración</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-black text-green-400">×2</p>
              <p className="text-xs text-gray-500">Premio</p>
            </div>
          </div>
        </div>

        {/* Bet selector */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Elige tu apuesta</p>
          <div className="grid grid-cols-3 gap-3">
            {BETS.map((bet, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`rounded-2xl py-4 px-2 border-2 transition-all ${
                  selected === i
                    ? 'border-purple-500 bg-purple-900/40'
                    : 'border-purple-900/30 bg-[#1A1A2E]'
                }`}
              >
                <p className={`text-xl font-black ${selected === i ? 'text-purple-300' : 'text-white'}`}>
                  {bet.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">gana {bet.prize}€</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recharge banner */}
        {balance !== null && balance < BETS[selected].amount && (
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-2xl px-4 py-3 text-sm text-yellow-400">
            Saldo insuficiente. Necesitas {BETS[selected].amount}€ para esta partida.
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <button
            onClick={() => navigate('/lobby', { state: BETS[selected] })}
            disabled={balance !== null && balance < BETS[selected].amount}
            className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 text-white font-black text-lg py-5 rounded-2xl transition-all pulse-ring"
          >
            JUGAR · {BETS[selected].label}
          </button>
          <p className="text-center text-xs text-gray-600 mt-3">
            3 jugadores · El ganador se lleva {BETS[selected].prize.toFixed(2)}€ al instante
          </p>
        </div>
      </main>
    </div>
  )
}
