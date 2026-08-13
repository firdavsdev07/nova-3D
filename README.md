# NOVA — The Art of Motion

An interactive 3D vehicle experience. One continuous cinematic take, driven entirely by
scroll: the camera, the exploded view, the lighting, the copy and the soundtrack all read
from a single timeline.

NOVA is a fictional marque, built as an interactive study.

---

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production bundle
pnpm preview    # serve the build
pnpm lint       # oxlint
```

---

## Stack

| Library | Version | Role |
| --- | --- | --- |
| React | 19 | UI and state |
| Vite | 8 | Build and dev server |
| Three.js | 0.185 | Rendering and scene |
| GSAP + ScrollTrigger | 3.15 | Scroll choreography |
| Lucide React | 1.31 | Icons |

No TypeScript, no CSS framework. Styles are hand-written CSS.

---

## Architecture

Two rules hold the whole project together.

**React never touches the 3D scene.** It mounts a canvas, constructs `Experience`, and
stays out of the way. Everything the scroll controls is written to one plain object:

```
GSAP timeline  ──writes──▶  state  ──reads──▶  render loop  ──▶  Three.js
```

```js
state = {
  cam,          // camera target: position, look point, lens, drift, rise
  explode,      // 0 → 1 per part group
  lift,         // how far the assembly floats off the floor
  progress,     // scroll position, drives annotation presence
  disassembly,  // 0 → 1, read by the audio bed
  focus,        // accent light position and intensity
  exposure,     // tone-mapping exposure
}
```

**There is exactly one ScrollTrigger.** Nothing else in the app is allowed its own. That
is why the copy always lands on the same frame as the camera — they are literally the same
tween engine reading the same clock. The timeline's length is pinned to `1`, so every beat
position in the source is written as raw scroll progress.

---

## Project structure

```
src/
├── animations/
│   ├── cameraAnimations.js   # camera beats and focus-light beats
│   ├── scrollTimeline.js     # the master timeline
│   └── uiAnimations.js       # intro, counters, scroll-to
├── audio/
│   └── AudioManager.js       # synthesised soundtrack
├── components/
│   ├── Annotations.jsx       # labels projected from 3D
│   ├── CTA.jsx               # closing section and colophon
│   ├── Engineering.jsx       # Foundation, Performance, Architecture
│   ├── Hero.jsx              # opening frame
│   ├── Interior.jsx          # cabin
│   ├── Loader.jsx            # loading veil
│   ├── Navigation.jsx        # masthead, telemetry, rail
│   ├── Panel.jsx             # shared section wrapper
│   ├── SoundControl.jsx      # mute toggle
│   └── Technology.jsx        # Powertrain, Technology
├── styles/
│   ├── global.css            # palette, type, stage
│   ├── loader.css
│   ├── navigation.css
│   └── sections.css          # panels, scrims, stats, annotations
├── three/
│   ├── Camera.js             # CameraRig: chase, drift, parallax, framing
│   ├── Lighting.js           # PMREM studio, key/rim/fill, contact shadow
│   ├── Materials.js          # material overrides
│   ├── Scene.js              # Experience: renderer, loop, quality tier
│   ├── Vehicle.js            # GLB load and explode mechanics
│   └── VehicleParts.js       # explode rules and annotations
├── App.jsx
└── main.jsx
```

---

## Scroll map

| Progress | Section | Scene |
| --- | --- | --- |
| `0.00 – 0.12` | Hero | Front three-quarter, long lens |
| `0.17 – 0.26` | Foundation | Front wheel at hub height, rim leaving the disc |
| `0.29 – 0.38` | Performance | Side elevation, figures count up |
| `0.41 – 0.50` | Architecture | Fully exploded, camera high and wide |
| `0.53 – 0.62` | Interior | Down into the open cockpit |
| `0.64 – 0.73` | Powertrain | Engine drawn forward out of the bay |
| `0.75 – 0.86` | Technology | Rear quarter, aerodynamics |
| `0.91 → ∞` | CTA | The car reassembles |

---

## The exploded view

The source asset parents every part under the chassis mesh, which means moving the chassis
moves the entire car and the chassis can never move on its own. On load, every direct child
is re-attached to a neutral root — `attach` preserves world transforms — leaving the chassis
as a sibling of the parts it used to own. Nested sub-parts stay put, so a door still carries
its own glass, mirror and door card.

Displacements are authored as a table in `VehicleParts.js`, not improvised at runtime:

```js
door:    { out: 0.98, up: 0.12, fwd: 0,    rot: [0, 0.10, 0] }
hood:    { out: 0,    up: 0.88, fwd: 0.64, rot: [-0.10, 0, 0] }
pillars: { out: 0,    up: 1.40, fwd: 0 }
engine:  { out: 0,    up: 0.64, fwd: 1.12 }
```

`out` is signed by the part's own side, so one rule serves both flanks. The roof stack is
ordered pillars → glass → roof so the three never interpenetrate in mid-air, and the pillars
clear the cabin entirely — the A-pillar rails run down to the sill, so anything under about
`1.15` leaves them standing between the seats when the interior beat looks in.

The whole assembly also floats to `lift` while it is apart, which is what gives the sills
and the valance somewhere to drop to.

---

## Camera

Scroll never moves the camera. Scroll moves a *target*, and the rig chases it with damped
interpolation — that single indirection is what keeps the motion from feeling robotic. The
damping is expressed in e-folds per second, so the feel is identical at 30, 60 or 120 fps.

On top of the chase sit a slow orbital drift and mouse parallax, both deliberately
under-scaled and both falling away as the camera closes in.

Each beat carries two framing channels beyond its position:

- **`rise`** — the fraction of the vehicle's current `lift` the camera travels with. Beat
  positions are authored against the car at rest, so without this a close beat frames the
  air a part has left behind. Expressed as a fraction rather than baked into the position
  because the lift is scaled down on small screens.
- **portrait framing** — `fov` is the *vertical* field, so a tall viewport keeps the top and
  bottom of the desktop frame and throws away the sides, which is exactly where these
  compositions live. The rig opens the lens a little, dollies back about the beat's own look
  point, and drops the look point so the vehicle rides above the copy. All three are no-ops
  at 16:9 and wider.

---

## Component focus

There is no outline shader and no dimming of the rest of the scene. Highlighting is a small
champagne point light placed at the component under discussion, fading up on arrival and
down on leaving — it moves while dark, so it never streaks across the vehicle.

Labels are projected from 3D every frame and written straight to `transform`, so they stay
attached to a part as it flies out. Visibility is read from scroll progress rather than
tweened, which makes scrubbing backwards exactly as correct as scrubbing forwards.

---

## Audio

The soundtrack is synthesised in-browser. No audio files are downloaded, and it never loops
audibly. Five layers over an Fmaj9: bass, pad, room air, sparse struck notes, and a
mechanical texture gated by how far apart the car currently is.

Gain staging is written down in the source, because a bed that sums through one limiter is
easy to leave 40 dB too quiet:

```
bass 0.30 + pad 0.18 + keys 0.16 + air 0.02 ≈ 0.66 peak
→ limiter (-14 dB, 4:1) → master 0.55 → ≈ -12 dBFS
```

**Autostart.** The music comes up on its own, fading in over 5.5 s. Browsers will not allow
audio before the visitor has interacted with the page, so the attempt is made immediately,
the context state is checked rather than trusted, and a one-shot listener on the first
interaction — including the scroll that drives the film — picks it up otherwise. In practice
the soundtrack arrives as the visitor starts moving, with nothing to press. A deliberate
mute outranks autostart for the rest of the visit.

---

## Performance

Measured at 1280×720, hero frame, via `renderer.info`:

| | Draw calls | Triangles / frame |
| --- | --- | --- |
| Before | 220 | 426,698 |
| After | **116** | **223,239** |

The two changes behind that:

- **The shadow map is refreshed on demand.** The key light never moves and nothing casts a
  moving shadow unless a part is actually travelling, so `shadowMap.autoUpdate` is off and
  `Vehicle.update` reports whether any geometry moved. Previously the entire scene was
  re-drawn into the shadow map on every frame where only the camera had changed — which is
  most of them.
- **Frustum culling is on.** It had been disabled on the theory that parts leave the body's
  bounds when exploded, but Three.js tests each mesh against its own bounding sphere
  transformed by its own `matrixWorld`, so a part that flies out carries its bounds with it.

Also: materials fall back to `MeshStandardMaterial` unless they actually ask for a physical
feature — only the two paint materials need clearcoat — and the bundle is split so `three`
caches independently of the app.

| Chunk | Size | gzip |
| --- | --- | --- |
| `three` | 625 kB | 158 kB |
| `index` | 234 kB | 75 kB |
| `motion` | 116 kB | 46 kB |

The GLB itself is 2.9 MB, down from 11.78 MB, via `dedup`, `prune`, WebP textures and
meshopt compression — with the node hierarchy and all 97 meshes preserved.

---

## Responsive

Desktop is the primary experience; mobile keeps the full cinematic scene rather than
falling back to something else. The quality tier is recomputed on every resize, so a desktop
window dragged to phone width actually crosses over:

| | Desktop | Mobile |
| --- | --- | --- |
| Pixel ratio cap | 1.75 | 1.5 |
| Shadow map | 2048 | 1024 |
| Antialias | on | off |
| Explode throw | 1.0 | 0.72 |
| Idle camera motion | 1.0 | 0.5 |

Layout follows: the section list gives way to the telemetry and rail, copy moves to the base
of the frame with the scrim rotating to match, annotations keep their figures and drop their
captions.

---

## Accessibility

`prefers-reduced-motion` is honoured throughout: the intro resolves without wiping, the
scroll timeline locks to the scrollbar instead of scrubbing with weight, and the camera's
idle drift and breathing are switched off — they are exactly the unrequested movement that
setting is about. Sound is never forced on a visitor who has muted it.

---

## Development

In dev builds the film exposes a seek hook, so a headless browser can jump to an exact
progress without waiting out the scrub and the camera damping:

```js
window.__nova.seek(0.57)   // jump to the interior beat
window.__nova.experience   // renderer, rig, vehicle, state
```

---

## Attribution

Vehicle model derived from **Car Concept** by Eric Chadwick, Darmstadt Graphics Group,
licensed CC BY 4.0. Materials, lighting, choreography and sound are original. The source
asset's Khronos branding is removed rather than redistributed.

Full detail, including the trademark handling, is in [ATTRIBUTION.md](./ATTRIBUTION.md).
