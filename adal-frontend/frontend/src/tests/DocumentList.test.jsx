import { describe, expect, it } from 'vitest'
import { normalizeConfidence } from '../utils/confidence'

describe('confidence normalization', () => {
  it('maps 0.92, 0.67 and 0.41 to high/medium/low', () => {
    expect(normalizeConfidence(0.92).level).toBe('high')
    expect(normalizeConfidence(0.67).level).toBe('medium')
    expect(normalizeConfidence(0.41).level).toBe('low')
  })

  it('formats confidence as percentages', () => {
    expect(normalizeConfidence(0.92).percent).toBe('92%')
    expect(normalizeConfidence(0.67).percent).toBe('67%')
    expect(normalizeConfidence(0.41).percent).toBe('41%')
  })
})
