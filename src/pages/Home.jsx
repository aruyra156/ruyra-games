import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/AuthContext'
import { GAMES } from '../lib/games'

const BETS = [
  { amount: 2, players: 3, prize: 4, label: '2€' },
  { amount: 5, players: 3, prize: 10, label: '5€' },
  { amount: 10, players: 3, prize: 20, label: '10€' },
]

export default function Home() {
  const navigate = useNavigate()
  const user = useUser()
  const [selectedGame, setSelectedGame] = useState(0)
  const [selectedBet, setSelectedBet] = useState(0)
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('wallets').select('balance').eq('user_id', user.id).single()
      .then(({ data }) => setBalance(data?.balance ?? 0))
  }, [user])

  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador'
  const game = GAMES[selectedGame]
  const bet = BETS[selectedBet]

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
          <button onClick={() => supabase.auth.signOut()}
            className="bg-[#1A1A2E] rounded-2xl px-3 py-3 border border-purple-900/40 text-gray-500 text-xs">
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pt-2 pb-8 flex flex-col gap-5">

        {/* Game selector — horizontal scroll */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Elige el juego</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {GAMES.map((g, i) => (
              <button key={g.id} onClick={() => setSelectedGame(i)}
                className={`flex-shrink-0 w-32 rounded-2xl p-3 border-2 text-left transition-all ${
                  selectedGame === i
                    ? 'border-purple-500 bg-purple-900/40'
                    : 'border-purple-900/20 bg-[#1A1A2E]'
                }`}>
                <p className="text-2xl mb-1">{g.emoji}</p>
                <p className="text-sm font-black leading-tight">{g.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{g.duration}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected game card */}
        <div className={`bg-gradient-to-br ${game.color} rounded-3xl p-5 border border-purple-900/30`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{game.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">{game.name}</h2>
                <span className="bg-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">3 jugadores</span>
              </div>
              <p className="text-gray-400 text-xs">{game.duration} · Premio ×2</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm">{game.description}</p>
        </div>

        {/* Bet selector */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Elige tu apuesta</p>
          <div className="grid grid-cols-3 gap-3">
            {BETS.map((b, i) => (
              <button key={i} onClick={() => setSelectedBet(i)}
                className={`rounded-2xl py-4 px-2 border-2 transition-all ${
                  selectedBet === i ? 'border-purple-500 bg-purple-900/40' : 'border-purple-900/30 bg-[#1A1A2E]'
                }`}>
                <p className={`text-xl font-black ${selectedBet === i ? 'text-purple-300' : 'text-white'}`}>{b.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">gana {b.prize}€</p>
              </button>
            ))}
          </div>
        </div>

        {balance !== null && balance < bet.amount && (
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-2xl px-4 py-3 text-sm text-yellow-400">
            Saldo insuficiente. Necesitas {bet.amount}€.
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <button
            onClick={() => navigate('/lobby', { state: { ...bet, gameId: game.id } })}
            disabled={balance !== null && balance < bet.amount}
            className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 text-white font-black text-lg py-5 rounded-2xl transition-all pulse-ring">
            JUGAR {game.emoji} · {bet.label}
          </button>
          <p className="text-center text-xs text-gray-600 mt-3">
            3 jugadores · El ganador se lleva {bet.prize.toFixed(2)}€ al instante
          </p>
        </div>
      </main>
    </div>
  )
}
