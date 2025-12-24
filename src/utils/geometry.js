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


function computeAxisTotalLength(axisData = []) {
  return (axisData || []).reduce((sum, seg) => {
    if (seg.type === 'line') {
      const dx = seg.end.x - seg.start.x
      const dy = seg.end.y - seg.start.y
      return sum + Math.hypot(dx, dy)
    }
    if (seg.type === 'arc' && seg.radius) {
      const dx = seg.end.x - seg.start.x
      const dy = seg.end.y - seg.start.y
      const chord = Math.hypot(dx, dy)
      if (chord === 0) return sum
      const angle = 2 * Math.asin(Math.min(1, chord / (2 * Math.abs(seg.radius))))
      return sum + Math.abs(seg.radius) * angle
    }
    return sum
  }, 0)
}

function getHeightAtLength(heightAssignments = [], len = 0) {
  if (!Array.isArray(heightAssignments) || heightAssignments.length === 0) return 0
  const sorted = [...heightAssignments].sort((a, b) => a.length - b.length)
  let chosen = sorted[0]
  let current = null;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].length <= len + 1e-6) {
      chosen = sorted[i]
    } else {
      current = sorted[i]
      break
    }
  }
  
  if (chosen.length >= len || current === null) {
    return Number(chosen?.height) || 0
  }

  return (len - chosen.length) / (current.length - chosen.length) * (current.height - chosen.height) + chosen.height;
}

export function getAxis3DPointsAtLength(axisData, heightAssignments, length) {
  const totalLength = computeAxisTotalLength(axisData)
  const clamped = Math.max(0, Math.min(length, totalLength))

  const pos2d = getPositionAtLength(axisData, clamped)
  const h = getHeightAtLength(heightAssignments, clamped)

  return { x: pos2d.x, y: h, z: pos2d.y }
}

function normalizeVec3(v) {
  const len = Math.hypot(v.x, v.y, v.z)
  if (!len) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function buildPerpendicularAxes(p1, p2) {
  const dir = normalizeVec3({ x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z })
  const globalX = { x: 1, y: 0, z: 0 }

  const projLen = dot(globalX, dir)
  if (projLen < 1e-6) {
    let xAxis = globalX;
    let yAxis = normalizeVec3(cross(dir, globalX));
    if (yAxis.y < 0) {
      yAxis = { x: -yAxis.x, y: -yAxis.y, z: -yAxis.z }
      xAxis = { x: -xAxis.x, y: -xAxis.y, z: -xAxis.z }
    }
    return { xAxis, yAxis, direction: dir }
  }

  let xAxis = { x: -dir.z, y: 0, z: dir.x }
  xAxis = normalizeVec3(xAxis)

  let yAxis = cross(dir, xAxis)
  yAxis = normalizeVec3(yAxis)

  if (yAxis.y < 0) {
    yAxis = { x: -yAxis.x, y: -yAxis.y, z: -yAxis.z }
    xAxis = { x: -xAxis.x, y: -xAxis.y, z: -xAxis.z }
  }

  return { xAxis, yAxis, direction: dir }
}

export function sampleProfilePoints(profile, options = {}) {
  const segments = profile?.segments || []
  if (!segments.length) return []

  const maxChord = options.maxChord || 5
  const minArcSteps = options.minArcSteps || 4
  const pts = []

  segments.forEach((seg, idx) => {
    if (idx === 0) {
      pts.push({ x: seg.start.x, y: seg.start.y })
    }

    if (seg.type === 'line' || !seg.radius) {
      pts.push({ x: seg.end.x, y: seg.end.y })
      return
    }

    const center = calculateArcCenter(seg.start, seg.end, seg.radius)
    if (!center) {
      pts.push({ x: seg.end.x, y: seg.end.y })
      return
    }

    const R = Math.abs(seg.radius)
    let startA = Math.atan2(seg.start.y - center.y, seg.start.x - center.x)
    let endA = Math.atan2(seg.end.y - center.y, seg.end.x - center.x)
    let angleDiff = endA - startA

    if (seg.radius > 0 && angleDiff < 0) angleDiff += 2 * Math.PI
    if (seg.radius < 0 && angleDiff > 0) angleDiff -= 2 * Math.PI

    const arcLength = Math.abs(angleDiff) * R
    const steps = Math.max(minArcSteps, Math.ceil(arcLength / Math.max(0.1, maxChord)))

    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const ang = startA + angleDiff * t
      pts.push({ x: center.x + R * Math.cos(ang), y: center.y + R * Math.sin(ang) })
    }
  })

  if (pts.length > 1) {
    const first = pts[0]
    const last = pts[pts.length - 1]
    const gap = Math.hypot(first.x - last.x, first.y - last.y)
    if (gap > 1e-6) pts.push({ ...first })
  }

  return pts
}

