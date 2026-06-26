# Roadmap

Phased plan from documented concept to a shippable Mandarin tone typography product.
Checked items reflect the current prototype.

---

## Phase 0 — Concept & foundation  *(current)*

- [x] Private repository established.
- [x] Original concept documented (`ORIGINAL_CONCEPT.md`).
- [x] Tone geometry specified (`TONE_GEOMETRY_SPEC_v0.1.md`).
- [x] Rough SVG prototype with edge-connected tones 1–4 and the stitched-V 3rd tone.
- [x] IP documentation structure in place.

## Phase 1 — Free-canvas prototype

- [x] Free-canvas editable prototype (click-to-add, type/paste, edit, drag).
- [x] Edge-connected SVG renderer.
- [x] Manual interaction: pan, zoom, marquee select, duplicate, delete, undo/redo.
- [ ] Manual tone correction (per-character override when the parser is wrong).
- [ ] Poster export (static composition output).

## Phase 2 — Real tone engine & export

- [ ] Proper Mandarin tone parser hardened in (pinyin-pro integrated; expand coverage).
- [ ] Polyphonic character correction (context + dictionary + manual override).
- [ ] Tone-sandhi mode (3-3→2-3, 一/不 sandhi as explicit, toggleable behavior).
- [ ] Neutral-tone refinement (implement the soft-tail geometry from the spec).
- [ ] SVG / PNG export pipeline.

## Phase 3 — Product surfaces

- [ ] iOS app (touch-native canvas).
- [ ] Live voice pitch overlay (record/realtime contour over the geometry).
- [ ] Reference / native-speaker comparison (intended vs. spoken).
- [ ] Figma plugin (generate connected tone typography inside design files).

---

*Phases are sequential in intent but not rigid; export and manual correction may move
earlier if they unblock real use.*
