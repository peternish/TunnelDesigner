export function calculateArcCenter(start, end, radius) {
  const R = Math.abs(radius)
  if (!R) return null

  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > 2 * R || dist === 0) {
    return null
  }

  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const h = Math.sqrt(R * R - (dist / 2) * (dist / 2))

  // Perpendicular direction
  const perpX = -dy / dist
  const perpY = dx / dist

  const sign = radius >= 0 ? 1 : -1

  return {
    x: midX + sign * h * perpX,
    y: midY + sign * h * perpY,
  }
}

export function generateArcPath(start, end, radius) {
  const center = calculateArcCenter(start, end, radius)
  if (!center) return ''

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)

  let angleDiff = endAngle - startAngle
  // Positive radius => counterclockwise, negative => clockwise
  if (radius >= 0) {
    if (angleDiff < 0) angleDiff += 2 * Math.PI
  } else {
    if (angleDiff > 0) angleDiff -= 2 * Math.PI
  }

  const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0
  const sweepFlag = radius >= 0 ? 0 : 1
  const R = Math.abs(radius)

  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

export function getPositionAtLength(axisData, len) {
  if (!axisData || axisData.length === 0) return { x: 0, y: 0 }
  let remaining = len
  for (let seg of axisData) {
    if (seg.type === 'line') {
      const dx = seg.end.x - seg.start.x
      const dy = seg.end.y - seg.start.y
      const L = Math.hypot(dx, dy)
      if (remaining <= L) {
        const t = L === 0 ? 0 : remaining / L
        return { x: seg.start.x + dx * t, y: seg.start.y + dy * t }
      }
      remaining -= L
    } else if (seg.type === 'arc' && seg.radius) {
      const center = calculateArcCenter(seg.start, seg.end, seg.radius)
      if (!center) continue
      const R = Math.abs(seg.radius)
      let startA = Math.atan2(seg.start.y - center.y, seg.start.x - center.x)
      let endA = Math.atan2(seg.end.y - center.y, seg.end.x - center.x)
      let angleDiff = endA - startA
      if (seg.radius > 0 && angleDiff < 0) angleDiff += 2 * Math.PI
      if (seg.radius < 0 && angleDiff > 0) angleDiff -= 2 * Math.PI
      const arcLen = Math.abs(angleDiff) * R
      if (remaining <= arcLen) {
        const t = arcLen === 0 ? 0 : remaining / arcLen
        const ang = startA + angleDiff * t
        return { x: center.x + R * Math.cos(ang), y: center.y + R * Math.sin(ang) }
      }
      remaining -= arcLen
    }
  }
  const last = axisData[axisData.length - 1]
  return { x: last?.end?.x || 0, y: last?.end?.y || 0 }
}


