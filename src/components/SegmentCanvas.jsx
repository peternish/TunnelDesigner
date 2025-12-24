import { Stage, Layer, Line, Circle, Path, Text } from 'react-konva'
import { generateArcPath } from '../utils/geometry'

/**
 * Common canvas component for rendering segments, grid, and points
 * @param {Object} props
 * @param {Array} props.segments - Array of segment objects with {type, start, end, radius?}
 * @param {Array} props.points - Optional array of point objects with {id, x, y}
 * @param {string} props.segmentColor - Color for segments (default: '#3498db')
 * @param {string} props.pointColor - Color for points (default: '#2980b9')
 * @param {number} props.segmentStrokeWidth - Stroke width for segments (default: 3)
 * @param {number} props.pointRadius - Radius for point markers (default: 4)
 * @param {boolean} props.showGrid - Show grid lines (default: true)
 * @param {boolean} props.showAxes - Show center axes (default: true)
 * @param {boolean} props.showOrigin - Show origin marker (default: false)
 * @param {boolean} props.invertY - Invert Y axis (default: false)
 * @param {number} props.width - Canvas width
 * @param {number} props.height - Canvas height
 * @param {number} props.zoom - Zoom level
 * @param {Object} props.offset - {x, y} offset
 * @param {Function} props.onDragEnd - Callback when stage is dragged
 * @param {number} props.highlightedSegmentIndex - Index of segment to highlight (default: -1)
 * @param {string} props.highlightColor - Color for highlighted segment (default: '#e74c3c')
 */
function SegmentCanvas({
  segments = [],
  points = [],
  segmentColor = '#3498db',
  pointColor = '#2980b9',
  segmentStrokeWidth = 3,
  pointRadius = 4,
  showGrid = true,
  showAxes = true,
  showOrigin = false,
  invertY = false,
  width,
  height,
  zoom = 1,
  offset = { x: 0, y: 0 },
  onDragEnd,
  highlightedSegmentIndex = -1,
  highlightColor = '#e74c3c',
  highlightedPointId = null,
  highlightPointColor = '#e74c3c',
  axisScale = 1
}) {
  const toCanvasY = (y) => invertY ? -y : y
  const scaleCoord = (val) => val * axisScale

  return (
    <Stage
      width={width}
      height={height}
      draggable
      onDragEnd={onDragEnd}
      scaleX={zoom}
      scaleY={zoom}
      x={offset.x}
      y={offset.y}
    >
      <Layer>
        {/* Grid */}
        {showGrid && (
          <>
            {Array.from({ length: 80 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[(i * 50) - 2000, -2000, (i * 50) - 2000, 2000]}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: 80 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[-2000, (i * 50) - 2000, 2000, (i * 50) - 2000]}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
            ))}
          </>
        )}

        {/* Center axes */}
        {showAxes && (
          <>
            <Line
              points={[-2000, 0, 2000, 0]}
              stroke="#95a5a6"
              strokeWidth={1}
            />
            <Line
              points={[0, -2000, 0, 2000]}
              stroke="#95a5a6"
              strokeWidth={1}
            />
          </>
        )}

        {/* Origin marker */}
        {showOrigin && (
          <>
            <Circle x={0} y={0} radius={4} fill="#e74c3c" />
            <Text
              x={8}
              y={4}
              text="(0, 0)"
              fontSize={12}
              fill="#7f8c8d"
            />
          </>
        )}

        {/* Segments */}
        {segments.map((segment, index) => {
          const isHighlighted = index === highlightedSegmentIndex
          const strokeColor = isHighlighted ? highlightColor : segmentColor
          const strokeWidth = isHighlighted ? segmentStrokeWidth + 2 : segmentStrokeWidth

          if (segment.type === 'line') {
            return (
              <Line
                key={index}
                points={[
                  scaleCoord(segment.start.x),
                  toCanvasY(scaleCoord(segment.start.y)),
                  scaleCoord(segment.end.x),
                  toCanvasY(scaleCoord(segment.end.y)),
                ]}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                lineCap="round"
                lineJoin="round"
              />
            )
          }

          if (segment.type === 'arc' && segment.radius) {
            const canvasStart = {
              x: scaleCoord(segment.start.x),
              y: toCanvasY(scaleCoord(segment.start.y)),
            }
            const canvasEnd = {
              x: scaleCoord(segment.end.x),
              y: toCanvasY(scaleCoord(segment.end.y)),
            }

            const pathData = generateArcPath(canvasStart, canvasEnd, segment.radius * axisScale)
            if (!pathData) return null

            return (
              <Path
                key={index}
                data={pathData}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                lineCap="round"
                lineJoin="round"
              />
            )
          }

          return null
        })}

        {/* Point markers */}
        {points.map((pt) => {
          const isHighlighted = highlightedPointId != null && pt.id === highlightedPointId
          return (
            <Circle
              key={`pt-${pt.id}`}
              x={scaleCoord(pt.x)}
              y={toCanvasY(scaleCoord(pt.y))}
              radius={pointRadius}
              fill={isHighlighted ? highlightPointColor : pointColor}
            />
          )
        })}
      </Layer>
    </Stage>
  )
}

export default SegmentCanvas

