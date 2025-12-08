import { useState, useMemo } from 'react'
import SegmentCanvas from './SegmentCanvas'
import './ProfileAssignment.css'
import { calculateArcCenter, getPositionAtLength } from '../utils/geometry'

function HeightSettings({ axisData, heightAssignments, setHeightAssignments, totalLength }) {
  const [selectedId, setSelectedId] = useState(null)
  const [pendingSort, setPendingSort] = useState(false)

  const ensureIds = (arr) =>
    arr.map(a => (a.id ? a : { ...a, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) }))

  const persist = (arr) => {
    try {
      window.localStorage.setItem('tunnel-height-assignments-v1', JSON.stringify(arr))
    } catch {
      // ignore
    }
  }

  // Ensure assignments are sorted
  const sorted = useMemo(
    () => ensureIds([...(heightAssignments || [])]).sort((a, b) => a.length - b.length),
    [heightAssignments]
  )
  const selectedIndex = Math.max(0, sorted.findIndex(a => a.id === selectedId))
  const selected = sorted[selectedIndex] || sorted[0] || null

  const updateAssignment = (idx, field, value) => {
    setHeightAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      if (!arr[idx]) return prev
      const updated = { ...arr[idx] }
      if (field === 'height') {
        updated.height = Number(value) || 0
      } else if (field === 'length') {
        updated.length = Math.min(totalLength, Math.max(0, Number(value) || 0))
      }
      arr[idx] = updated
      persist(arr)
      return arr
    })
    setPendingSort(true)
  }

  const addAssignment = () => {
    setHeightAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      const currentSorted = [...arr].sort((a, b) => a.length - b.length)
      const maxLen = currentSorted.length ? currentSorted[currentSorted.length - 1].length : 0
      const nextLen = Math.min(totalLength, Number((maxLen + 1).toFixed(2)))
      const newItem = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), length: nextLen, height: 0 }
      arr.push(newItem)
      setSelectedId(newItem.id)
      persist(arr)
      return arr
    })
    setPendingSort(true)
  }

  const removeAssignment = (idx) => {
    setHeightAssignments(prev => {
      const arr = ensureIds([...(prev || [])])
      if (arr.length <= 2) return prev // keep at least two (0 and end)
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
    setHeightAssignments(prev => {
      const arr = ensureIds([...(prev || [])]).sort((a, b) => a.length - b.length)
      persist(arr)
      return arr
    })
    setPendingSort(false)
  }

  const markerPos = selected ? getPositionAtLength(axisData, selected.length) : null
  const marker = markerPos ? [{ id: 'marker', x: markerPos.x, y: markerPos.y }] : []

  // Build height graph points
  const graphPoints = sorted.map(h => [h.length, h.height])

  return (
    <div className="profile-assignment">
      <div className="assignment-header">
        <h2>Height Settings</h2>
        <p className="axis-info">Tunnel length: {totalLength.toFixed(2)} units</p>
      </div>

      <div className="assignment-layout">
        <div className="assignments-list">
          <h3>Height by Length</h3>
          <div className="assignments-table">
            <div className="table-header">
              <div>#</div>
              <div>Length</div>
              <div>Height</div>
              <div>Actions</div>
            </div>
            {sorted.map((h, idx) => (
              <div
                key={h.id}
                className={`table-row ${selected && h.id === selected.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(h.id)}
              >
                <div>{idx + 1}</div>
                <div>
                  <input
                    type="number"
                    value={h.length}
                    onChange={(e) => updateAssignment(idx, 'length', e.target.value)}
                    step="0.1"
                    min="0"
                    max={totalLength.toFixed(2)}
                    onBlur={sortIfNeeded}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={h.height}
                    onChange={(e) => updateAssignment(idx, 'height', e.target.value)}
                    step="0.1"
                  />
                </div>
                <div>
                  <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeAssignment(idx) }}>×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="profile-points-actions" style={{ marginTop: '0.5rem' }}>
            <button onClick={addAssignment}>Add Height Point</button>
          </div>
        </div>

        {axisData.length > 0 && (
          <div className="assignment-views">
            <div className="view-container">
              <h3>Axis View</h3>
              <div className="canvas-wrapper">
                <SegmentCanvas
                  segments={axisData}
                  points={marker}
                  segmentColor="#3498db"
                  pointColor="#2980b9"
                  segmentStrokeWidth={3}
                  showGrid={true}
                  showAxes={true}
                  showOrigin={true}
                  invertY={true}
                  width={(window.innerWidth - 600) / 2}
                  height={window.innerHeight - 400}
                  zoom={1}
                  offset={{ x: (window.innerWidth - 600) / 4, y: (window.innerHeight - 400) / 2 }}
                  onDragEnd={() => {}}
                  highlightedPointId={markerPos ? 'marker' : null}
                  highlightPointColor="#e74c3c"
                />
              </div>
               {selected && (
                <p className="view-info">
                   Selected: {selected.length.toFixed(2)} → Height {selected.height}
                </p>
              )}
            </div>

            <div className="view-container">
              <h3>Height Graph</h3>
              <div className="canvas-wrapper" style={{ padding: '1rem' }}>
                <svg width="100%" height="300" viewBox="0 0 1000 300" preserveAspectRatio="none">
                  <rect x="0" y="0" width="1000" height="300" fill="#fafafa" stroke="#ddd" />
                  {/* Axes */}
                  <line x1="40" y1="260" x2="980" y2="260" stroke="#95a5a6" strokeWidth="2" />
                  <line x1="40" y1="20" x2="40" y2="260" stroke="#95a5a6" strokeWidth="2" />
                  {/* Plot */}
                  {graphPoints.length >= 2 && (
                    <polyline
                      fill="none"
                      stroke="#e67e22"
                      strokeWidth="3"
                      points={graphPoints.map(([lx, h]) => {
                        const x = 40 + (totalLength === 0 ? 0 : (lx / totalLength) * 940)
                        const y = 260 - h // simple scaling: 1 unit = 1px upward
                        return `${x},${y}`
                      }).join(' ')}
                    />
                  )}
                  {/* Marker */}
                  {sorted[selectedIndex] && (
                    (() => {
                      const lx = sorted[selectedIndex].length
                      const h = sorted[selectedIndex].height
                      const x = 40 + (totalLength === 0 ? 0 : (lx / totalLength) * 940)
                      const y = 260 - h
                      return <circle cx={x} cy={y} r="6" fill="#e74c3c" />
                    })()
                  )}
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeightSettings

