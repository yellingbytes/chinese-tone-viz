# Bending Tones — Manual Tone-Wave Editing (feature spec + implementation plan)

Direct manipulation of the tone wave, with optional AI reverse-generation of new
Chinese text that matches the edited tone pattern.

> **Text → tone wave** (exists today) and now **edited tone wave → new text**.

This spec is grounded in the real engine in `app/src/App.tsx`:
- `metrics()` → `{ FS, ADV, SLOPE=0.5, FOLD_ANGLE=30, LINE_SPACING, HANZI_GAP, PUNCT_GAP }`
- `detectTone(ch, pz)` → `{ tone: 1|2|3|4|0, kind: hanzi|neutral|punct|space }` (pinyin-pro, sandhi-aware)
- `layoutSub(entries, oy, M)` → per-char **specs**: `normal { sx, sy, adv, dy, angle }` or `fold { sx, sy, adv, dip, angle }`
- Edge-connection rule: `next.start === prev.end` (the wave is one continuous line)

---

## 1. Interaction design

**Default state:** wave is read-only. Control points hidden. Canvas stays clean.

**Entering Wave Edit:** select a text block → a **Wave Edit** tool appears (bottom dock
`〜✎` or a contextual chip on the selection). Tapping it enters `waveEdit` mode for that
block: control points fade in, the block's other chrome (wrap handle, corner scale
handles) hides to avoid conflict.

**Per character, 3 draggable control points** (blue handles):
1. **start** P0 — shared joint with the previous character's end
2. **control** P1 — valley/curve tension (the tone-3 V)
3. **end** P2 — target pitch → sets rising/flat/falling; also the next char's start

**Drag loop (per pointer move):**
1. render the **live free-form** segment for the dragged char (ghost line shows the
   previous shape underneath)
2. continuously **classify** the shape → candidate tone
3. **highlight** the affected character + show a candidate tone label ("→ 2")
4. adjacent segments **re-flow** so the wave stays connected (P2 of char *i* = P0 of *i+1*)
5. on crossing a tone-class boundary, fire a subtle **haptic** (`selection`)

**On release:**
- the segment **snaps** to the nearest tone class
- a small **popover** anchors to the character:
  ```
  Tone changed  1 → 2
  ┌───────────────────────────┐
  │ Suggested: 中文声调像一条波涛 │   (Mode B only)
  ├───────────────────────────┤
  │  Apply    More    Keep shape only │
  └───────────────────────────┘
  ```
- **Apply** = accept an AI rewrite (Mode B). **More** = fetch/cycle candidates.
  **Keep shape only** = commit the tone override, leave text unchanged (Mode A).

**Never silently replace text.** Preview → explicit accept. Dragging alone only ever
changes the *wave preview / shape override*; a text rewrite always requires confirmation.

---

## 2. State model

Per-character segment (mirrors the requested type, typed for the React app):

```ts
type Tone = 1 | 2 | 3 | 4 | 0;              // 0 = neutral
interface Point { x: number; y: number; }   // block-local layout units

interface ToneSegment {
  id: string;
  char: string;
  index: number;             // position in block.text (char index)
  originalTone: Tone;        // from pinyin-pro (surface / sandhi tone as drawn)
  currentTone: Tone;         // after manual edit / snap
  start: Point; control: Point; end: Point;  // live geometry while dragging
  isManuallyEdited: boolean;
}

interface ToneEditOperation {
  blockId: number;
  beforeText: string; afterText: string;
  beforeSegments: ToneSegment[]; afterSegments: ToneSegment[];
  changedIndices: number[];
  mode: 'shapeOnly' | 'rewrite';
  timestamp: number;
}
```

**Persistent block state** (extend the existing `block`): we do **not** persist raw
control points — persistence is always a **tone class** so the wave stays connected and
re-layouts deterministically. Free-form points live only in transient drag state.

```ts
interface Block {
  /* …existing: id,x,y,text,color,weight,font,width,scale… */
  toneOverrides?: Record<number, Tone>;   // charIndex -> tone class (Mode A / manual)
}
```

**Transient UI state** (on the component, not persisted):
```ts
waveEditId: number | null;      // block currently in Wave Edit
waveDrag: { index: number; point: 'start'|'control'|'end'; segs: ToneSegment[] } | null;
waveMode: 'shapeOnly' | 'rewrite';   // default 'shapeOnly' (safe)
suggestion: { index:number; from:Tone; to:Tone; candidates: Candidate[]|null; loading:boolean } | null;
```

Layout integration: `detectTone` output is overlaid with `toneOverrides[i]` before
`layoutSub`, so an overridden char renders its chosen tone geometry while everything
else (connectivity, wrapping, stacking) is unchanged.

---

## 3. Geometry rules

Reuse the engine's mapping (screen y is **down**, so "up/higher pitch" = smaller y):