function raySegmentIntersection(origin, dir, a, b) {
  const sx = b.x - a.x
  const sy = b.y - a.y
  const denom = dir.x * sy - dir.y * sx
  if (Math.abs(denom) < 1e-9) return null

  const t = (a.x * sy - a.y * sx) / denom
  const u = (a.x * dir.y - a.y * dir.x) / denom

  if (t < -1e-9 || u < -1e-9 || u > 1 + 1e-9) return null
  return { t, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t } }
}

function pointOnSegment(pt, a, b, tol = 1e-6) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) {
    return Math.hypot(pt.x - a.x, pt.y - a.y) < tol
  }
  const t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq
  if (t < -tol || t > 1 + tol) return false
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(pt.x - projX, pt.y - projY) < tol
}

export function intersectProfileWithRay(targetPoint, sampledPoints, options = {}) {
  const pts = sampledPoints || []
  if (!pts.length || (!targetPoint.x && !targetPoint.y)) return null

  const centroid = compute2DCentroid(pts)
  
  // Ray starts from centroid and goes in the direction of targetPoint
  const dirVec = { x: targetPoint.x, y: targetPoint.y }
  const mag = Math.hypot(dirVec.x, dirVec.y)
  if (mag < 1e-9) return null
  const dir = { x: dirVec.x / mag, y: dirVec.y / mag }
  const origin = centroid

  let best = null
  for (let i = 0; i < pts.length - 1; i++) {
    const hit = raySegmentIntersection(origin, dir, pts[i], pts[i + 1])
    if (hit && hit.t >= 0 && (best === null || hit.t < best.t)) {
      best = hit
    }
  }

  return best ? best.point : null
}

export function compute2DCentroid(points = []) {
  if (!points.length) return { x: 0, y: 0 }
  let sumX = 0
  let sumY = 0
  points.forEach(p => {
    sumX += p.x || 0
    sumY += p.y || 0
  })
  const n = points.length
  return { x: sumX / n, y: sumY / n }
}

function normalizeAngle(angle) {
  const twoPi = 2 * Math.PI
  let a = angle % twoPi
  if (a < 0) a += twoPi
  return a
}

export function mergeProfilesByAngle(profile1, profile2, options = {}) {
  const pts1 = sampleProfilePoints(profile1, options)
  const pts2 = sampleProfilePoints(profile2, options)
  const merged = []

  const collect = (sourcePts, otherPts, isSourceProfile1) => {
    sourcePts.forEach((pt) => {
      const centroid = compute2DCentroid(sourcePts)
      const rpt = { x: pt.x - centroid.x, y: pt.y - centroid.y }
      const match = intersectProfileWithRay(rpt, otherPts, options)
      if (!match) return;
      if (isSourceProfile1) {
        const angle = normalizeAngle(Math.atan2(pt.y, pt.x));
        merged.push({ angle, point1: pt, point2: match })
      } else {
        const angle = normalizeAngle(Math.atan2(match.y, match.x));
        merged.push({ angle, point1: match, point2: pt })
      }
    })
  }

  collect(pts1, pts2, true)
  collect(pts2, pts1, false)

  merged.sort((a, b) => a.angle - b.angle)
  return merged
}

function findProfile(profiles = [], id) {
  return (profiles || []).find(p => p.id === id) || null
}

export function interpolateProfileAtLength(length, profileAssignments, profiles, options = {}, isStart = true) {
  if (!Array.isArray(profileAssignments) || profileAssignments.length === 0) return null

  const sorted = [...profileAssignments].sort((a, b) => a.length - b.length)

  if (!isStart)
    length = length - 1e-8

  let prev = sorted[0]
  let next = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].length <= length && length <= sorted[i + 1].length) {
      prev = sorted[i]
      next = sorted[i + 1]
      break
    }
  }

  if (length < sorted[0].length - 1e-9) {
    prev = next = sorted[0]
  }
  if (length > sorted[sorted.length - 1].length + 1e-9) {
    prev = next = sorted[sorted.length - 1]
  }
  
  const p1 = findProfile(profiles, prev.profileId)
  const p2 = findProfile(profiles, next.profileId)
  if (!p1 || !p2) return null
  
  if (prev.length === next.length || prev.profileId === next.profileId) return sampleProfilePoints(p1, options)

  const t = Math.max(0, Math.min(1, (length - prev.length) / (next.length - prev.length)))
  const merged = mergeProfilesByAngle(p1, p2, options)
  if (!merged.length) return null

  return merged.map(({ point1, point2 }) => ({
    x: point1.x * (1 - t) + point2.x * t,
    y: point1.y * (1 - t) + point2.y * t,
  }))
}

