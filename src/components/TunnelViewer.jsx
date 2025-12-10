import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildProfileSection3DRange, collectSampleLengths, __private__ } from '../utils/geometry'
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

    // Build tunnel meshes by sampling along the axis using the new geometry helpers
    const sampleLengths = collectSampleLengths(axisData, heightAssignments, profileAssignments, { arcStep: 10, axisArcStep: 1 })
  
    const material = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })

    for (let i = 0; i < sampleLengths.length - 1; i++) {
      const lenA = sampleLengths[i]
      const lenB = sampleLengths[i + 1]
      const lenC = i < sampleLengths.length - 2 ? sampleLengths[i + 2] : null
      const section = buildProfileSection3DRange(
        axisData,
        heightAssignments,
        profileAssignments,
        profiles,
        lenA,
        lenB,
        lenC,
        { maxChord: 5, minArcSteps: 4 }
      )

      const { profile1Points, profile2Points } = section || {}
      if (!profile1Points || !profile2Points) continue
      if (profile1Points.length !== profile2Points.length || profile1Points.length < 3) continue

      const radialCount = profile1Points.length
      const positions = []
      const indices = []

      profile1Points.forEach((p) => positions.push(p.x, p.y, invertY ? -p.z : p.z))
      profile2Points.forEach((p) => positions.push(p.x, p.y, invertY ? -p.z : p.z))

      for (let i = 0; i < radialCount; i++) {
        const nextI = (i + 1) % radialCount
        const a = i
        const b = radialCount + i
        const c = radialCount + nextI
        const d = nextI
        indices.push(a, b, d)
        indices.push(b, c, d)
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const mesh = new THREE.Mesh(geometry, material)
      tunnelGroup.add(mesh)
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

