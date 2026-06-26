# Design Principles

The rules that keep Tone Canvas a *tone typography system* rather than a decorative
effect. When a decision is ambiguous, these resolve it.

---

### 1. Pronunciation direction first, visual style second

The geometry must encode the actual tone (flat / rising / fold / falling / dependent)
before anything else. Color, weight, and styling are layered on top of correct geometry —
never in place of it. If a stylistic choice obscures the tone direction, the style is
wrong.

### 2. Readable before expressive

A reader must still recognize the Hanzi and read the sentence. Expression (exaggeration,
posterization, motion) is allowed only after legibility is satisfied. Clever beats
unreadable is a false trade — drop the cleverness.

### 3. Connected sentence, not isolated glyphs

The unit of design is the **sentence-as-wave**, not the single character. Every character
connects edge-to-edge to its neighbors (`next.start === prev.end`). Independent,
baseline-reset glyphs are a regression, even if each one looks fine alone.

### 4. Tone as structure, not decoration

Tone determines the *layout geometry* of the text, not an ornament attached to it. We do
not draw arrows, curves, or color swatches beside characters to indicate tone. The
character's own segment carries the tone.

### 5. Third tone must be stitched, not broken

The 3rd-tone fold is rendered as two internally-split halves that **meet at the valley
seam** and read as one continuous character. A 3rd tone that looks like two overlapping or
disconnected glyphs is a bug. "Split internally, connected visually" is non-negotiable.

### 6. Neutral tone must feel light and dependent

Neutral (轻声) is a short soft tail that leans on the preceding syllable. It must never be
drawn as a full, equal, independent tone. If neutral reads as "just another character,"
the weight/height is wrong.

### 7. Poster mode can exaggerate, but must preserve geometry

Expressive/export modes may amplify slope, depth, scale, and contrast — but the
underlying tone geometry and the edge-connection rule must survive the exaggeration. A
poster that breaks the wave or misstates a tone is off-brand.

### 8. Debug geometry should always be inspectable

The segment model is the source of truth, so it must be viewable on demand (Tone frames):
segments, advance cells, endpoints, and the tone-3 valley. If you cannot inspect the
geometry, you cannot trust the typography.
