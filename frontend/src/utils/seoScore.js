export function parseTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean)
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function analyzeVideoSeo(input) {
  const title = String(input?.title || '').trim()
  const description = String(input?.description || '').trim()
  const tags = parseTags(input?.tags)
  const isShort = Boolean(input?.isShort)

  let score = 0
  const suggestions = []

  const titleLen = title.length
  if (titleLen >= 40 && titleLen <= 70) score += 30
  else if (titleLen >= 25 && titleLen <= 90) score += 20
  else {
    score += 8
    suggestions.push('Keep title between 40-70 characters for better search visibility.')
  }

  const descLen = description.length
  if (descLen >= 120) score += 25
  else if (descLen >= 60) score += 16
  else {
    score += 6
    suggestions.push('Add a richer description (at least 120 characters).')
  }

  if (tags.length >= 5 && tags.length <= 15) score += 20
  else if (tags.length >= 2) score += 12
  else {
    score += 4
    suggestions.push('Add 5-15 relevant tags.')
  }

  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const descLower = description.toLowerCase()
  const keywordMatches = titleWords.filter((w) => descLower.includes(w)).length
  if (keywordMatches >= 3) score += 15
  else if (keywordMatches >= 1) score += 9
  else {
    score += 3
    suggestions.push('Repeat your main title keywords naturally in the description.')
  }

  if (isShort) {
    if (title.toLowerCase().includes('short')) score += 5
    else suggestions.push('For Shorts, include "Short" or "#shorts" in the title/description.')
  } else {
    score += 5
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let level = 'Low'
  if (score >= 80) level = 'Excellent'
  else if (score >= 65) level = 'Good'
  else if (score >= 50) level = 'Fair'

  return { score, level, suggestions }
}
