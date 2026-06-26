# Tone Geometry Spec — v0.1

**Status:** draft, matches the current prototype (`Tone Canvas.dc.html`).
Values below are the constants used by `metrics()`; they are tuning parameters, not
fixed law.

---

## 1. Coordinate system

- 2D SVG space. **+x is right, +y is down** (standard SVG). "Higher pitch" therefore
  means **smaller y**.
- All layout is computed in a **world coordinate system**. A single world container
  applies pan + zoom (`translate(panX, panY) scale(zoom)`) so geometry math never has to
  know about the viewport.
- Each Hanzi occupies an **advance cell** of width `ADV` along x.

Reference constants (`metrics()`):

| Symbol | Value | Meaning |
|--------|-------|---------|
| `FS` | `70` | glyph font size |
| `ADV` | `FS * 0.9` | advance (cell width) for a Hanzi |
| `SLOPE` | `0.5` | `|Δy| / advance` for tones 2 & 4 |
| `FOLD_ANGLE` | `30°` | half-skew angle for the tone-3 fold |
| `LINE_GAP` | `FS * 2.45` | vertical distance between wrapped lines |
| punctuation advance | `ADV * 0.55` | narrower cell |
| space advance | `ADV * 0.45` | gap, no glyph |

## 2. Segment model

Layout walks the string left to right with a running pen position `(x, y)`. For each
character it emits a **spec** describing that character's tone segment, then advances the
pen. Two spec kinds exist:

- `normal` — tones 1, 2, 4 (and neutral, currently): a straight segment from
  `(sx, sy)` to `(sx + adv, sy + dy)`, drawn by shearing the glyph with `skewY(angle)`
  where `angle = atan2(dy, adv)`.
- `fold` — tone 3: a V from `(sx, sy)` down to a valley `(sx + adv/2, sy + dip)` and back
  up to `(sx + adv, sy)`.

## 3. Character start / end point logic

For a character starting at pen `(x, y)` with advance `adv`:

```
start = (x, y)
end   = (x + adv, y + Δy)      // Δy depends on tone (below)
```

After emitting the spec, the pen becomes `x += adv; y += Δy`.

## 4. Edge-connection rule (core invariant)

> **The current Hanzi's left edge must begin at the exact y-level of the previous
> Hanzi's right edge.** `next.start === prev.end`.

This is enforced structurally: the pen's `y` is **never reset between characters within a
line**. Tones 2 and 4 carry `y` to a new level; tones 1 and 3 return to the same level
(net `Δy = 0`) but still move *within* their cell. The sentence is therefore one
continuous, unbroken wave by construction, not by post-hoc alignment.

## 5. Tone 1 — flat

```
Δy = 0
angle = 0
```
A horizontal segment. The glyph is unsheared. `end = (sx + adv, sy)`.

## 6. Tone 2 — rising

```
Δy = -SLOPE * adv          // negative = upward (smaller y)
angle = atan2(Δy, adv)     // negative angle
transform: translate(sx, sy) skewY(angle)
```
The segment rises from left to right; `end = (sx + adv, sy − SLOPE·adv)`. The next
character starts from that raised endpoint.

## 7. Tone 3 — stitched V

The signature element. The glyph is rendered **twice**, each copy sheared the opposite
way and **masked to one half**, pinned so both halves meet at the valley seam:

```
dip   = (adv / 2) * tan(FOLD_ANGLE)        // valley depth
valley = (sx + adv/2, sy + dip)

left half : translate(sx, sy)                    clip→ left of centre
            └ inner skewY(+FOLD_ANGLE)           // pivot at start, descends to centre
right half: translate(sx, sy)                    clip→ right of centre
            └ inner translate(adv,0) skewY(−FOLD_ANGLE) translate(−adv,0)
                                                 // pivot at end, ascends from centre
```

- The split line is vertical at the **cell centre** (`x = adv/2`), defined in cell-local
  space so every styled/duplicated copy shares the same seam.
- Both halves evaluate to `y = sy + dip` at the seam, so they join continuously.
- Net `Δy = 0`: `end = (sx + adv, sy)`. The fold dips and returns within its own cell, so
  it connects cleanly to both neighbors.

This is "split internally, connected visually" — the character is geometrically two
masked pieces but reads as one folded Hanzi.

## 8. Tone 4 — falling

```
Δy = +SLOPE * adv          // positive = downward
angle = atan2(Δy, adv)     // positive angle
transform: translate(sx, sy) skewY(angle)
```
The segment falls from left to right; `end = (sx + adv, sy + SLOPE·adv)`.

## 9. Neutral tone

**Target geometry:** a short, light **soft tail / echo** — reduced height, dependent on
the preceding syllable, visibly *not* a full independent tone.

**Current prototype:** neutral (tone 0 from the parser) is flattened to a **1st-tone flat
segment** as a placeholder. The soft-tail rendering is specified here as the intended
behavior and tracked on the roadmap. (An earlier experiment laid the neutral glyph flat
into the scene perspective via `skewX(−67) skewY(30)`; it is retained in history but not
active.)

## 10. Multi-line wrapping logic

- Text is split on `\n` into lines.
- Line `li` is laid out starting at `y = li * LINE_GAP`, each line beginning at `x = 0`
  (in block-local space). The edge-connection rule applies **within** a line; a new line
  starts a fresh wave.
- The block's bounding box spans all lines' segment points plus glyph extent, with
  padding `pad = FS * 0.72 + 10`.

## 11. Editable text block model

A document is a list of independent **blocks**:

```
block = { id, x, y, text, color, weight }
```

- `x, y` — block origin in world space.
- `text` — raw editable string (may contain `\n`).
- `color` — face fill (default `#161410`).
- `weight` — variable-font weight, `100–900` (Noto Sans SC variable axis).

Each block is laid out independently into its own SVG sized to its bbox, then positioned
in the world container. Blocks support select / multi-select / drag / duplicate / delete
with undo–redo.

## 12. Debug mode — Tone frames

A toggle that overlays the underlying geometry for inspection:

- the tone segment (dashed line; for tone 3, a dashed polyline through the valley),
- the per-character advance cell (sheared rectangle),
- endpoint dots at each `start`/`end`, plus a valley dot for tone 3.

Geometry must always be inspectable — see `DESIGN_PRINCIPLES.md`.

## 13. SVG rendering approach

- Each glyph is an SVG `<text>` element, centered in its cell, sheared by `skewY` for the
  segment slope.
- Tone-3 halves are clipped with `<clipPath>` (userSpace, cell-local) so the seam is
  exact and shared across copies.
- A block renders to one `<svg>` with a `viewBox` equal to its bbox; `overflow: visible`
  lets sheared glyphs spill past the box without clipping.
- SVG is chosen because (a) segment endpoints must land on **exact** coordinates for the
  edge-connection rule, (b) shearing/masking text is native, and (c) the output is
  resolution-independent and **export-friendly** (poster / SVG / PNG).

## 14. Future parser replacement plan

The prototype now uses **pinyin-pro** for tone detection (context-aware: handles many
polyphonic characters and `一/不` sandhi), with the demo `TONE_MAP` as a fallback before
the library loads. Planned work:

- **Per-character manual override** — let the user correct a tone the parser gets wrong,
  stored on the block.
- **Tone-sandhi mode** — explicit 3-3→2-3 and other sandhi handling as a toggle.
- **Polyphonic / proper-noun dictionary** — names and rare readings.
- **Neutral-tone refinement** — drive the soft-tail geometry from parser confidence.
- **Pluggable backend** — keep `detectTone()` / `lineTones()` as the single seam so the
  parser can be swapped without touching geometry.
