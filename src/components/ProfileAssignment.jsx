import { useState, useMemo } from 'react'
import SegmentCanvas from './SegmentCanvas'
import './ProfileAssignment.css'
import { calculateArcCenter, getPositionAtLength } from '../utils/geometry'

function ProfileAssignment({ axisData, profiles, profileAssignments, setProfileAssignments, totalLength }) {
  const [selectedId, setSelectedId] = useState(null)
  const [pendingSort, setPendingSort] = useState(false)
  const canvasWidth = (window.innerWidth - 600) / 2 // Split width for right-hand views
  const canvasHeight = window.innerHeight - 400

  const ensureIds = (arr) =>
    arr.map(a => (a.id ? a : { ...a, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) }))

  const persist = (arr) => {
    try {
      window.localStorage.setItem('tunnel-profile-assignments-v1', JSON.stringify(arr))
    } catch {
      // ignore
    }
  }

  const sorted = useMemo(
    () => ensureIds([...(profileAssignments || [])]).sort((a, b) => a.length - b.length),
    [profileAssignments]
  )
  const selectedIndex = Math.max(0, sorted.findIndex(a => a.id === selectedId))
  const selected = sorted[selectedIndex] || sorted[0] || null

  const handleAssignProfile = (idx, value) => {
    const profileId = value === '' ? null : parseInt(value, 10)
    setProfileAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      if (!arr[idx]) return prev
      arr[idx] = { ...arr[idx], profileId }
      persist(arr)
      return arr
    })
  }

  const updateLength = (idx, value) => {
    const clamped = Math.min(totalLength, Math.max(0, Number(value) || 0))
    setProfileAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      if (!arr[idx]) return prev
      arr[idx] = { ...arr[idx], length: clamped }
      persist(arr)
      return arr
    })
    setPendingSort(true)
  }

  const addAssignment = () => {
    setProfileAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      const currentSorted = [...arr].sort((a, b) => a.length - b.length)
      const maxLen = currentSorted.length ? currentSorted[currentSorted.length - 1].length : 0
      const nextLen = Math.min(totalLength, Number((maxLen + 1).toFixed(2)))
      const newItem = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), length: nextLen, profileId: profiles[0]?.id || null }
      arr.push(newItem)
      setSelectedId(newItem.id)
      persist(arr)
      return arr
    })
    setPendingSort(true)
  }

  const removeAssignment = (idx) => {
    setProfileAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      if (arr.length <= 2) return prev
      const removed = arr.splice(idx, 1)[0]
      if (removed?.id === selectedId) {
        const next = arr[idx] || arr[idx - 1] || arr[0] || null
        setSelectedId(next ? next.id : null)
      }
      persist(arr)
      return arr
    })
    setPendingSort(true)
  }

  const sortIfNeeded = () => {
    if (!pendingSort) return
    setProfileAssignments(prev => {
      const arr = ensureIds([...(prev || [])]).sort((a, b) => a.length - b.length)
      persist(arr)
      return arr
    })
    setPendingSort(false)
  }

  // Position on axis for a given length
  const selectedMarker = selected ? getPositionAtLength(axisData, selected.length) : null
  const markerPoints = selectedMarker ? [{ id: 'marker', x: selectedMarker.x, y: selectedMarker.y }] : []

  return (
    <div className="profile-assignment">
      <div className="assignment-header">
        <h2>Profile Assignment</h2>
        <p className="axis-info">
          Axis length: {totalLength.toFixed(2)}
        </p>
      </div>

      <div className="assignment-layout">
        <div className="assignments-list">
          <h3>Assign profiles by length</h3>
          <div className="assignments-table">
            <div className="table-header">
              <div>#</div>
              <div>Length</div>
              <div>Profile</div>
              <div>Actions</div>
            </div>
            {sorted.map((a, index) => {
              const profileId = a.profileId || ''
              const isSelected = selected ? a.id === selected.id : index === 0
              return (
                <div 
                  key={a.id || index} 
                  className={`table-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <div>{index + 1}</div>
                  <div>
                    <input
                      type="number"
                      value={a.length}
                      min={0}
                      max={totalLength.toFixed(2)}
                      step="0.1"
                      onChange={(e) => updateLength(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={sortIfNeeded}
                    />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      className="profile-select"
                      value={profileId}
                      onChange={(e) => handleAssignProfile(index, e.target.value)}
                    >
                      <option value="">None</option>
                      {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeAssignment(index) }}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="profile-points-actions" style={{ marginTop: '0.5rem' }}>
            <button onClick={addAssignment}>Add Assignment</button>
          </div>
        </div>

        {/* Right side: two-view canvas section */}
        {axisData.length > 0 && (
          <div className="assignment-views">
            <div className="view-container">
              <h3>Axis View</h3>
              <div className="canvas-wrapper">
                <SegmentCanvas
                  segments={axisData}
                  points={markerPoints}
                  segmentColor="#3498db"
                  segmentStrokeWidth={3}
                  showGrid={true}
                  showAxes={true}
                  showOrigin={true}
                  invertY={true}
                  width={canvasWidth}
                  height={canvasHeight}
                  zoom={1}
                  offset={{ x: canvasWidth / 2, y: canvasHeight / 2 }}
                  onDragEnd={() => {}}
                  highlightedPointId={markerPoints.length ? 'marker' : null}
                  highlightPointColor="#e74c3c"
                />
              </div>
              {selected && (
                <p className="view-info">
                  Selected: {selected.length.toFixed(2)}
                  {selected.profileId && (
                    <span> - Profile: {profiles.find(p => p.id === selected.profileId)?.name || 'Unknown'}</span>
                  )}
                </p>
              )}
            </div>

            <div className="view-container">
              <h3>Assigned Profile View</h3>
              <div className="canvas-wrapper">
                {selected && selected.profileId ? (
                  <SegmentCanvas
                    segments={(profiles.find(p => p.id === selected.profileId)?.segments) || []}
                    points={(profiles.find(p => p.id === selected.profileId)?.points || []).map(pt => ({ id: pt.id, x: pt.x, y: pt.y }))}
                    segmentColor="#27ae60"
                    pointColor="#e67e22"
                    segmentStrokeWidth={2}
                    showGrid={true}
                    showAxes={true}
                    showOrigin={false}
                    invertY={true}
                    width={canvasWidth}
                    height={canvasHeight}
                    zoom={1}
                    offset={{ x: canvasWidth / 2, y: canvasHeight / 2 }}
                    onDragEnd={() => {}}
                  />
                ) : (
                  <div className="no-profile-view">
                    <p>
                      {selected
                        ? 'No profile assigned to this length'
                        : 'Select a length from the table'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileAssignment

