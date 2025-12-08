import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { calculateArcCenter } from '../utils/geometry'
import './TunnelViewer.css'

function TunnelViewer({ axisData, profiles, profileAssignments, heightAssignments, invertY = true }) {
  const threeContainerRef = useRef(null)

  // Basic 3D view of the tunnel using three.js
  useEffect(() => {
    if (!threeContainerRef.current) return

    const container = threeContainerRef.current
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || 400

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000)
    camera.position.set(0, 150, 400)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(200, 300, 100)
    scene.add(dirLight)

    // Simple ground grid
    const grid = new THREE.GridHelper(1000, 20, 0x555555, 0x333333)
    scene.add(grid)

    // Build a 3D representation of the axis and tunnel
    const axisGroup = new THREE.Group()
    const tunnelGroup = new THREE.Group()

    // Convert a profile (with lines + arcs) into a dense polyline of 2D points
    const buildProfilePolyline = (profile) => {
      const poly = []
      if (!profile) return poly

      if (profile.segments && profile.segments.length > 0) {
        profile.segments.forEach((seg, idx) => {
          if (idx === 0) {
            poly.push({ x: seg.start.x, y: seg.start.y })
          }

          if (seg.type === 'line') {
            poly.push({ x: seg.end.x, y: seg.end.y })
          } else if (seg.type === 'arc' && seg.radius) {
            const start = { x: seg.start.x, y: invertY ? -seg.start.y : seg.start.y }
            const end = { x: seg.end.x, y: invertY ? -seg.end.y : seg.end.y }
            const center = calculateArcCenter(start, end, seg.radius)
            if (!center) {
              poly.push({ x: end.x, y: end.y })
              return
            }

            const R = Math.abs(seg.radius)
            let startAngle = Math.atan2(start.y - center.y, start.x - center.x)
            let endAngle = Math.atan2(end.y - center.y, end.x - center.x)
            let angleDiff = endAngle - startAngle

            // Adjust direction based on radius sign
            if (seg.radius > 0 && angleDiff < 0) angleDiff += 2 * Math.PI
            if (seg.radius < 0 && angleDiff > 0) angleDiff -= 2 * Math.PI

            const arcLength = Math.abs(angleDiff) * R
            const steps = Math.max(8, Math.ceil(arcLength / 2)) // ~ every 2 units

            for (let i = 1; i <= steps; i++) {
              const t = i / steps
              const ang = startAngle + angleDiff * t
              const x = center.x + R * Math.cos(ang)
              const y = center.y + R * Math.sin(ang)
              poly.push({
                x: x,
                y: invertY ? -y : y,
              })
            }
          }
        })
      } else if (profile.points && profile.points.length > 0) {
        profile.points.forEach((pt) => {
          poly.push({ x: pt.x, y: pt.y })
        })
      }

      return poly
    }

    // Sample an axis segment (line or arc) into positions + tangents in 3D (X-Z plane)
    const sampleAxisSegment = (segment, baseStep = 10) => {
    const samples = []
      if (!segment) return samples

      const SCALE = 1 // world units per axis unit

      if (segment.type === 'line') {
        // Map 2D coordinates to 3D: X→X, Y→Z
        // Apply Y inversion if needed to match 2D view orientation
        const yScale = invertY ? -1 : 1
        const start2 = new THREE.Vector3(segment.start.x * SCALE, 0, segment.start.y * SCALE * yScale)
        const end2 = new THREE.Vector3(segment.end.x * SCALE, 0, segment.end.y * SCALE * yScale)
        const diff = new THREE.Vector3().subVectors(end2, start2)
        const length = diff.length()
        const steps = Math.max(2, Math.ceil(length / baseStep))
        const tangent = diff.clone().normalize()

        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const pos = new THREE.Vector3().addVectors(
            start2,
            diff.clone().multiplyScalar(t)
          )
          samples.push({ position: pos, tangent: tangent.clone() })
        }
      } else if (segment.type === 'arc' && segment.radius) {
        const start = { x: segment.start.x, y: invertY ? -segment.start.y : segment.start.y }
        const end = { x: segment.end.x, y: invertY ? -segment.end.y : segment.end.y }
        const center2d = calculateArcCenter(start, end, segment.radius)
        if (!center2d) return samples

        const R = Math.abs(segment.radius)
        let startAngle = Math.atan2(start.y - center2d.y, start.x - center2d.x)
        let endAngle = Math.atan2(end.y - center2d.y, end.x - center2d.x)
        let angleDiff = endAngle - startAngle

        if (segment.radius > 0 && angleDiff < 0) angleDiff += 2 * Math.PI
        if (segment.radius < 0 && angleDiff > 0) angleDiff -= 2 * Math.PI

        const arcLength = Math.abs(angleDiff) * R
        const steps = Math.max(8, Math.ceil(arcLength / baseStep))

          for (let i = 0; i <= steps; i++) {
            const t = i / steps
          const ang = startAngle + angleDiff * t
          const x = center2d.x + R * Math.cos(ang)
          const y = center2d.y + R * Math.sin(ang)
          // Apply Y inversion if needed to match 2D view orientation
          const yScale = invertY ? 1 : -1
          const pos = new THREE.Vector3(x * SCALE, 0, y * SCALE * yScale)

          // Tangent is along the circle direction
          const tx = -Math.sin(ang)
          const ty = Math.cos(ang)
          const tangent = new THREE.Vector3(tx, 0, ty).normalize()

          samples.push({ position: pos, tangent })
        }
      }

      return samples
    }

    // Draw axis polyline (for reference)
    if (axisData && axisData.length > 0) {
      const axisMaterial = new THREE.LineBasicMaterial({ color: 0x2c3e50 })
      const axisGeometry = new THREE.BufferGeometry()
      const axisPoints3D = []

      const SCALE = 1
      const yScale = invertY ? -1 : 1
      axisData.forEach((segment, idx) => {
        if (idx === 0) {
          axisPoints3D.push(
            new THREE.Vector3(segment.start.x * SCALE, 0, segment.start.y * SCALE * yScale)
          )
        }
        axisPoints3D.push(
          new THREE.Vector3(segment.end.x * SCALE, 0, segment.end.y * SCALE * yScale)
        )
      })

      axisGeometry.setFromPoints(axisPoints3D)
      const axisLine = new THREE.Line(axisGeometry, axisMaterial)
      axisGroup.add(axisLine)
    }

    // Build tunnel mesh by sweeping profiles along the axis (length-based)
    const up = new THREE.Vector3(0, 1, 0)

    // Helpers to find profile/height at a given cumulative length
    const findProfileAtLength = (len) => {
      if (!profileAssignments || profileAssignments.length === 0) return null
      const sorted = [...profileAssignments].sort((a, b) => a.length - b.length)
      let chosen = sorted[0]
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].length <= len + 1e-6) chosen = sorted[i]
        else break
      }
      return profiles.find(p => p.id === chosen?.profileId) || null
    }

    const findHeightAtLength = (len) => {
      if (!heightAssignments || heightAssignments.length === 0) return 0
      const sorted = [...heightAssignments].sort((a, b) => a.length - b.length)
      let chosen = sorted[0]
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].length <= len + 1e-6) chosen = sorted[i]
        else break
      }
      return chosen ? Number(chosen.height) || 0 : 0
    }

    // Sweep by sampling each segment with a fixed step
    const STEP = 10
    let cumLen = 0

    const polyCache = new Map()
    const getPolyForProfile = (profile) => {
      if (!profile) return null
      if (polyCache.has(profile.id)) return polyCache.get(profile.id)
      const poly = buildProfilePolyline(profile)
      polyCache.set(profile.id, poly)
      return poly
    }

    const radialCache = new Map()
    const getRadial = (profile) => {
      if (!profile) return null
      if (radialCache.has(profile.id)) return radialCache.get(profile.id)
      const poly2d = getPolyForProfile(profile)
      if (!poly2d || poly2d.length < 3) return null
      const radial = { poly2d, radialCount: poly2d.length }
      radialCache.set(profile.id, radial)
      return radial
    }

    for (let segIndex = 0; segIndex < axisData.length; segIndex++) {
      const segment = axisData[segIndex]
      const samples = sampleAxisSegment(segment, STEP)
      if (samples.length < 2) continue

      // cumulative distances within segment
      const distances = [0]
      for (let i = 1; i < samples.length; i++) {
        distances.push(distances[i - 1] + samples[i].position.distanceTo(samples[i - 1].position))
      }
      const segLen = distances[distances.length - 1]

      const rings = []
      for (let i = 0; i < samples.length; i++) {
        const globalLen = cumLen + distances[i]
        const profile = findProfileAtLength(globalLen)
        const radial = getRadial(profile)
        const heightOffset = findHeightAtLength(globalLen)
        if (!radial) continue

        const { poly2d, radialCount } = radial
        const { position, tangent } = samples[i]
        const dir = tangent.clone().normalize()
        let binormal = new THREE.Vector3().crossVectors(dir, up)
        if (binormal.lengthSq() < 1e-6) binormal = new THREE.Vector3(1, 0, 0)
        else binormal.normalize()

        const ring = []
        poly2d.forEach((pt) => {
          const v = new THREE.Vector3().copy(position)
          v.add(binormal.clone().multiplyScalar(pt.x))
          v.add(up.clone().multiplyScalar(pt.y + heightOffset))
          ring.push(v)
        })
        rings.push({ ring, radialCount })
      }

      if (rings.length < 2) {
        cumLen += segLen
        continue
      }

      const positions = []
      const indices = []
      const radialCount = rings[0].radialCount

      rings.forEach(({ ring }) => {
        ring.forEach(v => {
          positions.push(v.x, v.y, v.z)
        })
      })

      const ringCount = rings.length
      for (let r = 0; r < ringCount - 1; r++) {
        for (let i = 0; i < radialCount; i++) {
          const nextI = (i + 1) % radialCount
          const a = r * radialCount + i
          const b = (r + 1) * radialCount + i
          const c = (r + 1) * radialCount + nextI
          const d = r * radialCount + nextI
          indices.push(a, b, d)
          indices.push(b, c, d)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const material = new THREE.MeshStandardMaterial({
        color: 0x27ae60,
        metalness: 0.1,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geometry, material)
      tunnelGroup.add(mesh)

      cumLen += segLen
    }

    scene.add(axisGroup)
    scene.add(tunnelGroup)

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', onResize)

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      container.innerHTML = ''
    }
  }, [axisData, profiles, profileAssignments, heightAssignments, invertY])

  return (
    <div className="tunnel-viewer">
      <div className="viewer-header">
        <h2>Tunnel Viewer</h2>
        <div className="viewer-info">
          <span>Axis Segments: {axisData.length}</span>
          <span>Profiles: {profiles.length}</span>
          <span>Assignments: {profileAssignments.length}</span>
        </div>
      </div>

      <div className="viewer-canvas">
        <div className="viewer-3d" ref={threeContainerRef}>
          <div className="viewer-3d-header">3D Tunnel View (three.js)</div>
        </div>
      </div>
    </div>
  )
}

export default TunnelViewer

