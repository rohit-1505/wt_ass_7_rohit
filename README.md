# UML Blueprint — Class Diagram Generator

A React + Vite app for visually designing UML class diagrams and generating
matching Java source code.

## Features
- Drag-and-drop palette: Class, Abstract Class, Interface, Enum
- Draw relationships by dragging between class connector dots
  (association, inheritance, realization, aggregation, composition, dependency)
- Pan and zoom canvas with a blueprint grid
- Full attribute/method/enum-value editor per class
- Live, auto-updating Java source preview
- Copy or download generated .java per class, or export all at once
- Save/load your diagram as JSON

## Run locally
```bash
npm install
npm run dev
```
Open the local URL Vite prints (usually http://localhost:5173).

## Build for production
```bash
npm run build
npm run preview
```

## Project structure
- `src/App.jsx` — the entire application (state, canvas, Java generator, styling)
- `src/main.jsx` — Vite/React entry point
- `src/styles.css` — minimal page-level reset
- `index.html` — Vite HTML entry
- `vite.config.js` — Vite configuration
