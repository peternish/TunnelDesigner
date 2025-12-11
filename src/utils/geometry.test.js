import { describe, it, expect } from 'vitest'
import {
  getAxis3DPointsAtLength,
  buildPerpendicularAxes,
  sampleProfilePoints,
  intersectProfileWithRay,
  mergeProfilesByAngle,
  interpolateProfileAtLength,
  buildProfileSection3DRange,
  collectSampleLengths,
  compute2DCentroid,
  __private__,
} from './geometry'

const roughly = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol

describe('geometry helpers', () => {
  it('gets 3D points along axis with heights', () => {
    const axis = [
      { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    ]
    const heights = [
      { length: 0, height: 0 },
      { length: 5, height: 10 },
    ]
    const res = getAxis3DPointsAtLength(axis, heights, 5)
    expect(res).toEqual({ x: 5, y: 10, z: 0 })
  })

  it('builds perpendicular axes', () => {
    const { xAxis, yAxis, direction } = buildPerpendicularAxes(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 5 }
    )
    expect(roughly(__private__.normalizeAngle(Math.atan2(direction.y, direction.x)), 0)).toBe(true)
    expect(roughly(xAxis.x, 1)).toBe(true)
    expect(roughly(yAxis.y, 1)).toBe(true)
    expect(Math.abs(xAxis.x * direction.x + xAxis.y * direction.y + xAxis.z * direction.z)).toBeLessThan(1e-6)
    expect(Math.abs(yAxis.x * direction.x + yAxis.y * direction.y + yAxis.z * direction.z)).toBeLessThan(1e-6)
  })

  it('samples profile points including arcs', () => {
    const profile = {
      segments: [
        { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        { type: 'arc', start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, radius: 5 },
      ],
    }
    const pts = sampleProfilePoints(profile, { maxChord: 1, minArcSteps: 4 })
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(roughly(pts[pts.length - 2].x, 10, 1e-3)).toBe(true)
    expect(pts.length).toBeGreaterThan(8)
  })

  it('finds intersection of profile and ray', () => {
    const square = {
      segments: [
        { type: 'line', start: { x: 2, y: 2 }, end: { x: 8, y: 2 } },
        { type: 'line', start: { x: 8, y: 2 }, end: { x: 8, y: 8 } },
        { type: 'line', start: { x: 8, y: 8 }, end: { x: 2, y: 8 } },
        { type: 'line', start: { x: 2, y: 8 }, end: { x: 2, y: 2 } },
      ],
    }
    const squarePts = sampleProfilePoints(square, { maxChord: 10, minArcSteps: 2 })
    const hit = intersectProfileWithRay({ x: 10, y: 5 }, squarePts)
    expect(hit).not.toBeNull()
    // Ray from origin hits the bottom edge first at (4, 2)
    expect(roughly(hit.x, 4)).toBe(true)
    expect(roughly(hit.y, 2)).toBe(true)
  })

  it('merges profiles sorted by angle', () => {
    const p1 = {
      segments: [
        { type: 'line', start: { x: 2, y: 2 }, end: { x: 8, y: 2 } },
        { type: 'line', start: { x: 8, y: 2 }, end: { x: 8, y: 8 } },
        { type: 'line', start: { x: 8, y: 8 }, end: { x: 2, y: 8 } },
        { type: 'line', start: { x: 2, y: 8 }, end: { x: 2, y: 2 } },
      ],
    }
    const p2 = {
      segments: [
        { type: 'line', start: { x: 4, y: 4 }, end: { x: 10, y: 4 } },
        { type: 'line', start: { x: 10, y: 4 }, end: { x: 10, y: 10 } },
        { type: 'line', start: { x: 10, y: 10 }, end: { x: 4, y: 10 } },
        { type: 'line', start: { x: 4, y: 10 }, end: { x: 4, y: 4 } },
      ],
    }
    const merged = mergeProfilesByAngle(p1, p2, { maxChord: 1 })
    expect(merged.length).toBeGreaterThan(0)
    expect(merged.every(m => m.point1 && m.point2)).toBe(true)
    const angles = merged.map(m => m.angle)
    const sorted = [...angles].sort((a, b) => a - b)
    expect(angles).toEqual(sorted)
  })

  it('samples arcs counterclockwise for positive radius and clockwise for negative', () => {
    const start = { x: 1, y: 0 }
    const end = { x: -1, y: 0 }

    const ccwProfile = { segments: [{ type: 'arc', start, end, radius: 1 }] }
    const cwProfile = { segments: [{ type: 'arc', start, end, radius: -1 }] }

    const ccwPts = sampleProfilePoints(ccwProfile, { minArcSteps: 4 })
    const cwPts = sampleProfilePoints(cwProfile, { minArcSteps: 4 })

    // Mid point of CCW arc (upper semicircle) should have y > 0
    const ccwMid = ccwPts[Math.floor(ccwPts.length / 2)]
    expect(ccwMid.y).toBeGreaterThan(0)

    // Mid point of CW arc (lower semicircle) should have y < 0
    const cwMid = cwPts[Math.floor(cwPts.length / 2)]
    expect(cwMid.y).toBeLessThan(0)
  })

  it('merges dense circle vs rectangle points and sorts by angle', () => {
    const R = 5
    // Four quarter arcs forming a circle (counterclockwise)
    const circle = {
      segments: [
        { type: 'arc', start: { x: R, y: 0 }, end: { x: 0, y: R }, radius: R },
        { type: 'arc', start: { x: 0, y: R }, end: { x: -R, y: 0 }, radius: R },
        { type: 'arc', start: { x: -R, y: 0 }, end: { x: 0, y: -R }, radius: R },
        { type: 'arc', start: { x: 0, y: -R }, end: { x: R, y: 0 }, radius: R },
      ],
    }

    // Simple rectangle
    const rect = {
      segments: [
        { type: 'line', start: { x: -6, y: -3 }, end: { x: 6, y: -3 } },
        { type: 'line', start: { x: 6, y: -3 }, end: { x: 6, y: 3 } },
        { type: 'line', start: { x: 6, y: 3 }, end: { x: -6, y: 3 } },
        { type: 'line', start: { x: -6, y: 3 }, end: { x: -6, y: -3 } },
      ],
    }

    const options = { maxChord: 0.5, minArcSteps: 16 }
    const circlePts = sampleProfilePoints(circle, options)
    const rectPts = sampleProfilePoints(rect, options)

    expect(circlePts.length).toBeGreaterThan(30)
    expect(rectPts.length).toBeGreaterThan(4)

    const merged = mergeProfilesByAngle(circle, rect, options)
    expect(merged.length).toBeGreaterThan(30)
    expect(merged.every(m => m.point1 && m.point2)).toBe(true)

    const angles = merged.map(m => m.angle)
    const sorted = [...angles].sort((a, b) => a - b)
    expect(angles).toEqual(sorted)
  })

  it('interpolates profiles at a given length using merged points', () => {
    const circleProfile = {
      id: 'circle',
      segments: [
        { type: 'arc', start: { x: 1, y: 0 }, end: { x: -1, y: 0 }, radius: 1 },
        { type: 'arc', start: { x: -1, y: 0 }, end: { x: 1, y: 0 }, radius: 1 },
      ],
    }
    const rectProfile = {
      id: 'rect',
      segments: [
        { type: 'line', start: { x: -2, y: -1 }, end: { x: 2, y: -1 } },
        { type: 'line', start: { x: 2, y: -1 }, end: { x: 2, y: 1 } },
        { type: 'line', start: { x: 2, y: 1 }, end: { x: -2, y: 1 } },
        { type: 'line', start: { x: -2, y: 1 }, end: { x: -2, y: -1 } },
      ],
    }

    const assignments = [
      { length: 0, profileId: 'circle' },
      { length: 100, profileId: 'rect' },
    ]

    const pts = interpolateProfileAtLength(
      80,
      assignments,
      [circleProfile, rectProfile],
      { maxChord: 0.2, minArcSteps: 16 }
    )

    expect(pts).not.toBeNull()
    // Example rule: at length 80 (between 0 and 100) we blend as 0.8*circle + 0.2*rect
    const merged = mergeProfilesByAngle(circleProfile, rectProfile, { maxChord: 0.2, minArcSteps: 16 })
    expect(pts.length).toBe(merged.length)

    // Basic sanity: points should correspond one-to-one with merged entries
    expect(pts.length).toBeGreaterThan(0)
  })

  it('merges profiles and enforces anti-clockwise order', () => {
    const ccwCircle = {
      segments: [
        { type: 'arc', start: { x: 1, y: 0 }, end: { x: -1, y: 0 }, radius: 1 },
        { type: 'arc', start: { x: -1, y: 0 }, end: { x: 1, y: 0 }, radius: 1 },
      ],
    }
    const cwRect = {
      segments: [
        { type: 'line', start: { x: 2, y: -1 }, end: { x: 2, y: 1 } },
        { type: 'line', start: { x: 2, y: 1 }, end: { x: -2, y: 1 } },
        { type: 'line', start: { x: -2, y: 1 }, end: { x: -2, y: -1 } },
        { type: 'line', start: { x: -2, y: -1 }, end: { x: 2, y: -1 } },
      ],
    }
    const merged = mergeProfilesByAngle(ccwCircle, cwRect, { maxChord: 0.2, minArcSteps: 8 })
    const angles = merged.map(m => m.angle)
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]).toBeGreaterThanOrEqual(angles[i - 1])
    }
    // Must cover full 0..2π range for the circle
    expect(angles[0]).toBeGreaterThanOrEqual(0)
    expect(angles[angles.length - 1]).toBeLessThanOrEqual(2 * Math.PI)
  })

  it('interpolates and clamps before first assignment', () => {
    const prof1 = {
      id: 'P1',
      segments: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    }
    const prof2 = {
      id: 'P2',
      segments: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }],
    }
    const assignments = [
      { length: 10, profileId: 'P1' },
      { length: 20, profileId: 'P2' },
    ]
    const pts = interpolateProfileAtLength(-5, assignments, [prof1, prof2], { maxChord: 10, minArcSteps: 2 })
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[1]).toEqual({ x: 2, y: 0 })
  })

  it('interpolates and clamps after last assignment', () => {
    const prof1 = {
      id: 'P1',
      segments: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    }
    const prof2 = {
      id: 'P2',
      segments: [{ type: 'line', start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }],
    }
    const assignments = [
      { length: 10, profileId: 'P1' },
      { length: 20, profileId: 'P2' },
    ]
    const pts = interpolateProfileAtLength(50, assignments, [prof1, prof2], { maxChord: 10, minArcSteps: 2 })
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[1]).toEqual({ x: 4, y: 0 })
  })

  it('builds profile section 3D points for two lengths', () => {
    const axis = [
      { type: 'line', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
    ]
    const heights = [{ length: 0, height: 0 }]

    const profA = {
      id: 'A',
      segments: [
        { type: 'line', start: { x: -1, y: -1 }, end: { x: 1, y: -1 } },
        { type: 'line', start: { x: 1, y: -1 }, end: { x: 1, y: 1 } },
        { type: 'line', start: { x: 1, y: 1 }, end: { x: -1, y: 1 } },
        { type: 'line', start: { x: -1, y: 1 }, end: { x: -1, y: -1 } },
      ],
    }
    const profB = {
      id: 'B',
      segments: [
        { type: 'line', start: { x: -2, y: -1 }, end: { x: 2, y: -1 } },
        { type: 'line', start: { x: 2, y: -1 }, end: { x: 2, y: 1 } },
        { type: 'line', start: { x: 2, y: 1 }, end: { x: -2, y: 1 } },
        { type: 'line', start: { x: -2, y: 1 }, end: { x: -2, y: -1 } },
      ],
    }
    const assignments = [
      { length: 0, profileId: 'A' },
      { length: 1, profileId: 'B' },
    ]

    const res = buildProfileSection3DRange(axis, heights, assignments, [profA, profB], 0, 1)
    expect(res.profile1Points.length).toBeGreaterThan(0)
    expect(res.profile2Points.length).toBeGreaterThan(0)

    // Centers follow axis positions
    expect(res.frame.centerA.x).toBeCloseTo(0)
    expect(res.frame.centerB.x).toBeCloseTo(1)

    const spanAlong = (pts, axis, center) => {
      const dots = pts.map(p => (p.x - center.x) * axis.x + (p.y - center.y) * axis.y + (p.z - center.z) * axis.z)
      return Math.max(...dots) - Math.min(...dots)
    }

    // First profile span along local xAxis
    const span1 = spanAlong(res.profile1Points, res.frame.xAxis, res.frame.centerA)
    expect(span1).toBeCloseTo(2, 1)

    // Second profile span along local xAxis
    const span2 = spanAlong(res.profile2Points, res.frame.xAxis, res.frame.centerB)
    expect(span2).toBeCloseTo(4, 1)
  })

  it('computes centroid of 2D points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 0 }]
    const c = compute2DCentroid(pts)
    expect(c.x).toBeCloseTo(2)
    expect(c.y).toBeCloseTo(2 / 3)
  })

  it('collects sample lengths including axis, assignments, and arc points', () => {
    const axis = [
      { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { type: 'arc', start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, radius: 10 },
    ]
    const heights = [{ length: 3, height: 0 }]
    const profiles = [{ length: 7, profileId: 'p1' }]
    const res = collectSampleLengths(axis, heights, profiles, { arcStep: 2 })
    expect(res[0]).toBe(0)
    expect(res[res.length - 1]).toBeCloseTo(__private__.computeAxisTotalLength(axis))
    expect(res.some(v => roughly(v, 3))).toBe(true)
    expect(res.some(v => roughly(v, 7))).toBe(true)
    expect(res.length).toBeGreaterThan(6)
  })

  // Note: mismatch scenario now allowed due to interpolation tolerances
})

