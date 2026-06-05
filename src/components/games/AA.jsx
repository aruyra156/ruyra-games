import { useEffect, useRef, useState } from 'react'
import { createSeededRandom } from '../../lib/seededRandom'

const W = 360
const H = 540
const CX = W / 2
const CY = H * 0.42
const R = 90  // circle radius
const PIN_R = 6
const BALL_R = 8
const TARGET_PINS = 15
const BALL_SPEED = 380

export default function AA({ seed = 42, onFinish }) {
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

    const rotSpeed = (0.8 + rand() * 0.4) * (rand() > 0.5 ? 1 : -1) // rad/s

    // Pre-placed pins on the circle (from seed)
    const initPins = Array.from({ length: 3 }, (_, i) => ({
      angle: rand() * Math.PI * 2,
      stuck: true,
    }))

    const state = {
      angle: 0,          // circle rotation
      rotSpeed,
      pins: [...initPins],
      ball: null,        // flying ball: { x, y, vy }
      score: 0,
      over: false,
      last: null,
      pinsLeft: TARGET_PINS,
    }

    const shoot = (e) => {
      e.preventDefault()
      if (state.over || state.ball) return
      state.ball = { x: CX, y: H - 40, vy: -BALL_SPEED }
    }

    canvas.addEventListener('pointerdown', shoot, { passive: false })

    const loop = (ts) => {
      if (!state.last) state.last = ts
      const dt = Math.min((ts - state.last) / 1000, 0.05)
      state.last = ts

      // Rotate circle
      state.angle += state.rotSpeed * dt

      // Move ball
      if (state.ball) {
        state.ball.y += state.ball.vy * dt

        // Check collision with circle
        const bx = state.ball.x
        const by = state.ball.y
        const dist = Math.hypot(bx - CX, by - CY)

        if (dist <= R + PIN_R + 2) {
          // Snap to circle
          const angle = Math.atan2(by - CY, bx - CX) - state.angle
          const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

          // Check collision with existing pins
          let collision = false
          for (const pin of state.pins) {
            const pinAngle = ((pin.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
            let diff = Math.abs(normalizedAngle - pinAngle)
            if (diff > Math.PI) diff = Math.PI * 2 - diff
            if (diff < 0.22) { // ~12.6 degrees minimum spacing
              collision = true
              break
            }
          }

          if (collision) {
            state.over = true
            cancelAnimationFrame(animRef.current)
            setPhase('done')
            onFinish?.(state.score * 100)
            return
          }

          // Place pin
          state.pins.push({ angle: normalizedAngle, stuck: true })
          state.ball = null
          state.score++
          setScore(state.score)

          // Increase speed slightly
          state.rotSpeed *= 1.06

          if (state.score >= TARGET_PINS) {
            state.over = true
            cancelAnimationFrame(animRef.current)
            setPhase('done')
            onFinish?.(state.score * 100)
            return
          }
        }

        // Ball went off screen
        if (state.ball && state.ball.y < -20) {
          state.ball = null
        }
      }

      // Draw
      ctx.fillStyle = '#0F0F1A'
      ctx.fillRect(0, 0, W, H)

      // Circle
      ctx.strokeStyle = '#3B0764'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(CX, CY, R, 0, Math.PI * 2)
      ctx.stroke()

      // Pins on circle
      for (const pin of state.pins) {
        const a = pin.angle + state.angle
        const px = CX + Math.cos(a) * R
        const py = CY + Math.sin(a) * R
        // Pin line
        ctx.strokeStyle = '#7C3AED'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(CX + Math.cos(a) * (R - 12), CY + Math.sin(a) * (R - 12))
        ctx.lineTo(px, py)
        ctx.stroke()
        // Pin head
        ctx.fillStyle = '#C4B5FD'
        ctx.beginPath()
        ctx.arc(px, py, PIN_R, 0, Math.PI * 2)
        ctx.fill()
      }

      // Flying ball
      if (state.ball) {
        ctx.fillStyle = '#FFFFFF'
        ctx.shadowColor = '#A78BFA'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      } else if (!state.over) {
        // Ready ball at bottom
        ctx.fillStyle = '#7C3AED'
        ctx.beginPath()
        ctx.arc(CX, H - 40, BALL_R, 0, Math.PI * 2)
        ctx.fill()
        // Arrow indicator
        ctx.fillStyle = '#A78BFA'
        ctx.beginPath()
        ctx.moveTo(CX, H - 55)
        ctx.lineTo(CX - 6, H - 45)
        ctx.lineTo(CX + 6, H - 45)
        ctx.closePath()
        ctx.fill()
      }

      // Progress
      const remaining = TARGET_PINS - state.score
      ctx.fillStyle = '#1A1A2E'
      ctx.fillRect(20, H - 18, W - 40, 8)
      ctx.fillStyle = '#7C3AED'
      ctx.fillRect(20, H - 18, (W - 40) * (state.score / TARGET_PINS), 8)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('pointerdown', shoot)
    }
  }, [phase, seed, onFinish])

  if (phase === 'countdown' || phase === 'done') return (
    <div className="flex flex-col items-center justify-center flex-1">
      {phase === 'countdown' && <>
        <p className="text-gray-400 mb-4 text-sm uppercase tracking-widest">Prepárate</p>
        <span className="text-8xl font-black text-red-400">{countdown || '¡YA!'}</span>
      </>}
      {phase === 'done' && <>
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">
          {score >= TARGET_PINS ? '¡Completo!' : 'Game Over'}
        </p>
        <p className="text-6xl font-black text-red-400">{score * 100}</p>
        <p className="text-gray-500 text-sm mt-1">{score}/{TARGET_PINS} pines colocados</p>
      </>}
    </div>
  )

  return (
    <div className="flex flex-col items-center flex-1 gap-2">
      <div className="flex justify-between w-full px-6 py-2">
        <div><p className="text-xs text-gray-500">Pines</p><p className="text-2xl font-black text-red-400">{score}/{TARGET_PINS}</p></div>
        <p className="text-xs text-gray-500 self-center">Toca para lanzar 👇</p>
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        className="w-full max-w-xs" style={{ touchAction: 'none' }} />
    </div>
  )
}
