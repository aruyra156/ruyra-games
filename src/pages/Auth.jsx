import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) setError(error.message)
      else setSuccess('Revisa tu email para confirmar la cuenta.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email o contraseña incorrectos.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#0F0F1A] text-white items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-xs text-purple-400 tracking-widest uppercase font-semibold">RUYRA</p>
          <h1 className="text-4xl font-black tracking-tight">GAMES</h1>
          <p className="text-gray-500 text-sm mt-2">Compite. Gana. Al instante.</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#1A1A2E] rounded-2xl p-1 mb-6 border border-purple-900/30">
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m ? 'bg-purple-600 text-white' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handle} className="flex flex-col gap-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Nombre de usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="bg-[#1A1A2E] border border-purple-900/30 rounded-2xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="bg-[#1A1A2E] border border-purple-900/30 rounded-2xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-[#1A1A2E] border border-purple-900/30 rounded-2xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {success && <p className="text-green-400 text-sm text-center">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-50 text-white font-black text-lg py-5 rounded-2xl transition-all mt-2"
          >
            {loading ? '...' : mode === 'login' ? 'ENTRAR' : 'CREAR CUENTA'}
          </button>
        </form>
      </div>
    </div>
  )
}