| Tone | Shape | Geometry (per char, advance = `adv`) |
|---|---|---|
| 1 flat | horizontal | `dy = 0` |
| 2 rising | up L→R | `dy = -SLOPE*adv` |
| 3 stitched V | down then up | `fold`, valley `dip = (adv/2)·tan(FOLD_ANGLE)`, net `dy = 0` |
| 4 falling | down L→R | `dy = +SLOPE*adv` |
| 0 neutral | short soft tail | half advance, low amplitude `dy ≈ +0.15·adv`, thinner |

Control-point derivation from a spec:
- **normal:** `P0=(sx,sy)`, `P2=(sx+adv, sy+dy)`, `P1 = chord midpoint`
- **fold:** `P0=(sx,sy)`, `P2=(sx+adv, sy)`, `P1 = (sx+adv/2, sy+dip)` (the valley)

Connectivity invariant (must always hold): `seg[i].P2 === seg[i+1].P0`. When the user
drags `P2` of char *i*, we set `seg[i+1].P0 = P2` and re-derive char *i+1*'s shape from
its own tone about the new start (never leave a gap). Dragging `P0` of char *i* likewise
moves char *i-1*'s `P2`.

---

## 4. Snap-to-tone logic

Classify a dragged segment into a tone class from its three points. Uses net rise,
valley depth, and length, with **hysteresis** (a class "sticks" until you clearly cross
into another) to avoid flicker.

```ts
function classify(P0: Point, P1: Point, P2: Point, adv: number, M): Tone {
  const rise = P0.y - P2.y;                 // >0 means end is higher (rising)
  const chordY = (P0.y + P2.y) / 2;
  const valley = P1.y - chordY;             // >0 means control dips below chord
  const len = Math.hypot(P2.x - P0.x, P2.y - P0.y);

  const RISE = M.SLOPE * adv * 0.4;         // ~16° threshold
  const VALLEY = M.FS * 0.18;               // meaningful dip
  const NEUTRAL_LEN = adv * 0.6;            // "shortened"
  const NEUTRAL_AMP = M.FS * 0.06;          // "softened"

  if (valley > VALLEY && Math.abs(rise) < RISE * 2) return 3;      // V
  if (len < NEUTRAL_LEN && Math.abs(rise) < NEUTRAL_AMP) return 0; // short + soft
  if (rise >  RISE) return 2;                                       // rising
  if (rise < -RISE) return 4;                                       // falling
  return 1;                                                         // flat
}
```

- **Haptic** (`selection`) fires only when `classify()` output changes during a drag.
- On release, the char's geometry is replaced by the **canonical** shape for the snapped
  tone (§3) so the persisted wave is always a clean tone segment.
- Punctuation / spaces have **no control points** and are skipped.

---

## 5. AI rewrite flow (Mode B)

Triggered on release (or "More"), only in **Rewrite** mode / on "Apply".

**Engine:** Claude (recommended `claude-sonnet-4-6` for latency; escalate hard cases to
`claude-opus-4-8`). **The API key must live server-side** — call a tiny relay
(Vercel Function / Cloudflare Worker), never embed the key in the web/iOS bundle.

**Request payload** (client → relay → Claude):
```jsonc
{
  "sentence": "中文声调像一条波浪",
  "script": "simplified",                      // preserve 简/繁
  "originalTones": [1,2,1,4,4,4,2,1,4],         // surface tones as drawn
  "targetTones":   [1,2,1,4,4,4,2,1,2],         // after edit
  "changedIndices": [8],
  "intent": "preserve meaning; natural, grammatical Mandarin",
  "constraints": { "sameLengthIfPossible": true, "keepPunctuation": true }
}
```

**Prompt (server-side, to Claude):**
> You rewrite Mandarin so its **surface tone pattern** matches a target. Given the
> original sentence, its per-character surface tones, and a target tone array (0=neutral),
> produce up to 3 alternatives whose pinyin **after tone sandhi** matches `targetTones`
> as closely as possible. Preserve meaning, grammar, register, script (簡/繁), punctuation,
> and length when possible. Only real, natural sentences — never nonsense to hit tones.
> Account for tone sandhi (3+3→2+3, 一/不), polyphones, and multi-character words (don't
> split 词 into ungrammatical pieces). Return **only** JSON.

**Output schema** (validated on the relay before returning):
```json
[
  { "candidate": "新的中文句子",
    "tonePattern": [1,2,3,4,0],
    "changedIndices": [2,4],
    "meaningPreservation": "high",
    "note": "brief explanation" }
]
```

**Verification (client):** re-run `pinyin-pro` (sandhi-aware) on each candidate and diff
its surface tones against `targetTones`; badge each candidate with an exact-match ✓ or a
"tones off at position n" note. Never trust the model's self-reported `tonePattern` blindly.

Latency UX: popover shows a shimmer while loading; results stream in; "More" re-queries
with a temperature bump + "different from: […]".

---

## 6. Undo / redo behavior

Reuse the existing undo stack (`pushHistory()` / `undo()` / `redo()` snapshot
`{blocks, selectedIds}`). Extend to capture tone-edit context so one undo restores
**text + wave + selection** together:

- Before applying a shape override or a text rewrite → `pushHistory()` (records the
  `ToneEditOperation`; `beforeText/afterText`, `beforeSegments/afterSegments`,
  `changedIndices`, `mode`).
