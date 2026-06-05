import { useEffect, useRef, useState } from 'react'
import { createSeededRandom } from '../../lib/seededRandom'

const W = 360
const H = 500
const PH = 28 // platform height
const INIT_W = 200
const BASE_SPEED = 140

const COLORS = ['#7C3AED','#6D28D9','#5B21B6','#8B5CF6','#A78BFA','#4C1D95']

export default function Stack({ seed = 42, onFinish }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [phase, setPhase] = useState('countdown')
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown === 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const state = {
      stacks: [{ x: (W - INIT_W) / 2, w: INIT_W }],
      cur: { x: 0, w: INIT_W, dir: 1 },
      speed: BASE_SPEED,
      score: 0,
      over: false,
      scroll: 0,
      last: null,
    }

    const tap = (e) => {
      e.preventDefault()
      if (state.over) return
      const prev = state.stacks[state.stacks.length - 1]
      const ol = Math.max(state.cur.x, prev.x)
      const or = Math.min(state.cur.x + state.cur.w, prev.x + prev.w)
      const overlap = or - ol
      if (overlap <= 5) {
        state.over = true
        cancelAnimationFrame(animRef.current)
        setPhase('done')
        onFinish?.(state.score * 100)
        return
      }
      state.stacks.push({ x: ol, w: overlap })
      state.score++
      setScore(state.score)
      state.cur = { x: -overlap, w: overlap, dir: 1 }
      state.speed = Math.min(BASE_SPEED + state.score * 10, 400)
      if (state.score > 6) state.scroll = (state.score - 6) * PH
    }

    canvas.addEventListener('pointerdown', tap, { passive: false })

    const loop = (ts) => {
      if (!state.last) state.last = ts
      const dt = Math.min((ts - state.last) / 1000, 0.05)
      state.last = ts

      state.cur.x += state.cur.dir * state.speed * dt
      if (state.cur.x + state.cur.w > W) { state.cur.x = W - state.cur.w; state.cur.dir = -1 }
      else if (state.cur.x < 0) { state.cur.x = 0; state.cur.dir = 1 }

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0F0F1A'
      ctx.fillRect(0, 0, W, H)

      const baseY = H - PH
      state.stacks.forEach((p, i) => {
        const y = baseY - i * PH + state.scroll
        if (y < -PH || y > H) return
        ctx.fillStyle = COLORS[i % COLORS.length]
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(p.x, y, p.w, PH - 2, 6)
        else ctx.rect(p.x, y, p.w, PH - 2)
        ctx.fill()
      })

      // Moving platform
      const topY = baseY - state.stacks.length * PH + state.scroll
      ctx.fillStyle = '#C4B5FD'
      ctx.shadowColor = '#A78BFA'
      ctx.shadowBlur = 12
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(state.cur.x, topY, state.cur.w, PH - 2, 6)
      else ctx.rect(state.cur.x, topY, state.cur.w, PH - 2)
      ctx.fill()
      ctx.shadowBlur = 0

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('pointerdown', tap)
    }
  }, [phase, seed, onFinish])

  if (phase === 'countdown' || phase === 'done') return (
    <div className="flex flex-col items-center justify-center flex-1">
      {phase === 'countdown' && <>
        <p className="text-gray-400 mb-4 text-sm uppercase tracking-widest">Prepárate</p>
        <span className="text-8xl font-black text-purple-400">{countdown || '¡YA!'}</span>
      </>}
      {phase === 'done' && <>
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Fin</p>
        <p className="text-6xl font-black text-purple-400">{score * 100}</p>
        <p className="text-gray-500 text-sm mt-1">puntos ({score} pisos)</p>
      </>}
    </div>
  )

  return (
    <div className="flex flex-col items-center flex-1 gap-2">
      <div className="flex justify-between w-full px-6 py-2">
        <div><p className="text-xs text-gray-500">Pisos</p><p className="text-2xl font-black text-purple-400">{score}</p></div>
        <p className="text-xs text-gray-500 self-center">Toca para apilar 👇</p>
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        className="w-full max-w-xs" style={{ touchAction: 'none' }} />
    </div>
  )
}
