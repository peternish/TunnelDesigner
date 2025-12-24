import { useState, useEffect, useMemo } from 'react'
import SegmentCanvas from './SegmentCanvas'
import { computeAxisScale } from '../utils/geometry'
import './AxisEditor.css'

function AxisEditor({ axisData, setAxisData, axisPoints, setAxisPoints }) {
  // Points are defined in user coordinates (e.g. meters), with (0,0) at the origin.
  // Each point (after the first) also defines the segment type from the previous point: line or arc.
  const canvasWidth = window.innerWidth - 380 // leave more room for left panel
  const canvasHeight = window.innerHeight - 200

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: canvasWidth / 2, y: canvasHeight / 2 })
  const [selectedPointId, setSelectedPointId] = useState(null)

  // Compute axis scale for large coordinates (lat/long)
  const axisScale = useMemo(() => {
    if (!axisData || axisData.length === 0) return 1
    return computeAxisScale(axisData, Math.min(canvasWidth, canvasHeight) * 0.8)
  }, [axisData, canvasWidth, canvasHeight])

  // Whenever points change, rebuild axis segments, push to parent, and persist
  useEffect(() => {
    if (!setAxisData) return
    if (!axisPoints || axisPoints.length < 2) {
      setAxisData([])
      return
    }

    const segments = []
    for (let i = 1; i < axisPoints.length; i++) {
      const prev = axisPoints[i - 1]
      const curr = axisPoints[i]
      const segType = curr.type || 'line'
      const start = { x: prev.x, y: prev.y }
      const end = { x: curr.x, y: curr.y }

      if (segType === 'arc' && curr.radius && Number(curr.radius) !== 0) {
        segments.push({
          type: 'arc',
          start,
          end,
          radius: Number(curr.radius),
        })
      } else {
        segments.push({
          type: 'line',
          start,
          end,
        })
      }
    }

    setAxisData(segments)
  }, [axisPoints, setAxisData])

  const addPoint = () => {
    const newPoint = {
      id: Date.now(),
      x: 0,
      y: 0,
      type: 'line',
      radius: ''
    }
    setAxisPoints((prev) => [...(prev || []), newPoint])
  }

  const updatePoint = (id, field, value) => {
    let v = value
    if (field === 'x' || field === 'y' || field === 'radius') {
      v = value === '' ? '' : Number(value)
    }

    setAxisPoints((prev = []) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: v } : p))
    )
  }

  const removePoint = (id) => {
    setAxisPoints((prev = []) => prev.filter((p) => p.id !== id))
  }

  const clearAll = () => {
    setAxisPoints([])
  }

  const moveSelectedPoint = (direction) => {
    if (selectedPointId === null) return
    setAxisPoints((prev = []) => {
      const pts = [...prev]
      const currentIndex = pts.findIndex(p => p.id === selectedPointId)
      if (currentIndex === -1) return prev
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (newIndex < 0 || newIndex >= pts.length) return prev
      
      const [moved] = pts.splice(currentIndex, 1)
      pts.splice(newIndex, 0, moved)
      return pts
    })
  }

  const zoomIn = () => setZoom((z) => Math.min(4, z * 1.25))
  const zoomOut = () => setZoom((z) => Math.max(0.25, z / 1.25))
  const resetView = () => {
    setZoom(1)
    setOffset({ x: canvasWidth / 2, y: canvasHeight / 2 })
  }

  return (
    <div className="axis-editor">
      <div className="axis-header">
        <h2>Axis Design</h2>
        <p>Define points (x, y). The axis on the right connects them as a polyline.</p>
        <div className="axis-zoom-controls">
          <button onClick={zoomOut}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn}>+</button>
          <button className="secondary" onClick={resetView}>
            Reset
          </button>
        </div>
      </div>

      <div className="axis-main">
        {/* Left: point list and controls */}
        <div className="axis-form">
          <div className="axis-form-header">
            <span>#</span>
            <span>X</span>
            <span>Y</span>
            <span>Type</span>
            <span>Radius</span>
          </div>

          {(axisPoints || []).map((p, index) => (
            <div 
              key={p.id} 
              className={`axis-point-row ${selectedPointId === p.id ? 'selected' : ''}`}
              onClick={() => setSelectedPointId(p.id)}
            >
              <span className="axis-point-index">
                {index + 1}
              </span>
              <input
                type="number"
                value={p.x}
                onChange={(e) => updatePoint(p.id, 'x', e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="number"
                value={p.y}
                onChange={(e) => updatePoint(p.id, 'y', e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {index === 0 ? (
                <>
                  <span></span>
                  <div className="axis-point-radius" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="axis-point-remove"
                      onClick={() => removePoint(p.id)}
                    >
                      ×
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <select
                    value={p.type || 'line'}
                    onChange={(e) => updatePoint(p.id, 'type', e.target.value)}
                    className="axis-point-type"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="line">Line</option>
                    <option value="arc">Arc</option>
                  </select>
                  <div className="axis-point-radius" onClick={(e) => e.stopPropagation()}>
                    {p.type === 'arc' && (
                      <input
                        type="number"
                        value={p.radius === '' ? '' : p.radius}
                        onChange={(e) => updatePoint(p.id, 'radius', e.target.value)}
                        placeholder="R"
                      />
                    )}
                    <button
                      className="axis-point-remove"
                      onClick={() => removePoint(p.id)}
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {(!axisPoints || axisPoints.length === 0) && (
            <p className="axis-empty-hint">
              Add points to define the tunnel axis. They will be connected in order.
            </p>
          )}

          <div className="axis-form-actions">
            <button onClick={addPoint}>Add Point</button>
            <button 
              onClick={() => moveSelectedPoint('up')} 
              className="secondary"
              disabled={selectedPointId === null || (axisPoints || []).findIndex(p => p.id === selectedPointId) === 0}
            >
              Move Up
            </button>
            <button 
              onClick={() => moveSelectedPoint('down')} 
              className="secondary"
              disabled={selectedPointId === null || (axisPoints || []).findIndex(p => p.id === selectedPointId) === (axisPoints || []).length - 1}
            >
              Move Down
            </button>
            <button onClick={clearAll} className="secondary">
              Clear All
            </button>
          </div>
        </div>

        {/* Right: axis canvas */}
        <div className="axis-canvas-container">
          <SegmentCanvas
            segments={axisData || []}
            points={(axisPoints || []).map(p => ({
              id: p.id,
              x: p.x,
              y: p.y
            }))}
            segmentColor="#3498db"
            pointColor="#2980b9"
            segmentStrokeWidth={3}
            showGrid={true}
            showAxes={true}
            showOrigin={true}
            invertY={true}
            width={canvasWidth}
            height={canvasHeight}
            zoom={zoom}
            offset={offset}
            axisScale={axisScale}
            onDragEnd={(e) => {
              setOffset({ x: e.target.x(), y: e.target.y() })
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default AxisEditor

