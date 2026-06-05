import { useState, useEffect, useCallback, useRef } from 'react'
import { generateSequence } from '../../lib/seededRandom'

const GRID_SIZE = 9 // 3×3
const SHOW_DELAY = 600   // ms between tiles during playback
const SHOW_DURATION = 400 // ms each tile stays lit

const PHASES = {
  COUNTDOWN: 'countdown',
  WATCH: 'watch',
  RECALL: 'recall',
  FEEDBACK: 'feedback',
  DONE: 'done',
}

export default function MemoriaGrid({ seed = 42, onFinish }) {
  const [phase, setPhase] = useState(PHASES.COUNTDOWN)
  const [countdown, setCountdown] = useState(3)
  const [level, setLevel] = useState(1)
  const [sequence, setSequence] = useState([])
  const [playerInput, setPlayerInput] = useState([])
  const [activeTile, setActiveTile] = useState(null)
  const [tileState, setTileState] = useState({}) // { [idx]: 'correct'|'wrong' }
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(10)
  const timeRef = useRef(null)

  // Countdown before game starts
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return
    if (countdown === 0) {
      startLevel(1)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const startLevel = useCallback((lvl) => {
    const seq = generateSequence(seed + lvl * 1000, lvl + 2, GRID_SIZE)
    setSequence(seq)
    setPlayerInput([])
    setTileState({})
    setPhase(PHASES.WATCH)

    // Play back the sequence
    seq.forEach((tile, i) => {
      setTimeout(() => {
        setActiveTile(tile)
        setTimeout(() => setActiveTile(null), SHOW_DURATION)
      }, i * SHOW_DELAY + 500)
    })

    setTimeout(() => {
      setPhase(PHASES.RECALL)
      setTimeLeft(Math.max(5, 12 - lvl))
    }, seq.length * SHOW_DELAY + SHOW_DURATION + 600)
  }, [seed])

  // Recall timer
  useEffect(() => {
    if (phase !== PHASES.RECALL) return
    timeRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timeRef.current)
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timeRef.current)
  }, [phase])

  const handleTimeout = useCallback(() => {
    setPhase(PHASES.DONE)
    onFinish?.(score)
  }, [score, onFinish])

  const handleTileTap = useCallback((idx) => {
    if (phase !== PHASES.RECALL) return

    const next = playerInput.length
    const expected = sequence[next]
    const isCorrect = idx === expected

    setTileState(prev => ({ ...prev, [idx]: isCorrect ? 'correct' : 'wrong' }))
    setTimeout(() => setTileState(prev => { const n = {...prev}; delete n[idx]; return n }), 300)

    if (!isCorrect) {
      clearInterval(timeRef.current)
      setPhase(PHASES.DONE)
      onFinish?.(score)
      return
    }

    const newInput = [...playerInput, idx]
    setPlayerInput(newInput)

    if (newInput.length === sequence.length) {
      clearInterval(timeRef.current)
      const newScore = score + level * 100
      setScore(newScore)
      setPhase(PHASES.FEEDBACK)
      setTimeout(() => {
        const nextLevel = level + 1
        if (nextLevel > 8) {
          setPhase(PHASES.DONE)
          onFinish?.(newScore)
        } else {
          setLevel(nextLevel)
          startLevel(nextLevel)
        }
      }, 800)
    }
  }, [phase, playerInput, sequence, level, score, startLevel, onFinish])

  if (phase === PHASES.COUNTDOWN) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <p className="text-gray-400 mb-4 text-sm uppercase tracking-widest">Prepárate</p>
        <span className="text-8xl font-black text-purple-400">{countdown || '¡YA!'}</span>
      </div>
    )
  }

  if (phase === PHASES.DONE) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <p className="text-gray-400 text-sm uppercase tracking-widest">Partida terminada</p>
        <p className="text-6xl font-black text-purple-400">{score}</p>
        <p className="text-gray-500 text-sm">puntos</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-4">
      {/* Header */}
      <div className="flex w-full justify-between items-center">
        <div className="text-center">
          <p className="text-xs text-gray-500">Nivel</p>
          <p className="text-xl font-black text-purple-400">{level}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Puntos</p>
          <p className="text-xl font-black">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Tiempo</p>
          <p className={`text-xl font-black ${timeLeft <= 3 ? 'text-red-400' : 'text-white'}`}>
            {phase === PHASES.RECALL ? timeLeft : '—'}
          </p>
        </div>
      </div>

      {/* Status */}
      <p className="text-sm font-semibold text-gray-400">
        {phase === PHASES.WATCH && '👀 Memoriza la secuencia...'}
        {phase === PHASES.RECALL && `🎯 Repite la secuencia (${playerInput.length}/${sequence.length})`}
        {phase === PHASES.FEEDBACK && '✅ ¡Correcto!'}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {Array.from({ length: GRID_SIZE }).map((_, idx) => {
          const isActive = activeTile === idx
          const state = tileState[idx]
          return (
            <button
              key={idx}
              onPointerDown={() => handleTileTap(idx)}
              className={`
                aspect-square rounded-2xl border-2 transition-none
                ${isActive
                  ? 'bg-purple-500 border-purple-300 scale-105'
                  : state === 'correct'
                  ? 'bg-green-500 border-green-300'
                  : state === 'wrong'
                  ? 'bg-red-500 border-red-300'
                  : 'bg-[#1A1A2E] border-purple-900/40 active:bg-purple-900/60'}
              `}
            />
          )
        })}
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {sequence.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < playerInput.length ? 'bg-purple-400' : 'bg-purple-900/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
