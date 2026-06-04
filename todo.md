# Ewolution Room Play Space - TODO

## Header & Navigation
- [x] Rework header for mobile (currently not ideal)
  - [x] Shorten the undo/redo buttons to icons only (e.g., `Undo` -> ↩️/⬅️, `Redo` -> ↪️/➡️)
  - [x] Optimize spacing and layout for smaller screens

## Inspector & UI
- [x] Rework the inspector window/area
  - [x] Improve usability and intuitiveness
  - [x] Streamline inspector controls, placement, and visual hierarchy

## Other
- [x] Pan camera in 3D view with arrow keys; add key shortcut to reset view
- [ ] Multi room support
- [x] Colored walls and windows
- [x] Make mesh below room slightly bigger for aesthetics
- [ ] Add smaller objects that belong into a room like an office, e.g. a monitor, pc, etc.

## Future Feature Ideas (Proposed)
- [x] **Interactive 3D Preview Mode**
  - [x] Implement a 3D view toggle (e.g., via React Three Fiber or CSS 3D) to view the room in 3D
  - [x] Render room boundaries, openings, and furniture presets as 3D block volumes
- [ ] **Smart Snapping & Collision System**
  - [ ] Implement magnetic snapping to grid lines, walls, and other placed elements
  - [ ] Add collision detection to highlight overlapping items or blocked doors/windows
- [ ] **Shareable Links & Blueprint Export**
  - [ ] Support generating a PDF blueprint that includes the room canvas drawing and a furniture inventory list
  - [ ] Allow encoding the room configuration in a compressed URL hash for instant sharing
- [x] Add support for angled walls
  - [x] In the canvas, users should be able to drag a corner further in/out easily to account for more special room layouts

