# Tunnel Designer

A React-based tool for designing tunnels with 2D profiles and axis definition.

## Features

1. **Axis Design**: Draw the tunnel axis using lines and arc-segments in the North-East plane
2. **Profile Editor**: Create multiple 2D section profiles using combinations of lines and arcs
3. **Profile Assignment**: Assign profiles to specific ranges along the tunnel axis (in meters)
4. **Tunnel Viewer**: Visualize the complete tunnel design with all profiles applied

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Usage

### 1. Axis Design
- Click "Draw Line" to draw straight segments
- Click "Draw Arc" to draw arc segments (click two points, then enter radius)
- Click on the canvas to place points
- View all segments in the list at the bottom

### 2. Profile Editor
- Click "New Profile" to create a profile
- Select a profile from the list to edit it
- Use "Draw Line" or "Draw Arc" to add segments to the profile
- Each profile is drawn centered on the canvas

### 3. Profile Assignment
- Enter start and end positions in meters
- Select a profile from the dropdown
- Click "Add Assignment" to assign the profile to that range
- View coverage visualization at the bottom

### 4. Tunnel Viewer
- View the complete tunnel design
- See the axis in dark blue
- See profile sections applied along the axis in green

## Technical Details

- Built with React and Vite
- Uses Konva for 2D graphics rendering
- Supports lines and arcs for both axis and profiles
- Arc segments defined by two points and a radius

## Project Structure

```
src/
  components/
    AxisEditor.jsx      # Tunnel axis drawing component
    ProfileEditor.jsx   # 2D profile design component
    ProfileAssignment.jsx # Profile-to-axis assignment
    TunnelViewer.jsx    # Complete tunnel visualization
  App.jsx              # Main application
  main.jsx             # Entry point
```

