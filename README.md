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

## Art direction

Stylized realism rather than cartoon rendering or uncontrolled photorealism: wet asphalt, warm practical lights, cool monsoon atmosphere, readable silhouettes and restrained cinematic effects.
