# Nova — 3D Vehicle Experience

Interaktiv 3D avtomobil taqdimoti. Scroll orqali boshqariladigan kamera, qism-qism ajratish animatsiyalari va to'liq ovozli muhit.

## Texnologiyalar

| Kutubxona | Versiya | Maqsad |
|---|---|---|
| React | 19 | UI va holat boshqaruvi |
| Vite | 8 | Yig'ish va dev server |
| Three.js | 0.185 | 3D render va sahna |
| GSAP + ScrollTrigger | 3.15 | Scroll animatsiyalari |
| Lucide React | 1.31 | Ikonkalar |

## Loyiha tuzilishi

```
src/
├── animations/
│   ├── cameraAnimations.js   # Kamera beats va focus light beats
│   ├── scrollTimeline.js     # Master scroll timeline (GSAP)
│   └── uiAnimations.js       # Intro animatsiyasi, counter, scroll-to
├── audio/
│   └── AudioManager.js       # Fon tovushi va mexanik qatlam
├── components/
│   ├── Annotations.jsx        # 3D dan proeksiya qilingan belgilar
│   ├── CTA.jsx                # Yakuniy chaqiruv bo'limi
│   ├── Engineering.jsx        # Foundation, Performance, Architecture
│   ├── Hero.jsx               # Bosh sahifa
│   ├── Interior.jsx           # Kabina bo'limi
│   ├── Loader.jsx             # Yuklanish ekrani
│   ├── Navigation.jsx         # Navigatsiya va telemetriya
│   ├── Panel.jsx              # Umumiy bo'lim wrapper
│   ├── SoundControl.jsx       # Ovoz tugmasi
│   └── Technology.jsx         # Powertrain va Technology bo'limlari
├── styles/
│   ├── global.css             # Palette, tipografiya, sahna
│   ├── loader.css             # Yuklanish ekrani stillari
│   ├── navigation.css         # Masthead, nav, telemetriya
│   └── sections.css           # Panel, stats, annotations
├── three/
│   ├── Camera.js              # CameraRig: chase + drift + parallax
│   ├── Lighting.js            # PMREM studio, yorug'lik, soya
│   ├── Materials.js           # Material overridelar (paint, glass, leather…)
│   ├── Scene.js               # Experience: renderer, loop, annotations
│   ├── Vehicle.js             # GLB yuklash va explode mexanikasi
│   └── VehicleParts.js        # EXPLODE qoidalar va ANNOTATIONS
├── App.jsx                    # Asosiy komponent
└── main.jsx                   # React kirish nuqtasi
```

## O'rnatish va ishga tushirish

```bash
# Bog'liqliklarni o'rnatish
pnpm install

# Dev server (http://localhost:5173)
pnpm dev

# Production build
pnpm build

# Build natijasini ko'rish
pnpm preview
```

## Scroll xaritasi

| Progress | Bo'lim | Sahna |
|---|---|---|
| `0.00 – 0.12` | Hero | Old uch chorak, uzun linza |
| `0.17 – 0.26` | Foundation | Old g'ildirak hub darajasida |
| `0.29 – 0.38` | Performance | Yon ko'rinish, raqamlar |
| `0.41 – 0.50` | Architecture | To'liq ajratilgan holat |
| `0.53 – 0.62` | Interior | Kabinaga kirish |
| `0.64 – 0.73` | Powertrain | Motor bloki oldinga chiqadi |
| `0.75 – 0.86` | Technology | Orqa aerodinamika |
| `0.91 → ∞` | CTA | Mashina qayta yig'iladi |

## Litsenziya

Manba 3D modeli uchun atribut ma'lumotlarini `ATTRIBUTION.md` faylidan ko'ring.
