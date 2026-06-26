# Prior Art — Research Notes

A lightweight, living note on the existing landscape and how Tone Canvas differs. This is
**not** a formal prior-art search; it is a working orientation to be expanded with links
and evidence over time.

---

## Landscape (general observations)

Existing Mandarin tone tools cluster into a few familiar forms:

- **Pitch-contour visualizers.** Plot an audio **pitch curve** on a time/frequency graph
  to coach pronunciation. The visualization is a *signal readout*, separate from the
  writing.
- **Tone-mark / pinyin drills.** Flashcards and quizzes over tone numbers and diacritics.
- **Tone color-coding.** Tint characters or pinyin by tone number as a memory aid.
- **Pinyin/tone libraries.** Programmatic tone lookup (e.g. context-aware parsers) used as
  infrastructure, not as a visual product.

In all of these, **tone is metadata displayed alongside the character** — a curve, a
number, a color — for the purpose of *training pronunciation*.

## How Tone Canvas is different

- **Hanzi as tone geometry.** The character itself becomes the tone segment; the writing
  *is* the contour, not a chart beside it.
- **Edge-connected typography.** Characters weld endpoint-to-endpoint into one continuous
  sentence-wave, rather than rendering as independent, baseline-aligned glyphs.
- **Editable design surface.** It is a free canvas for composing and exporting tone
  typography, not a worksheet or quiz; the output is intended as expressive type, posters,
  and graphics.
- **Signature techniques.** The stitched-V 3rd tone (split internally, joined at the
  valley seam) and the dependent soft-tail neutral are specific design/implementation
  choices, not generic visualizations.

The intent and the artifact are different: existing tools optimize for **ear/voice
training**; Tone Canvas optimizes for **visual expression and editable typography**.

## TODO — research to gather

- [ ] Links to representative pitch-contour visualizers (with screenshots, dated).
- [ ] Links to tone color-coding systems and how they map tone → color.
- [ ] Survey of any existing "tone as type/lettering" experiments, if any.
- [ ] Notes on relevant pinyin/tone parser libraries and their licenses.
- [ ] Side-by-side screenshots: pitch-curve approach vs. Tone Canvas wave.
- [ ] Captured examples in `/snapshots` showing the connected-wave output for comparison.
- [ ] (If pursuing patents) a proper professional prior-art search before public
      disclosure.
