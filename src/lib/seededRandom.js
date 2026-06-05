// Mulberry32 — fast seeded PRNG, same seed = same sequence for all players
export function createSeededRandom(seed) {
  let s = seed >>> 0
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function generateSequence(seed, length, gridSize) {
  const rand = createSeededRandom(seed)
  return Array.from({ length }, () => Math.floor(rand() * gridSize))
}