export function buildProfileSection3DRange(axisData, heightAssignments, profileAssignments, profiles, lengthA, lengthB, lengthC, options = {}) {
  const centerA = getAxis3DPointsAtLength(axisData, heightAssignments, lengthA)
  const centerB = getAxis3DPointsAtLength(axisData, heightAssignments, lengthB)
  const centerC = lengthC ? getAxis3DPointsAtLength(axisData, heightAssignments, lengthC) : null

  const profileA = interpolateProfileAtLength(lengthA, profileAssignments, profiles, options, true)
  const profileB = interpolateProfileAtLength(lengthB, profileAssignments, profiles, options, false)

  if (!profileA || !profileB || !profileA.length || !profileB.length) {
    return null
  }
  if (profileA.length !== profileB.length) return null

  const frame = buildPerpendicularAxes(centerA, centerB)
  const frame1 = centerC ? buildPerpendicularAxes(centerB, centerC) : null

  const projectProfile = (center, pts, frame) => {
    const { xAxis, yAxis } = frame
    return pts.map((pt) => ({
      x: center.x + xAxis.x * pt.x + yAxis.x * pt.y,
      y: center.y + xAxis.y * pt.x + yAxis.y * pt.y,
      z: center.z + xAxis.z * pt.x + yAxis.z * pt.y,
    }))
  }

  return {
    frame: { ...frame, centerA, centerB },
    profile1Points: projectProfile(centerA, profileA, frame),
    profile2Points: projectProfile(centerB, profileB, frame1 ? frame1 : frame),
  }
}

export function collectSampleLengths(axisData, heightAssignments, profileAssignments, options = {}) {
  const lengths = new Set()
  const arcStep = options.arcStep || 10
  const axisArcStep = options.axisArcStep || 2 // Use more points for axis arcs
  let cum = 0

  const axisArr = Array.isArray(axisData) ? axisData : []
  axisArr.forEach((seg) => {
    lengths.add(Number(cum.toFixed(6)))
    if (seg.type === 'line') {
      const dx = seg.end.x - seg.start.x
      const dy = seg.end.y - seg.start.y
      const L = Math.hypot(dx, dy)
      cum += L
      lengths.add(Number(cum.toFixed(6)))
    } else if (seg.type === 'arc' && seg.radius) {
      const center = calculateArcCenter(seg.start, seg.end, seg.radius)
      if (!center) return
      const R = Math.abs(seg.radius)
      let startA = Math.atan2(seg.start.y - center.y, seg.start.x - center.x)
      let endA = Math.atan2(seg.end.y - center.y, seg.end.x - center.x)
      let angleDiff = endA - startA
      if (seg.radius > 0 && angleDiff < 0) angleDiff += 2 * Math.PI
      if (seg.radius < 0 && angleDiff > 0) angleDiff -= 2 * Math.PI
      const arcLen = Math.abs(angleDiff) * R
      const steps = Math.max(1, Math.ceil(arcLen / Math.max(1, axisArcStep)))
      for (let i = 1; i < steps; i++) {
        const frac = i / steps
        lengths.add(Number((cum + arcLen * frac).toFixed(6)))
      }
      cum += arcLen
      lengths.add(Number(cum.toFixed(6)))
    }
  })

  ;(heightAssignments || []).forEach(h => lengths.add(Number((h.length || 0).toFixed(6))))
  ;(profileAssignments || []).forEach(p => lengths.add(Number((p.length || 0).toFixed(6))))

  const total = computeAxisTotalLength(axisData)
  lengths.add(0)
  lengths.add(Number(total.toFixed(6)))

  return Array.from(lengths).sort((a, b) => a - b)
}

// Exported for tests
export const __private__ = {
  computeAxisTotalLength,
  getHeightAtLength,
  raySegmentIntersection,
  normalizeAngle,
  normalizeVec3,
}

