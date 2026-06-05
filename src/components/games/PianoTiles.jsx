import { useEffect, useRef, useState, useCallback } from 'react'
import { generateSequence } from '../../lib/seededRandom'

const COLS = 4
const TILE_H = 140
const SPEED_START = 220
const SPEED_INC = 12

export default function PianoTiles({ seed = 42, onFinish }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [phase, setPhase] = useState('countdown')
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)

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
    const W = canvas.width
    const H = canvas.height
    const colW = W / COLS

    // Pre-generate tile sequence from seed
    const tileSeq = generateSequence(seed, 200, COLS)

    const state = {
      tiles: [],      // { col, y, hit, missed }
      seqIdx: 0,
      speed: SPEED_START,
      score: 0,
      combo: 0,
      over: false,
      last: null,
      spawnTimer: 0,
      spawnInterval: 0.55, // seconds between tiles
    }

    const HIT_ZONE_TOP = H - TILE_H - 20
    const HIT_ZONE_BOT = H - 20

    const tap = (e) => {
      e.preventDefault()
      if (state.over) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = W / rect.width
      const touches = e.touches ?? [e]
      for (const touch of touches) {
        const x = (touch.clientX - rect.left) * scaleX
        const col = Math.floor(x / colW)
        // Check if any tile in this column is in hit zone
        let hit = false
        for (const tile of state.tiles) {
          if (tile.col === col && !tile.hit && !tile.missed) {
            if (tile.y + TILE_H >= HIT_ZONE_TOP && tile.y <= HIT_ZONE_BOT) {
              tile.hit = true
              hit = true
              state.score++
              state.combo++
              setScore(state.score)
              setCombo(state.combo)
              state.speed = SPEED_START + state.score * SPEED_INC
              state.spawnInterval = Math.max(0.25, 0.55 - state.score * 0.003)
              break
            }
          }
        }
        if (!hit) {
          // Tapped empty — no penalty, just ignore
        }
      }
    }

    canvas.addEventListener('pointerdown', tap, { passive: false })
    canvas.addEventListener('touchstart', tap, { passive: false })

    const loop = (ts) => {
      if (!state.last) state.last = ts
      const dt = Math.min((ts - state.last) / 1000, 0.05)
      state.last = ts

      // Spawn tiles
      state.spawnTimer += dt
      if (state.spawnTimer >= state.spawnInterval && state.seqIdx < tileSeq.length) {
        state.tiles.push({ col: tileSeq[state.seqIdx], y: -TILE_H, hit: false, missed: false })
        state.seqIdx++
        state.spawnTimer = 0
      }

      // Move tiles
      for (const tile of state.tiles) {
        if (!tile.hit) tile.y += state.speed * dt
        // Miss detection: tile passed bottom without being hit
        if (!tile.hit && !tile.missed && tile.y > H) {
          tile.missed = true
          state.combo = 0
          setCombo(0)
          state.over = true
        }
      }

      if (state.over) {
        cancelAnimationFrame(animRef.current)
        setPhase('done')
        onFinish?.(state.score * 100)
        return
      }

      // Remove old tiles
      state.tiles = state.tiles.filter(t => t.y < H + 10)

      // Draw
      ctx.fillStyle = '#0F0F1A'
      ctx.fillRect(0, 0, W, H)

      // Column lines
      ctx.strokeStyle = '#1A1A2E'
      ctx.lineWidth = 2
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * colW, 0); ctx.lineTo(c * colW, H); ctx.stroke()
      }

      // Hit zone
      ctx.fillStyle = 'rgba(124,58,237,0.08)'
      ctx.fillRect(0, HIT_ZONE_TOP, W, TILE_H + 20)
      ctx.strokeStyle = 'rgba(124,58,237,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, HIT_ZONE_TOP); ctx.lineTo(W, HIT_ZONE_TOP); ctx.stroke()

      // Tiles
      for (const tile of state.tiles) {
        if (tile.hit) {
          ctx.fillStyle = '#10B981'
        } else {
          ctx.fillStyle = '#1E1E3A'
        }
        const pad = 4
        const x = tile.col * colW + pad
        const w = colW - pad * 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, tile.y, w, TILE_H - 4, 10)
        else ctx.rect(x, tile.y, w, TILE_H - 4)
        ctx.fill()

        // Glow on hit tile
        if (tile.hit) {
          ctx.fillStyle = 'rgba(16,185,129,0.3)'
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(x, tile.y, w, TILE_H - 4, 10)
          else ctx.rect(x, tile.y, w, TILE_H - 4)
          ctx.fill()
        }
      }

      // Column tap feedback circles (draw column tap areas at bottom)
      for (let c = 0; c < COLS; c++) {
        ctx.strokeStyle = 'rgba(124,58,237,0.2)'
        ctx.lineWidth = 2
        ctx.strokeRect(c * colW + 2, H - 22, colW - 4, 20)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('pointerdown', tap)
      canvas.removeEventListener('touchstart', tap)
    }
  }, [phase, seed, onFinish])

  if (phase === 'countdown' || phase === 'done') return (
    <div className="flex flex-col items-center justify-center flex-1">
      {phase === 'countdown' && <>
        <p className="text-gray-400 mb-4 text-sm uppercase tracking-widest">Prepárate</p>
        <span className="text-8xl font-black text-purple-400">{countdown || '¡YA!'}</span>
      </>}
      {phase === 'done' && <>
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Game Over</p>
        <p className="text-6xl font-black text-purple-400">{score * 100}</p>
        <p className="text-gray-500 text-sm mt-1">{score} tiles perfectos</p>
      </>}
    </div>
  )

  return (
    <div className="flex flex-col items-center flex-1 gap-2">
      <div className="flex justify-between w-full px-6 py-2">
        <div><p className="text-xs text-gray-500">Score</p><p className="text-2xl font-black text-purple-400">{score * 100}</p></div>
        {combo > 2 && <div className="text-center"><p className="text-xs text-yellow-500">COMBO</p><p className="text-xl font-black text-yellow-400">×{combo}</p></div>}
        <div className="text-right"><p className="text-xs text-gray-500">Tiles</p><p className="text-2xl font-black text-white">{score}</p></div>
      </div>
      <canvas ref={canvasRef} width={360} height={520}
        className="w-full max-w-xs" style={{ touchAction: 'none' }} />
    </div>
  )
}
