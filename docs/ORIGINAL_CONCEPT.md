# Original Concept

**Project:** Tone Canvas
**Status:** Phase 0 — concept + rough prototype
**Author of record:** repository owner (see commit history for timestamps)

---

## Concept summary

Tone Canvas is a free-canvas tool that renders Mandarin Chinese text so that **the
characters themselves carry their tones**. Each Hanzi is drawn as a geometric *tone
segment*, and the segments are connected end-to-end so an entire sentence reads as one
continuous, editable tone-wave.

The user clicks anywhere on an infinite canvas, types or pastes Chinese, and the text
immediately becomes connected tone typography. Nothing about it is a fixed image: text
remains editable, movable, restylable, and exportable.

## What makes it different from existing tone trainers

Conventional Mandarin tone tools fall into a few buckets:

- **Pitch-contour visualizers** — plot an audio pitch curve on a graph for ear/voice
  training.
- **Tone-mark drills** — flashcards and quizzes over pinyin tone numbers/diacritics.
- **Color-coding systems** — tint characters or pinyin by tone.

All of these treat tone as **metadata sitting beside the character**. Tone Canvas treats
tone as **the geometry of the character's layout itself**. The difference is categorical:
the others produce study aids; Tone Canvas produces *typography*.

## The shift: from pitch-curve visualization to Hanzi-as-tone-geometry

The conceptual move is to stop drawing the pitch curve *next to* the text and instead
let the **text become the curve**. A character is not annotated with a rising arrow — the
character *is* the rising segment. Reading the sentence traces the melody, because the
baseline of the writing is the melody.

This reframes the artifact from "language-learning chart" to "tone-driven type system,"
which opens product directions (posters, covers, motion, export) that a pitch graph
never could.

## Why continuous edge-connected geometry matters

A sentence is not a list of isolated tones; it is a contour. To express that, each
character's segment must **begin exactly where the previous one ended** — same x advance,
same y level. This single rule is what turns a row of glyphs into one unbroken wave.

If characters were laid out independently (each tone drawn from a shared baseline), the
result would be a stuttering picket fence of disconnected marks. The edge-connection rule
is what makes the system feel like *speech rendered as a line* rather than a table of
symbols. It is the core invention.

## Why the 3rd-tone stitched V is a core design element

The 3rd tone dips then rises — a V. Naively, you either (a) draw a literal V curve next to
the glyph (back to annotation), or (b) split the character into two halves skewed in
opposite directions, which shreds the character into two overlapping, unreadable pieces.

Tone Canvas resolves this with a **stitched V**: the glyph is rendered twice, each copy
sheared the opposite way and masked to one half, with both halves pinned to meet at the
**valley seam**. Internally it is split; visually it is one continuous folded character
that still reads as itself. This "split internally, connected visually" technique is a
signature element of the system, not a rendering convenience.

## Why neutral tone is treated as a soft tail

Neutral tone (轻声) has no independent pitch target — its realization depends on the
preceding syllable, and it is short and light. Representing it as a full-height segment
would overstate it. The design intent is a **short soft tail / echo**: a small, dependent
flourish that visibly leans on its neighbor rather than standing as an equal tone.

> Prototype note: neutral is currently flattened to a 1st-tone (flat) segment as a
> placeholder. The soft-tail geometry is specified as the target and tracked on the
> roadmap.

## Free-canvas interaction model

The product is a canvas, not a worksheet:

- Click empty space to create a text block anywhere.
- Type or paste Chinese; tones and layout update live.
- Pan, zoom-to-cursor, and marquee box-select like a design tool.
- Drag to move, duplicate, delete; undo/redo across edits.
- Style per block (color, variable-font weight).
- Toggle a debug overlay to inspect the underlying tone geometry.

The canvas framing matters: it invites composition and expression, signaling "design
surface" instead of "exercise."

## Possible future directions

- **iOS app** — touch-native canvas; the tone-wave as a first-class mobile typography toy.
- **Figma plugin** — generate connected tone typography directly inside design files.
- **SVG / PNG export** — resolution-independent output for print and screen.
- **Poster generator** — templated layouts that exaggerate the wave while preserving
  geometry.
- **Live voice overlay** — record/realtime pitch laid over the geometric tone-wave to
  compare intended vs. spoken contour.