- `undo()` restores the previous `blocks` (incl. `text` and `toneOverrides`) and
  `selectedIds`, and re-enters the prior wave-edit state if it was active.
- After an undo that changed text, briefly flash a toast: **"Restored previous text"**
  (reuse the existing `flash()` toast). After redo: "Reapplied rewrite."
- Keep the door open for a later **version timeline** (the ops already carry timestamps).

---

## 7. Error / fallback behavior

If no grammatical sentence matches the exact target pattern:
- state it gently in the popover: *"No natural sentence hits that exact tone pattern."*
- offer **nearest valid alternatives** (candidates ranked by tone-distance + meaning)
- show **which tone positions couldn't be satisfied** (highlight those characters/handles)
- always offer **"Keep shape only"** (commit the visual override, no text change)
- network/API failure → non-blocking toast, keep the shape-only override, offer Retry.

---

## 8. UI components (React)

```
WaveEditController            // owns waveEditId, waveDrag, waveMode, suggestion
├─ WaveEditToggle            // dock/contextual "Wave Edit" tool (enter/exit mode)
├─ ControlPointsOverlay      // SVG layer aligned to the block's specs
│   └─ Handle × (start/control/end) per hanzi   // blue dots, big touch targets
├─ GhostWave                 // dashed previous shape during a drag
├─ ToneLabel                 // floating "→ 2" candidate near the active char
├─ SuggestionPopover         // Tone changed a→b · candidate · Apply / More / Keep shape only
├─ RewriteSheet              // full candidate list: text, tone match ✓, meaning badge, note
└─ ModeSwitch                // Shape Only ⇄ Rewrite by Tone (segmented)
```

Visual language (matches the shadcn tokens already in the app):
- editable handles: `TOK.accent` (blue) filled dots, constant screen size (÷zoom, like
  the existing menu/corner handles)
- active segment: thicker + accent stroke; ghost: dashed `TOK.inkDim`
- popover: the existing bottom-sheet/panel style; haptics via `navigator.vibrate` on web,
  Capacitor Haptics on native.

---

## 9. Implementation plan (phased, React first)

**Phase 1 — Wave Edit mode + control points + snap (no AI, Mode A).**
- Add `waveEditId`, `waveDrag`, `toneOverrides` state.
- Overlay `ControlPointsOverlay` on the selected block (reuse spec coords; render inside
  the block SVG so it inherits position/scale, or a sibling overlay in world space).
- Wire pointer/touch drag on handles → live geometry → `classify()` → candidate label +
  ghost. On release, write `toneOverrides[i]`; re-layout (overlay override onto
  `detectTone`). Haptics on class change. **Fully offline, shippable.**

**Phase 2 — Rewrite by Tone (AI).**
- Stand up the relay (Vercel Function) with the Claude call + JSON validation + pinyin-pro
  server verify (or verify client-side).
- SuggestionPopover + RewriteSheet; Apply replaces `text` (clears overrides, re-detects);
  "Keep shape only" keeps Phase-1 behavior.

**Phase 3 — Polish + edge cases + undo timeline.**
- Word-boundary awareness (pinyin-pro segmentation), sandhi reconciliation, fallbacks,
  multi-char batch edits, "Restored previous text" toasts, optional version timeline.

Integration points in `app/src/App.tsx`: overlay tones in the `layoutBlock`/`layoutSub`
path (apply `toneOverrides[i]` after `detectTone`); add handlers alongside the existing
`onResizeDown`/`onScaleDown` pattern; reuse `pushHistory`/`undo`/`flash`.

---

## 10. Edge cases

- **Multi-character words (词):** a single tone change can break a word. Segment the
  sentence (pinyin-pro/jieba); prefer candidates that keep word boundaries; warn if a
  change lands mid-word.
- **Polyphonic characters (多音字):** the drawn tone is one reading; the AI must pick
  characters/readings consistent with context; verify with sandhi-aware pinyin-pro.
- **Tone sandhi:** the wave shows **surface** tones (3+3→2+3, 一/不). Editing targets the
  surface; the relay must generate text whose **post-sandhi** surface matches, and we
  verify by re-deriving sandhi on candidates.
- **Punctuation / spaces:** no handles; excluded from the tone pattern (kept verbatim).
- **Neutral tone:** snap via short+soft; represent as the short tail; the AI may or may
  not place a 轻声 — mark as satisfied if the natural reading is neutral.
- **Multiple chars changed at once:** batch into one `targetTones`, one AI call, one undo
  step; highlight all changed indices.
- **Exact pattern impossible:** §7 fallback (nearest + unsatisfied positions + Keep shape).
- **Visual-only art mode:** Mode A / "Keep shape only" — arbitrary tone overrides with no
  rewrite; a later extension can persist truly free-form control points for posters.

---

### Design principle
Magical but trustworthy. At every step the user can see **what tone changed**, **what text
changed**, **why**, and **how to undo it** — via the live label, the a→b popover, the
candidate `note`, and one-tap undo with a "Restored previous text" confirmation.
