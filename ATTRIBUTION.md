# Third-party assets

## Vehicle model — `public/models/nova-vehicle.glb`

Derived from **Car Concept** from the Khronos glTF Sample Assets repository.

- Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
- Copyright: © 2024, Darmstadt Graphics Group GmbH — model and textures by Eric Chadwick
- License: **CC BY 4.0 International** — https://creativecommons.org/licenses/by/4.0/legalcode

### Modifications made
The original asset was processed with `@gltf-transform/cli` for web delivery:

- `dedup` + `prune` — removed duplicate and unused accessors/materials
- `webp --quality 90` — PNG textures re-encoded to WebP (`EXT_texture_webp`)
- `meshopt --level high` — vertex quantization + `EXT_meshopt_compression`

Result: 11.78 MB → 2.9 MB, with the node hierarchy and all 97 meshes preserved.

At runtime the site further overrides the asset's materials (paint, glass, rims, brake,
tyre and interior) for art direction, and neutralises the Khronos branding that the
original asset carries — see "Trademarks" below.

### Trademarks
The source asset includes Khronos Group and 3D Commerce logos, which are covered by a
Khronos trademark licence and **not** by CC BY 4.0. NOVA is a fictional brand and makes
no claim to those marks, so this project removes them rather than redistributing them:

- the `License Plate` mesh (which carried the Khronos wordmark as its base colour map) is
  replaced with a generated NOVA plate texture;
- the logo decal is also authored into the source asset as a **full-strength emissive map**
  on the `Hardware`, `Mirror`, `Brake`, `Rim1` and `Rim2` materials — every material
  override in `src/three/Materials.js` clears `emissiveMap` and sets `emissive` to black,
  so the mark is not rendered anywhere on the vehicle.

## Fonts
Self-hosted from Google Fonts, licensed under the SIL Open Font License 1.1.

- Archivo — https://fonts.google.com/specimen/Archivo
- Inter — https://fonts.google.com/specimen/Inter

## Audio
The ambient soundtrack is synthesised in-browser with the Web Audio API
(`src/audio/AudioManager.js`). No third-party audio files are used.
