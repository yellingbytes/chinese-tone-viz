# Changelog

All notable changes to Tone Canvas are recorded here. Dates are `YYYY-MM-DD`.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

---

## 2026-06-26 — Editor refinements

- Added character **tracking**: 4px between Hanzi, 8px next to punctuation (horizontal
  only; the wave stays vertically continuous).
- Disabled **single-click-to-add**; text blocks are now created deliberately.
- Added a primary **"+ Add Text"** split-button: the main action drops an editable block
  at screen center; its dropdown offers **"Sample Text"** — a random Mandarin tone
  fun-fact, varied each time.

## 2026-06-26 — Concept & geometry documentation

- Documented the **original concept**: Hanzi-as-tone-geometry, a free editable canvas for
  Mandarin tone typography (`docs/ORIGINAL_CONCEPT.md`).
- Defined the **tone geometry** and coordinate/segment model, including the
  edge-connection rule `next.start === prev.end` (`docs/TONE_GEOMETRY_SPEC_v0.1.md`).
- Specified the **stitched third tone**: two internally-split, oppositely-skewed
  half-glyphs masked at the centre and joined at the valley seam.
- Specified the **neutral tone as a soft tail / echo** (dependent, light) as the target
  geometry; noted the prototype currently flattens neutral to 1st tone.
- Wrote **design principles** (`docs/DESIGN_PRINCIPLES.md`).
- Created the **IP documentation structure**: IP hygiene notes, prior-art research notes,
  roadmap, this changelog, and a `/snapshots` folder for timestamped visual evidence.
- Added code comments to the prototype explaining the tone geometry, the SVG rationale,
  the edge-connection rule, and the third-tone stitched V.

### Prototype state at time of writing

- Edge-connected SVG renderer for tones 1–4; stitched-V 3rd tone implemented.
- Tone detection via pinyin-pro (context-aware) with a hard-coded fallback map.
- Free-canvas interactions: pan, zoom-to-cursor, marquee multi-select, drag, duplicate,
  delete, undo/redo.
- Per-block text color and variable-font weight (Noto Sans SC `wght 100–900`).
- Earlier 3D "poster" extrude mode removed in favor of clean per-block styling; SVG/poster
  export remains a roadmap item.
