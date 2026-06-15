const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const parseConfidenceScore = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) return clamp(value, 0, 1)
    if (value <= 100) return clamp(value / 100, 0, 1)
    return null
  }

  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'high') return 0.9
  if (normalized === 'medium') return 0.7
  if (normalized === 'low') return 0.4

  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) return null
  if (parsed <= 1) return clamp(parsed, 0, 1)
  if (parsed <= 100) return clamp(parsed / 100, 0, 1)
  return null
}

export const getConfidenceLevel = (score) => {
  if (score == null) return 'unknown'
  if (score >= 0.8) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

export const formatConfidencePercent = (score) => {
  if (score == null) return 'N/A'
  return `${Math.round(score * 100)}%`
}

export const normalizeConfidence = (value) => {
  const score = parseConfidenceScore(value)
  const level = getConfidenceLevel(score)
  const percent = formatConfidencePercent(score)

  const chipColor = (
    level === 'high' ? 'success'
    : level === 'medium' ? 'warning'
    : level === 'low' ? 'error'
    : 'default'
  )

  return {
    score,
    level,
    percent,
    chipColor,
  }
}

export default normalizeConfidence
