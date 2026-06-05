import { useEffect, useRef, useState } from 'react'
import { createSeededRandom } from '../../lib/seededRandom'

const W = 360
const H = 560
const BALL_R = 10
const PATH_W_START = 80
const TILE_SIZE = 40
const SPEED = 180

export default function ZigZag({ seed = 42, onFinish }) {
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
    const rand = createSeededRandom(seed)

    // Generate path: sequence of segments (direction = 1 right, -1 left)
    const generatePath = () => {
      const segments = []
      let x = W / 2
      let dir = 1
      for (let i = 0; i < 300; i++) {
        const len = 3 + Math.floor(rand() * 5) // 3-7 tiles per segment
        segments.push({ dir, len, startX: x })
        x = dir === 1 ? x + len * TILE_SIZE : x - len * TILE_SIZE
        dir *= -1
      }
      return segments
    }

    const path = generatePath()

    // Build path tiles
    const buildTiles = () => {
      const tiles = []
      let globalY = H * 2 // start far ahead
      let x = W / 2
      let pathW = PATH_W_START

      for (const seg of path) {
        for (let i = 0; i < seg.len; i++) {
          tiles.push({
            x: seg.dir === 1 ? x + i * TILE_SIZE : x - (i + 1) * TILE_SIZE,
            y: globalY - tiles.length * TILE_SIZE,
            w: TILE_SIZE,
            dir: seg.dir,
            isCorner: i === seg.len - 1,
          })
        }
        x = seg.dir === 1 ? x + seg.len * TILE_SIZE : x - seg.len * TILE_SIZE
      }
      return tiles
    }

    // Simpler path: just a zig-zag that scrolls upward
    const state = {
      ball: { x: W / 2, y: H * 0.7 },
      dir: 1, // 1 = right-down, -1 = left-down
      speed: SPEED,
      score: 0,
      over: false,
      last: null,
      camY: 0, // camera scroll
      // Path: list of corners (x, y) pre-generated
      corners: [],
      nextCornerIdx: 0,
    }

    // Generate corners from seed
    {
      let cx = W / 2
      let cy = H * 0.7
      let dir = 1
      state.corners.push({ x: cx, y: cy })
      for (let i = 0; i < 500; i++) {
        const dist = (4 + Math.floor(rand() * 5)) * TILE_SIZE
        const nx = dir === 1 ? cx + dist : cx - dist
        const ny = cy - dist
        state.corners.push({ x: nx, y: ny })
        cx = nx; cy = ny
        dir *= -1
      }
    }

    const tap = (e) => {
      e.preventDefault()
      if (state.over) return
      state.dir *= -1
    }

    canvas.addEventListener('pointerdown', tap, { passive: false })

    const loop = (ts) => {
      if (!state.last) state.last = ts
      const dt = Math.min((ts - state.last) / 1000, 0.05)
      state.last = ts

      // Move ball diagonally
      const dx = state.dir * state.speed * dt
      const dy = -state.speed * dt
      state.ball.x += dx
      state.ball.y += dy
      state.camY -= state.speed * dt // camera follows ball up

      // Check if we passed a corner → update score
      if (state.nextCornerIdx < state.corners.length) {
        const next = state.corners[state.nextCornerIdx]
        if (state.ball.y <= next.y + 5) {
          state.score++
          setScore(state.score)
          state.speed = Math.min(SPEED + state.score * 2, 320)
          state.nextCornerIdx++
        }
      }

      // Check bounds — ball must stay between path edges
      // Simple: calculate expected path x range at ball.y
      const ci = Math.max(0, state.nextCornerIdx - 1)
      const c0 = state.corners[ci]
      const c1 = state.corners[ci + 1] ?? c0
      const pathX = c0.x + (c1.x - c0.x) * Math.max(0, Math.min(1,
        (state.ball.y - c0.y) / (c1.y - c0.y || 1)))
      const pathW = Math.max(24, PATH_W_START - state.score * 0.3)

      if (state.ball.x < pathX - pathW / 2 - BALL_R ||
          state.ball.x > pathX + pathW / 2 + BALL_R) {
        state.over = true
        cancelAnimationFrame(animRef.current)
        setPhase('done')
        onFinish?.(state.score * 50)
        return
      }

      // Draw
      ctx.fillStyle = '#0F0F1A'
      ctx.fillRect(0, 0, W, H)

      const camOffset = H * 0.7 - state.ball.y

      // Draw path segments between corners
      ctx.lineCap = 'round'
      for (let i = 0; i < state.corners.length - 1; i++) {
        const c0 = state.corners[i]
        const c1 = state.corners[i + 1]
        const sy0 = c0.y + camOffset
        const sy1 = c1.y + camOffset
        if (sy0 > H + 100 || sy1 < -100) continue

        const pathW = Math.max(24, PATH_W_START - Math.max(0, i - 2) * 0.3)
        ctx.strokeStyle = i < state.nextCornerIdx ? '#4C1D95' : '#7C3AED'
        ctx.lineWidth = pathW
        ctx.beginPath()
        ctx.moveTo(c0.x, sy0)
        ctx.lineTo(c1.x, sy1)
        ctx.stroke()

        // Diamonds on path
        if (i >= state.nextCornerIdx && i % 2 === 0) {
          const mx = (c0.x + c1.x) / 2
          const my = (sy0 + sy1) / 2
          ctx.fillStyle = '#A78BFA'
          ctx.save()
          ctx.translate(mx, my)
          ctx.rotate(Math.PI / 4)
          ctx.fillRect(-5, -5, 10, 10)
          ctx.restore()
        }
      }

      // Ball
      const bsy = state.ball.y + camOffset
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#A78BFA'
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.arc(state.ball.x, bsy, BALL_R, 0, Math.PI * 2)
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
        <span className="text-8xl font-black text-yellow-400">{countdown || '¡YA!'}</span>
      </>}
      {phase === 'done' && <>
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Game Over</p>
        <p className="text-6xl font-black text-yellow-400">{score * 50}</p>
        <p className="text-gray-500 text-sm mt-1">{score} curvas superadas</p>
      </>}
    </div>
  )

  return (
    <div className="flex flex-col items-center flex-1 gap-2">
      <div className="flex justify-between w-full px-6 py-2">
        <div><p className="text-xs text-gray-500">Curvas</p><p className="text-2xl font-black text-yellow-400">{score}</p></div>
        <p className="text-xs text-gray-500 self-center">Toca para girar 👇</p>
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        className="w-full max-w-xs" style={{ touchAction: 'none' }} />
    </div>
  )
}
