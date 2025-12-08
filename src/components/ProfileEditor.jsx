import { useState, useEffect } from 'react'
import SegmentCanvas from './SegmentCanvas'
import './ProfileEditor.css'

function ProfileEditor({ profiles, setProfiles }) {
  const canvasWidth = window.innerWidth - 460 // leave more room for left panel
  const canvasHeight = window.innerHeight - 200

  // Load selected profile from localStorage on mount
  const [selectedProfile, setSelectedProfile] = useState(() => {
    try {
      const stored = window.localStorage.getItem('tunnel-selected-profile-v1')
      if (stored) {
        const profileId = parseInt(stored, 10)
        return profileId
      }
    } catch {
      // ignore
    }
    return null
  })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: canvasWidth / 2, y: canvasHeight / 2 })
  const [selectedPointId, setSelectedPointId] = useState(null)

  // Persist selected profile to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedProfile !== null) {
        window.localStorage.setItem('tunnel-selected-profile-v1', selectedProfile.toString())
      } else {
        window.localStorage.removeItem('tunnel-selected-profile-v1')
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedProfile])

  const createNewProfile = () => {
    const newProfile = {
      id: Date.now(),
      name: `Profile ${profiles.length + 1}`,
      points: [],
      segments: []
    }
    setProfiles([...profiles, newProfile])
    setSelectedProfile(newProfile.id)
  }

  const currentProfile = profiles.find(p => p.id === selectedProfile)

  const buildSegmentsFromPoints = (pts) => {
    const segments = []
    if (!pts || pts.length < 2) return segments

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const segType = curr.type || 'line'

      if (segType === 'arc' && curr.radius && Number(curr.radius) !== 0) {
        segments.push({
          type: 'arc',
          start: { x: prev.x, y: prev.y },
          end: { x: curr.x, y: curr.y },
          radius: Number(curr.radius)
        })
      } else {
        segments.push({
          type: 'line',
          start: { x: prev.x, y: prev.y },
          end: { x: curr.x, y: curr.y }
        })
      }
    }
    return segments
  }

  const updateProfilePoints = (profileId, newPoints) => {
    const newSegments = buildSegmentsFromPoints(newPoints)
    setProfiles(profiles.map(p =>
      p.id === profileId ? { ...p, points: newPoints, segments: newSegments } : p
    ))
  }


  const deleteProfile = (id) => {
    const profile = profiles.find(p => p.id === id)
    const name = profile ? profile.name : 'this profile'
    const confirmed = window.confirm(`Delete ${name}? This cannot be undone.`)
    if (!confirmed) return

    setProfiles(profiles.filter(p => p.id !== id))
    if (selectedProfile === id) {
      setSelectedProfile(null)
    }
  }

  const updateProfileName = (id, newName) => {
    setProfiles(profiles.map(p => p.id === id ? { ...p, name: newName } : p))
  }

  const addPoint = () => {
    if (!currentProfile) return
    const newPoint = {
      id: Date.now(),
      x: 0,
      y: 0,
      type: 'line',
      radius: ''
    }
    const currentPoints = currentProfile.points || []
    const newPoints = [...currentPoints, newPoint]
    updateProfilePoints(currentProfile.id, newPoints)
  }

  const updatePoint = (pointId, field, value) => {
    if (!currentProfile) return
    let v = value
    if (field === 'x' || field === 'y' || field === 'radius') {
      v = value === '' ? '' : Number(value)
    }
    const currentPoints = currentProfile.points || []
    const newPoints = currentPoints.map(p =>
      p.id === pointId ? { ...p, [field]: v } : p
    )
    updateProfilePoints(currentProfile.id, newPoints)
  }

  const removePoint = (pointId) => {
    if (!currentProfile) return
    const currentPoints = currentProfile.points || []
    const newPoints = currentPoints.filter(p => p.id !== pointId)
    updateProfilePoints(currentProfile.id, newPoints)
  }

  const clearPoints = () => {
    if (!currentProfile) return
    updateProfilePoints(currentProfile.id, [])
  }

  const moveSelectedPoint = (direction) => {
    if (!currentProfile || selectedPointId === null) return
    const pts = [...(currentProfile.points || [])]
    const currentIndex = pts.findIndex(p => p.id === selectedPointId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= pts.length) return
    
    const [moved] = pts.splice(currentIndex, 1)
    pts.splice(newIndex, 0, moved)
    updateProfilePoints(currentProfile.id, pts)
  }

  const zoomIn = () => setZoom((z) => Math.min(4, z * 1.25))
  const zoomOut = () => setZoom((z) => Math.max(0.25, z / 1.25))
  const resetView = () => {
    setZoom(1)
    setOffset({ x: canvasWidth / 2, y: canvasHeight / 2 })
  }

  return (
    <div className="profile-editor">
      <div className="toolbar">
        <button onClick={createNewProfile}>New Profile</button>
        {currentProfile && (
          <>
            <input
              type="text"
              value={currentProfile.name}
              onChange={(e) => updateProfileName(currentProfile.id, e.target.value)}
              className="profile-name-input"
            />
            <div className="zoom-controls">
              <button onClick={zoomOut}>-</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn}>+</button>
              <button className="secondary" onClick={resetView}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      <div className="profile-editor-content">
        <div className="profiles-list">
          <h3>Profiles ({profiles.length})</h3>
          {profiles.map(profile => (
            <div
              key={profile.id}
              className={`profile-item ${selectedProfile === profile.id ? 'active' : ''}`}
              onClick={() => setSelectedProfile(profile.id)}
            >
              <b className="profile-name">{profile.name}</b>
              <span className="segment-count">({profile.segments.length} segments)</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteProfile(profile.id)
                }}
                className="delete-btn"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="canvas-container">
          {currentProfile ? (
            <SegmentCanvas
              segments={currentProfile.segments || []}
              points={(currentProfile.points || []).map(pt => ({
                id: pt.id,
                x: pt.x,
                y: pt.y
              }))}
              segmentColor="#27ae60"
              pointColor="#e67e22"
              segmentStrokeWidth={2}
              showGrid={true}
              showAxes={true}
              showOrigin={false}
              invertY={true}
              width={window.innerWidth - 460}
              height={window.innerHeight - 200}
              zoom={zoom}
              offset={offset}
              onDragEnd={(e) => {
                setOffset({ x: e.target.x(), y: e.target.y() })
              }}
            />
          ) : (
            <div className="no-profile-selected">
              <p>No profile selected. Create a new profile to start designing.</p>
            </div>
          )}
        </div>
        {currentProfile && (
          <div className="profile-points-panel">
            <div className="profile-points-header">
              <span>#</span>
              <span>X</span>
              <span>Y</span>
              <span>Type</span>
              <span>Radius</span>
            </div>

            {(currentProfile.points || []).map((pt, index) => (
              <div 
                key={pt.id} 
                className={`profile-point-row ${selectedPointId === pt.id ? 'selected' : ''}`}
                onClick={() => setSelectedPointId(pt.id)}
              >
                <span className="profile-point-index">
                  {index + 1}
                </span>
                <input
                  type="number"
                  value={pt.x}
                  onChange={(e) => updatePoint(pt.id, 'x', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="number"
                  value={pt.y}
                  onChange={(e) => updatePoint(pt.id, 'y', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                {index === 0 ? (
                  <>
                    <span></span>
                    <div className="profile-point-radius" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="delete-btn small"
                        onClick={() => removePoint(pt.id)}
                      >
                        ×
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <select
                      value={pt.type || 'line'}
                      onChange={(e) => updatePoint(pt.id, 'type', e.target.value)}
                      className="profile-point-type"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="line">Line</option>
                      <option value="arc">Arc</option>
                    </select>
                    <div className="profile-point-radius" onClick={(e) => e.stopPropagation()}>
                      {pt.type === 'arc' && (
                        <input
                          type="number"
                          value={pt.radius === '' ? '' : pt.radius}
                          onChange={(e) => updatePoint(pt.id, 'radius', e.target.value)}
                          placeholder="R"
                        />
                      )}
                      <button
                        className="delete-btn small"
                        onClick={() => removePoint(pt.id)}
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {(!currentProfile.points || currentProfile.points.length === 0) && (
              <p className="profile-points-empty">
                Add points to define this profile section. They will be connected in order.
              </p>
            )}

            <div className="profile-points-actions">
              <button onClick={addPoint}>Add Point</button>
              <button 
                onClick={() => moveSelectedPoint('up')} 
                className="secondary"
                disabled={selectedPointId === null || (currentProfile.points || []).findIndex(p => p.id === selectedPointId) === 0}
              >
                Move Up
              </button>
              <button 
                onClick={() => moveSelectedPoint('down')} 
                className="secondary"
                disabled={selectedPointId === null || (currentProfile.points || []).findIndex(p => p.id === selectedPointId) === (currentProfile.points || []).length - 1}
              >
                Move Down
              </button>
              <button onClick={clearPoints} className="secondary">
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileEditor

