# TripChile EV 🚗⚡

Planificador de viajes EV en Chile para Tesla Model Y Juniper. Rutas reales por carreteras, paradas de carga inteligentes, sitios turísticos curados, modo offline (PWA).

## Stack

- **Next.js 15** + **TypeScript** estricto
- **Tailwind CSS** + **shadcn/ui** + **Framer Motion**
- **MapLibre GL JS** con tiles Carto (gratis, sin API key)
- **OSRM público** para rutas reales por carretera
- **Zustand** para estado global
- **next-pwa** para instalación como app

## Setup local

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Deploy a Vercel

```bash
git push
# Vercel hace deploy automático
```

## Estructura

```
app/              # Next.js App Router
components/       # UI components
  ├── ui/         # shadcn primitives
  ├── map/        # MapLibre integration
  ├── trip/       # Trip planner
  ├── poi/        # POI cards
  └── layout/     # App shell
lib/              # Lógica de negocio
  ├── routing.ts  # OSRM
  ├── charging.ts # Modelo Tesla
  └── utils.ts    # Helpers
data/             # Datos embebidos
  ├── stations.json # 556 cargadores
  └── pois-chile.json # POIs curados
types/            # TypeScript types
hooks/            # Custom React hooks
```
