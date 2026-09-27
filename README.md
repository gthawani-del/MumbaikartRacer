# Mumbai Auto Rush

A cinematic browser racing prototype built around a racing auto-rickshaw and a rain-soaked Mumbai seaface circuit.

## Current milestone

This repository currently contains the visual quality gate for the wider game:

- procedural three-wheel racing auto
- blue-hour Mumbai environment
- wet-road materials and reflections
- rain, illuminated skyline and Marine Drive-inspired promenade
- cinematic opening camera
- playable keyboard and touch controls
- adaptive desktop/mobile rendering quality

The prototype deliberately uses a guided track controller. Full vehicle physics, opponents and race systems come after the visual benchmark is accepted.

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
```

## Controls

- `W` / Up: accelerate
- `S` / Down: brake
- `A D` / Left Right: steer
- Space: drift

Mobile devices receive on-screen steering and drift controls.

## Asset loading and cache

The opening screen tracks the shared Three.js loading manager and stays visible until the initial scene assets finish loading. Public GLBs and textures use a versioned URL and a one-year browser/CDN cache. Bump `assetRevision` in `src/theme.json` whenever a file under `public/assets` is replaced; that gives the browser a fresh URL while preserving cache reuse for unchanged assets.

The asset library includes the main 10.5 MB auto model, a smaller 634 KB fallback, a 7.4 MB BEST bus, a 21 MB bus shelter, streetlights, palm variants, and additional traffic models. Only assets referenced by the active scene are loaded; the other models do not add to the initial download.

## Art direction

Stylized realism rather than cartoon rendering or uncontrolled photorealism: wet asphalt, warm practical lights, cool monsoon atmosphere, readable silhouettes and restrained cinematic effects.
