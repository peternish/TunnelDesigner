import { useState, useEffect } from 'react'
import AxisEditor from './components/AxisEditor'
import ProfileEditor from './components/ProfileEditor'
import ProfileAssignment from './components/ProfileAssignment'
import TunnelViewer from './components/TunnelViewer'
import HeightSettings from './components/HeightSettings'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('axis')
  const [axisData, setAxisData] = useState([])
  const [axisPoints, setAxisPoints] = useState(() => {
    try {
      const stored = window.localStorage.getItem('tunnel-axis-points-v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })
  const [profiles, setProfiles] = useState(() => {
    try {
      const stored = window.localStorage.getItem('tunnel-profiles-v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })
  const [profileAssignments, setProfileAssignments] = useState(() => {
    try {
      const stored = window.localStorage.getItem('tunnel-profile-assignments-v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })
  const [heightAssignments, setHeightAssignments] = useState(() => {
    try {
      const stored = window.localStorage.getItem('tunnel-height-assignments-v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })

  const computeAxisTotalLength = (segments) => {
    if (!segments || segments.length === 0) return 0
    return segments.reduce((sum, seg) => {
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

  useEffect(() => {
    try {
      window.localStorage.setItem('tunnel-profiles-v1', JSON.stringify(profiles))
    } catch {
      // ignore
    }
  }, [profiles])

  // Persist axis points
  useEffect(() => {
    try {
      window.localStorage.setItem('tunnel-axis-points-v1', JSON.stringify(axisPoints))
    } catch {
      // ignore
    }
  }, [axisPoints])

  // Persist profile assignments (length-based), cleaned and sorted
  useEffect(() => {
    const validProfileIds = new Set(profiles.map(p => p.id))
    const totalLen = computeAxisTotalLength(axisData)
    if (totalLen <= 0) return // wait until axis length is available

    let merged = [...profileAssignments]
    merged = merged
      .filter(a => (a.profileId === null || validProfileIds.has(a.profileId)) && a.length >= 0 && a.length <= totalLen + 1e-6)
      .sort((a, b) => a.length - b.length)

    const mergedJson = JSON.stringify(merged)
    const currentJson = JSON.stringify(profileAssignments)
    if (mergedJson !== currentJson) {
      setProfileAssignments(merged)
      try {
        window.localStorage.setItem('tunnel-profile-assignments-v1', mergedJson)
      } catch {
        // ignore
      }
    }
  }, [profileAssignments, profiles, axisData])

  // Persist height assignments (length-based), cleaned and sorted
  useEffect(() => {
    const totalLen = computeAxisTotalLength(axisData)
    if (totalLen <= 0) return // wait until axis length is available

    let merged = [...heightAssignments]
    merged = merged
      .filter(a => a.length >= 0 && a.length <= totalLen + 1e-6)
      .map(a => ({ ...a, height: Number(a.height) || 0 }))
      .sort((a, b) => a.length - b.length)

    const mergedJson = JSON.stringify(merged)
    const currentJson = JSON.stringify(heightAssignments)
    if (mergedJson !== currentJson) {
      setHeightAssignments(merged)
      try {
        window.localStorage.setItem('tunnel-height-assignments-v1', mergedJson)
      } catch {
        // ignore
      }
    }
  }, [heightAssignments, axisData])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tunnel Designer</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'axis' ? 'active' : ''}
            onClick={() => setActiveTab('axis')}
          >
            Axis Design
          </button>
          <button
            className={activeTab === 'height' ? 'active' : ''}
            onClick={() => setActiveTab('height')}
          >
            Height
          </button>
          <button
            className={activeTab === 'profiles' ? 'active' : ''}
            onClick={() => setActiveTab('profiles')}
          >
            Profiles
          </button>
          <button
            className={activeTab === 'assignment' ? 'active' : ''}
            onClick={() => setActiveTab('assignment')}
          >
            Profile Assignment
          </button>
          <button
            className={activeTab === 'viewer' ? 'active' : ''}
            onClick={() => setActiveTab('viewer')}
          >
            Viewer
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'axis' && (
          <AxisEditor
            axisData={axisData}
            setAxisData={setAxisData}
            axisPoints={axisPoints}
            setAxisPoints={setAxisPoints}
          />
        )}
        {activeTab === 'profiles' && (
          <ProfileEditor profiles={profiles} setProfiles={setProfiles} />
        )}
        {activeTab === 'assignment' && (
          <ProfileAssignment
            axisData={axisData}
            profiles={profiles}
            profileAssignments={profileAssignments}
            setProfileAssignments={setProfileAssignments}
            totalLength={computeAxisTotalLength(axisData)}
          />
        )}
        {activeTab === 'height' && (
          <HeightSettings
            axisData={axisData}
            heightAssignments={heightAssignments}
            setHeightAssignments={setHeightAssignments}
            totalLength={computeAxisTotalLength(axisData)}
          />
        )}
        {activeTab === 'viewer' && (
          <TunnelViewer
            axisData={axisData}
            profiles={profiles}
            profileAssignments={profileAssignments}
            heightAssignments={heightAssignments}
          />
        )}
      </main>
    </div>
  )
}

export default App

