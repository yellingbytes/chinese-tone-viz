# Tone Canvas

> A free canvas for visualizing Mandarin tones as connected editable Hanzi typography.

Tone Canvas turns Chinese text into a continuous tone-wave. Click anywhere, type or
paste Hanzi, and each character is rendered as a geometric **tone segment** whose
shape encodes its pitch — chained edge-to-edge so a whole sentence reads as one
unbroken wave. The text stays editable; the geometry is the point.

This is not a tone-drill worksheet. It is a **dynamic tone typography engine**.

---

## Problem

Most Mandarin tone tools teach pronunciation by plotting an audio **pitch contour** —
a curve on a graph, detached from the writing. The tone lives next to the character,
never *in* it. That framing is good for ear training and bad for design: it produces
charts, not typography, and nothing you would put on a poster, a cover, or a screen.

## Concept

Tone Canvas makes the **Hanzi itself** the tone curve. Each character becomes a short
directed segment — flat, rising, folded, or falling — and consecutive characters are
welded at their endpoints. The result is a single continuous line of text that you can
read *and* hear with your eyes, while remaining fully editable typography rather than a
static rendered image.

## Core interaction model

- **Free canvas** — click empty space to drop a text block anywhere; pan, zoom, and
  marquee-select like a design tool.
- **Type or paste** — Chinese text is parsed into tones and laid out as connected
  segments in real time.
- **Editable** — double-click to edit; drag to move; duplicate, delete, undo/redo.
- **Style** — per-block text color and variable-font weight.
- **Inspect** — a "Tone frames" debug overlay exposes the underlying segment geometry.

## Tone → geometry

| Tone | Segment |
|------|---------|
| 1st — flat | horizontal segment |
| 2nd — rising | rises left → right |
| 3rd — fold | stitched **V**: split internally, connected at the valley seam |
| 4th — falling | falls left → right |
| neutral | light, dependent — a short soft tail (see roadmap) |

**The rule that ties it together:** a character's left edge starts at the exact
y-level of the previous character's right edge. See
[`docs/TONE_GEOMETRY_SPEC_v0.1.md`](docs/TONE_GEOMETRY_SPEC_v0.1.md).

## Current prototype status

- Self-contained browser prototype (`Tone Canvas.dc.html` + `support.js`), React-based,
  rendered as SVG.
- Edge-connected layout for tones 1–4; 3rd-tone stitched V implemented via masked
  half-glyphs.
- Tone detection via **pinyin-pro** (context-aware: polyphonic + sandhi), with a small
  hard-coded fallback map until the library loads.
- Free-canvas interactions: pan / zoom-to-cursor / marquee multi-select / drag /
  duplicate / delete / undo–redo.
- Per-block color and variable-font weight (Noto Sans SC, `wght 100–900`).
- Neutral tone is currently flattened to 1st tone; the soft-tail treatment is a
  documented next step.
- A poster/3D-extrude mode was prototyped and then removed in favor of clean styling;
  SVG/poster **export** is planned, not yet built.

## Roadmap (summary)

- **Phase 0** — private repo, documented concept, rough SVG prototype. *(here)*
- **Phase 1** — free-canvas editable prototype, edge-connected renderer, manual tone
  correction, poster export.
- **Phase 2** — robust tone parser, polyphonic correction, tone-sandhi mode, neutral
  refinement, SVG/PNG export.
- **Phase 3** — iOS app, live voice-pitch overlay, native comparison, Figma plugin.

Full detail in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation

- [`docs/ORIGINAL_CONCEPT.md`](docs/ORIGINAL_CONCEPT.md) — the idea and why it differs
- [`docs/TONE_GEOMETRY_SPEC_v0.1.md`](docs/TONE_GEOMETRY_SPEC_v0.1.md) — technical spec
- [`docs/DESIGN_PRINCIPLES.md`](docs/DESIGN_PRINCIPLES.md) — design rules
- [`docs/IP_NOTES.md`](docs/IP_NOTES.md) — IP hygiene notes
- [`docs/PRIOR_ART_RESEARCH_NOTES.md`](docs/PRIOR_ART_RESEARCH_NOTES.md) — research notes
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — roadmap
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — change history
- [`snapshots/`](snapshots/) — timestamped visual evidence

## Disclaimer

This repository documents an original design and implementation exploration. It is a
record of authorship and intent — **not legal advice and not a formal IP filing.** See
[`docs/IP_NOTES.md`](docs/IP_NOTES.md).
