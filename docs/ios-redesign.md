# Tone Canvas — iOS UI Redesign

A mobile-first redesign that turns the desktop-web toolbar into a calm, progressive
creative instrument. The canvas is the hero; power reveals on demand.

> Scope: single-canvas app, essential tools only. **No** gallery, projects, document
> browser, onboarding, accounts, cloud, or file organization.

---

## 1. Design rationale

**The canvas is the instrument; chrome is a thin frame around it.**
Everything that isn't the artwork collapses to two slim bars (top + bottom) over a
warm, quiet surface. Eight desktop controls crammed in one row become **five primary
verbs** in a bottom dock, with depth living in **sheets** that appear only when asked.

Five principles:

1. **One row of verbs, not a row of settings.** The dock answers "what do I want to
   *do*" (Text, Dictate, Tone, Style, Motion) — not "which knob." Knobs live inside
   the verb's sheet.
2. **Progressive disclosure.** Default state shows canvas + two bars. Style/Tone/Motion
   are one tap away but never on screen until needed. Debug lives in **More**.
3. **Selection drives context.** Style/Tone/Motion act on the *selected* block. With
   nothing selected they're disabled (dimmed) — the tool dock is honest about state.
4. **Sheets, not panels.** iOS detents (`.medium`, `.large`, custom) keep the canvas
   visible behind a translucent material — you always see your edit affect the art.
5. **Quiet by default, alive on action.** No persistent red. Red appears *only* as a
   small pulsing dot while actively listening. Motion is the one place we let it sing.

This maps to the intended loop:
**open → tap → type/dictate → see tone typography → adjust tone/style → preview motion.**

---

## 2. Screen structure

```
┌───────────────────────────────────────────────┐
│  ▟  Tone Canvas            ↶  ↷   ⇪   ⋯        │  Top App Bar (safe-area top, 52pt)
├───────────────────────────────────────────────┤
│                                                │
│                                                │
│              [ warm canvas, dotted ]           │  Main Canvas (fills)
│                                                │
│                 今天我想学习…                    │  ← selected block: blue outline
│                                                │
│                                                │
│         Empty state (centered, calm):          │
│              "Tap to add text"                 │
│            [ Text ]    [ Dictate ]             │
│                                                │
├───────────────────────────────────────────────┤
│   T̲     🎙     〜      ◐      ▶               │  Bottom Tool Dock (safe-area bottom, 64pt)
│  Text  Dictate Tone   Style  Motion            │
└───────────────────────────────────────────────┘
```

Layering (z-order): Canvas → selection overlay → Top bar / Bottom dock (floating,
material) → active Sheet (over a dimmed canvas that stays partly visible).

---

## 3. Top App Bar

Lightweight identity + global actions. **No** color/font/weight/record/debug.

| Slot   | Content                              | Icon (Phosphor)         | State |
|--------|--------------------------------------|-------------------------|-------|
| Left   | App mark + "Tone Canvas" wordmark    | custom 聲 monogram      | — |
| Right1 | Undo                                 | `ArrowCounterClockwise` | disabled when no history |
| Right2 | Redo                                 | `ArrowClockwise`        | disabled when no redo |
| Right3 | Share / Export                       | `ShareFat`              | disabled when canvas empty |
| Right4 | More                                 | `DotsThree`             | always |

- Height **52pt** (excl. status bar). Background: `Material.bar` (ultraThin) with a
  hairline bottom separator at `tokenSeparator`.
- App mark is a 24pt rounded-square containing the 聲 monogram; wordmark is
  `Headline`/semibold, truncates first on narrow widths (mark always stays).
- Icon buttons are 44×44pt hit targets, 22pt glyph, `tokenInk` / `tokenInkDisabled`.
- Undo/Redo support **tap** + (optional) long-press to peek history; haptic `.light` on each.

---

## 4. Main Canvas

Full-screen creative surface; the hero.

- Background `tokenCanvas` (#F3F1EC warm off-white). Optional dot texture: 1.1pt dots
  at `tokenDot` (10% ink), 26pt grid, parallaxes with pan/zoom. Toggle lives in More.
- **Tap empty space → add text** at that point (caret + keyboard, or the inline
  "Text / Dictate" choice on first use).
- **Drag** a block to move; **tap** to select; **double-tap** to edit; pinch to zoom,
  two-finger pan. Selected block: **2pt iOS-blue** (`tokenSelect`) rounded outline,
  4pt soft halo, 4 corner handles, and a **right-edge wrap handle** (drag to set wrap
  width — carried over from the web build's Figma-style wrapping).
- No heavy panels float over the canvas; only the two slim bars + transient sheets.

**Empty state** (centered, calm, fades in):

```
        Tap to add text
   ┌──────────┐   ┌──────────┐
   │  T  Text │   │ 🎙 Dictate│
   └──────────┘   └──────────┘
```

- Title `Title3`/medium in `tokenInkSoft`; two pill buttons (`tokenSurface`, 12pt
  radius) with Phosphor `TextT` and `Microphone`. Disappears once a block exists.

---

## 5. Bottom Primary Toolbar (Tool Dock)

The main mobile dock — **five verbs only**.

| Tool    | Phosphor / custom            | Opens                       | Needs selection? |
|---------|------------------------------|-----------------------------|------------------|
| Text    | `TextT`                      | add/edit text mode          | no |
| Dictate | `Microphone`                 | Live Dictation sheet        | no |
| Tone    | **custom tone-line** glyph   | Tone Mode sheet             | yes (else dimmed) |
| Style   | `SlidersHorizontal`          | Style Inspector sheet       | yes |
| Motion  | `PlayCircle`                 | Motion Controls sheet       | yes |

- Dock height **64pt** + bottom safe area; floating card inset 8pt, 20pt radius,
  `Material.bar`, shadow `tokenElevDock`.
- Each `ToolDockItem`: 22pt icon over **11pt** medium label, ≥ **56×48pt** tap target
  (well above 44pt). Equal-width, distributed; **no dividers**.
- States: idle `tokenInk`; **active** (its sheet open) = `tokenAccent` icon + label +
  6pt accent dot under the icon; disabled `tokenInkDisabled`.
- Selecting a tool gives haptic `.selection`. Default dock has **no red** anywhere.

---

## 6. Live Dictation Sheet  ("Dictate", not "Record")

A focused live-transcription sheet, not a recorder.

- Presented as a bottom sheet, detent **`.medium`** (≈ 44% height), grabber on.
- Layout top→bottom:
  1. **Status row**: small **red dot** (pulse, `tokenRec`) + "Listening…" while active;
     语言 chip `中文 zh-CN`.
  2. **Animated waveform** (Phosphor `Waveform` styled bars reacting to mic level).
  3. **Live recognized text** (`Title3`, growing), with a **live tone-segment preview**
     ribbon beneath it (the connected wave for what's been heard so far).
  4. **Action row**: `X` Cancel · `Pause`/`Microphone` toggle · **Insert** `Check`
     (filled accent, primary).
- On **Insert**: dictated text becomes a new **editable** canvas block at center
  (matches the web `startNativeDictation` flow), sheet dismisses, block selected.
- Permissions: first open requests mic + speech (native plugin on device).
- Haptics: `.medium` on start listening, `.light` on pause, `.success` on Insert.

Icons: `Microphone`, `Waveform`, `Pause`, `Check`, `X`.

---

## 7. Tone Mode Sheet

Choose how the **selected** text is visualized. Bottom sheet, detent `.medium`,
single-select option list (radio), live-applies on tap.

| Option          | Icon                          | One-liner |
|-----------------|-------------------------------|-----------|
| Hanzi           | `TextT`                       | Characters only. |
| Hanzi + Segments| **custom Hanzi+line**         | Characters riding the tone wave. |
| Segments Only   | **custom tone-segment**       | Pure connected tone lines. |
| Motion Preview  | `PlayCircle`                  | Watch Hanzi collapse into segments. |

- Each row: 28pt icon · title `Body`/medium · caption `Footnote`/`tokenInkSoft` ·
  trailing check when active. 56pt row height, full-width tap.
- Selecting **Motion Preview** here can hand off to the Motion sheet (§7-controls).
- Maps to `canvasMode` enum; applies instantly so the canvas updates behind the sheet.

---

## 8. Style Inspector Sheet

Style the selected block. Touch-first, no desktop dropdowns. Detent `.medium`,
expandable to `.large` for the full font list.

- **Color** — horizontal row of **color chips** (28pt circles, selected = ring +
  scale 1.1), ending with a "＋" chip that opens the system `ColorPicker`. Phosphor
  `Palette` section header.
- **Weight** — one **large iOS slider** (100–900, step 10) with a live numeric readout
  and a sample glyph that thickens as you drag. Header `SlidersHorizontal`.
- **Font** — a **horizontally-scrolling font row** (each cell renders 字 in that face)
  or a wheel; tap to apply. Grouped: System · Google · Open-source. Header `TextAa`.
- **Script** — **segmented control** `简 / 繁` (text labels, not icons).
- Section spacing 20pt; each control full-width; sheet content scrolls.
- Haptics: `.selection` on chip/font/script change; none during slider drag (continuous).

---

## 9. Motion Controls Sheet

Preview the transformation from wavy Hanzi → pure tone segments.

- Detent `.medium`. A **large circular Play/Replay** (`PlayCircle`, 64pt) centered.
- **Speed** segmented or slider: 0.5× / 1× / 2× (`Gauge`).
- **Loop** toggle (`Repeat`).
- Optional scrubber to scrub the transition manually.

**Motion design (the signature moment):**
The Hanzi must **not** fade. The glyph mass **collapses / retracts into** the underlying
tone segment — ink flows down onto the line:

1. **Settle (0–0.15s):** glyph lifts slightly, tone segment brightens beneath it.
2. **Collapse (0.15–0.7s):** glyph height scales toward the segment (anchored to the
   stroke baseline), strokes converge/melt toward the tone line; a subtle "ink-draw"
   wipe runs left→right along the segment so the line feels *drawn from* the character.
3. **Resolve (0.7–0.9s):** glyph opacity → 0 only at the very end; the connected
   tone-line structure remains, edge joints snapping crisp.

Curve: custom spring, calm not bouncy (`response 0.5, damping 0.85`). Replay re-inflates
in reverse. Haptic `.soft` at collapse start, `.rigid` at resolve.

---

## 10. More Menu

`DotsThree` → menu/sheet hiding advanced + debug.

| Item            | Icon (Phosphor / custom)      | Action |
|-----------------|-------------------------------|--------|
| Tone Frames     | **custom parallelogram-frame**| toggle `showDebugFrames` |
| Edge Joints     | **custom connected-dot**      | toggle `showEdgeJoints` |
| Geometry Debug  | `BoundingBox` (or `Crosshair`)| toggle overlays |
| Dot Grid        | `GridFour`                    | toggle canvas texture |
| Reset Canvas    | `ArrowCounterClockwise`       | destructive, confirm |
| About           | `Info`                        | version / credits |

- Presented as a `Menu` (compact) or `.medium` sheet (if toggles need switches).
- Toggles show a trailing `Toggle`; Reset is `.destructive` with a confirmation dialog.

---

## Icon mapping (Phosphor)

| Function      | Phosphor name            | Weight |
|---------------|--------------------------|--------|
| Undo          | `ArrowCounterClockwise`  | regular |
| Redo          | `ArrowClockwise`         | regular |
| Share/Export  | `ShareFat`               | regular |
| More          | `DotsThree`              | bold |
| Text          | `TextT`                  | regular |
| Dictate / mic | `Microphone`             | regular (fill when active) |
| Style         | `SlidersHorizontal`      | regular |
| Motion / Play | `PlayCircle`             | regular |
| Waveform      | `Waveform`               | regular |
| Pause         | `Pause`                  | fill |
| Confirm       | `Check`                  | bold |
| Cancel        | `X`                      | regular |
| Color         | `Palette`                | regular |
| Font          | `TextAa`                 | regular |
| Speed         | `Gauge`                  | regular |
| Loop          | `Repeat`                 | regular |
| Geometry Debug| `BoundingBox`            | regular |
| Dot Grid      | `GridFour`               | regular |
| About         | `Info`                   | regular |

Use the Phosphor SF-symbol-style assets (import the Phosphor Swift package or the SVG
set as image assets). Default weight **regular**; **bold** for emphasis (More), **fill**
for active toggles (mic/pause).

---

## Custom tone icons (Phosphor-style, 2pt stroke, 24×24 grid, round caps/joins)

Five concepts have no Phosphor match. Draw them as `Shape`s so they inherit color,
weight, and animate. Keep them in the Phosphor language: 24-unit canvas, ~2pt stroke,
round caps, generous negative space.

```swift
// Shared style
private extension Path { }
private let toneStroke = StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)

/// Tone Mode — the connected tone wave: rise · flat · fold(V) · fall
struct ToneWaveIcon: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 3*s,  y: 16*s))
        p.addLine(to: CGPoint(x: 8*s,  y: 9*s))   // rising (tone 2)
        p.addLine(to: CGPoint(x: 12*s, y: 9*s))   // flat (tone 1)
        p.addLine(to: CGPoint(x: 15*s, y: 15*s))  // fold down (tone 3 ↘)
        p.addLine(to: CGPoint(x: 18*s, y: 9*s))   // fold up   (tone 3 ↗)
        p.addLine(to: CGPoint(x: 21*s, y: 16*s))  // falling (tone 4)
        return p
    }
}

/// Hanzi + Segments — a character cell sitting on its tone segment
struct HanziSegmentIcon: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24
        var p = Path()
        // simplified "字"-ish mark
        p.addRoundedRect(in: CGRect(x: 7*s, y: 4*s, width: 10*s, height: 10*s), cornerSize: CGSize(width: 2*s, height: 2*s))
        p.move(to: CGPoint(x: 9*s, y: 9*s)); p.addLine(to: CGPoint(x: 15*s, y: 9*s))
        // tone segment beneath
        p.move(to: CGPoint(x: 4*s, y: 19*s)); p.addLine(to: CGPoint(x: 20*s, y: 16*s))
        return p
    }
}

/// Segments Only — pure connected tone line + edge joints (start/end dots)
struct ToneSegmentsIcon: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 4*s,  y: 17*s))
        p.addLine(to: CGPoint(x: 10*s, y: 8*s))
        p.addLine(to: CGPoint(x: 14*s, y: 14*s))
        p.addLine(to: CGPoint(x: 20*s, y: 8*s))
        return p
    }
    // render with two 1.6pt joint dots at start/end on top
}

/// Tone Frames — the parallelogram advance cell (skewed by the segment angle)
struct ToneFrameIcon: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 5*s,  y: 18*s))
        p.addLine(to: CGPoint(x: 9*s,  y: 6*s))
        p.addLine(to: CGPoint(x: 21*s, y: 6*s))
        p.addLine(to: CGPoint(x: 17*s, y: 18*s))
        p.closeSubpath()
        return p
    }
}

/// Edge Joints — two cells meeting; emphasize the shared seam dot
struct EdgeJointsIcon: Shape {
    func path(in r: CGRect) -> Path {
        let s = r.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 3*s,  y: 16*s)); p.addLine(to: CGPoint(x: 12*s, y: 10*s)) // left segment
        p.move(to: CGPoint(x: 12*s, y: 10*s)); p.addLine(to: CGPoint(x: 21*s, y: 16*s)) // right segment
        return p  // + a filled 2.2pt dot at (12,10): the joint
    }
}
```

`Motion Preview` reuses Phosphor `PlayCircle`. For active/selected states, fill the
custom shapes' joint dots; for idle, stroke only.

---

## SwiftUI component architecture

```
ToneCanvasView                      // root; owns CanvasStore, lays out bars + canvas
├─ CanvasSurface                    // the warm dotted surface + gestures (pan/zoom/tap)
│   └─ CanvasTextBlockView          // one text block: tone SVG/Path render + selection chrome
│       ├─ ToneRenderer             // draws specs (rise/flat/fold/fall) as Paths
│       └─ SelectionOverlay         // blue outline, corner + wrap handles
├─ TopAppBar
│   ├─ AppMark + Wordmark
│   └─ IconButton ×4 (undo, redo, share, more)
├─ BottomToolDock
│   └─ ToolDockItem ×5 (text, dictate, tone, style, motion)
├─ EmptyStatePrompt                 // "Tap to add text" + Text/Dictate pills
└─ sheets (driven by activeSheet):
   ├─ DictationSheet
   ├─ ToneModeSheet
   ├─ StyleInspectorSheet
   ├─ MotionControlSheet
   └─ MoreMenu

Reusable: IconButton, ToolDockItem, ChipRow, WeightSlider, FontRow, SegmentedScript,
PhosphorIcon (Image wrapper), custom tone Shapes.
```

### State (single source of truth — `@Observable CanvasStore`)

```swift
enum Tool { case text, dictate, tone, style, motion }
enum CanvasMode { case hanzi, hanziSegments, segmentsOnly, motionPreview }
enum ActiveSheet: Identifiable { case dictation, tone, style, motion, more
    var id: Int { hashValue } }

@Observable final class CanvasStore {
    var blocks: [TextBlock] = []
    var selectedBlockID: TextBlock.ID?
    var selectedTool: Tool? = nil
    var activeSheet: ActiveSheet? = nil
    var canvasMode: CanvasMode = .hanziSegments
    var isDictating: Bool = false
    var showDebugFrames: Bool = false
    var showEdgeJoints: Bool = false
    // history
    var canUndo: Bool { ... }; var canRedo: Bool { ... }

    var selectedBlock: TextBlock? { blocks.first { $0.id == selectedBlockID } }
    var hasSelection: Bool { selectedBlockID != nil }
}
```

```swift
struct TextBlock: Identifiable, Codable {
    let id: UUID
    var text: String
    var position: CGPoint
    var color: Color
    var weight: Int          // 100…900
    var fontID: String
    var wrapWidth: CGFloat?   // nil = auto
}
```

Wiring: dock buttons set `selectedTool` + `activeSheet`; sheets are
`.sheet(item: $store.activeSheet)` with `.presentationDetents` and
`.presentationBackground(.regularMaterial)` so the canvas shows through.
Tone/Style/Motion buttons are `.disabled(!store.hasSelection)`.

---

## Design tokens

```swift
enum Tokens {
    // Color
    static let canvas      = Color(hex: 0xF3F1EC)   // warm off-white
    static let surface     = Color.white.opacity(0.82) // bars (use Material in practice)
    static let ink         = Color(hex: 0x17150F)   // primary text/icon
    static let inkSoft     = Color(hex: 0x6C685C)   // secondary
    static let inkDisabled = Color(hex: 0xB6B1A4)
    static let accent      = Color(hex: 0x2F6BFF)   // iOS-blue: selection + active tool
    static let select      = Color(hex: 0x2F6BFF)
    static let rec         = Color(hex: 0xE5484D)   // listening dot ONLY
    static let dot         = Color(hex: 0x14120C).opacity(0.10)
    static let separator   = Color(hex: 0x14120C).opacity(0.08)

    // Radius
    static let rSheet = 24.0, rCard = 20.0, rControl = 12.0, rChip = 999.0

    // Spacing scale (pt): 4, 8, 12, 16, 20, 24
    // Sizes
    static let topBarH = 52.0, dockH = 64.0
    static let iconBar = 22.0, iconDock = 22.0, iconRow = 28.0
    static let hitMin = 44.0

    // Elevation
    static let elevDock  = ShadowToken(y: 8, blur: 30, color: ink.opacity(0.10))
    static let elevSheet = ShadowToken(y: -2, blur: 24, color: ink.opacity(0.12))
}
```

### Typography (SF Pro / system; Hanzi uses the block's chosen face)

| Token       | Style        | Use |
|-------------|--------------|-----|
| Wordmark    | Headline / semibold | brand |
| SheetTitle  | Title3 / semibold   | sheet headers |
| Body        | Body / medium       | option titles, controls |
| Caption     | Footnote / regular  | one-liners, hints |
| DockLabel   | Caption2 / medium (11pt) | dock labels |
| Numeric     | Body monospaced-digit | weight readout |

---

## Interaction states

| Element        | Idle | Active | Selected/On | Disabled |
|----------------|------|--------|-------------|----------|
| Top icon btn   | `ink` 22pt | scale 0.92 on press | — | `inkDisabled` |
| Dock item      | `ink` | scale 0.94 press + `.selection` haptic | `accent` icon+label + accent dot | `inkDisabled`, no haptic |
| Text block     | as styled | drag = grabbing | `select` outline + halo + handles | — |
| Color chip     | circle | press scale 0.9 | ring + scale 1.1 | — |
| Weight slider  | track | thumb grow on drag | — | track dim |
| Script segment | — | — | filled `ink` pill, white label | — |
| Dictate status | hidden | red dot pulse + waveform + "Listening…" | — | — |
| Sheet option   | row | highlight on press | trailing `Check` + `accent` | — |

**Haptics:** `.selection` on dock/tool/chip/segment change; `.medium` start dictation;
`.light` pause / undo / redo; `.success` Insert; `.soft`+`.rigid` at motion collapse/resolve;
`.warning` on Reset confirm.

---

## Implementation notes

1. **Bars float over the canvas** (overlay), not in a `NavigationStack` chrome, so the
   canvas truly fills the screen edge-to-edge under the bars (respect safe areas with
   `.safeAreaPadding`).
2. **Sheets keep the canvas alive:** `.presentationDetents([.medium, .large])`,
   `.presentationBackgroundInteraction(.enabled(upThrough: .medium))` so users can still
   tap/drag the canvas while a `.medium` sheet is up; `.presentationBackground(.regularMaterial)`.
3. **Selection gating:** Tone/Style/Motion `.disabled(!hasSelection)`; tapping a disabled
   tool nudges the user with a one-line tip ("Select text to style").
4. **Reuse the existing engine:** the tone geometry (rise/flat/fold/fall, edge-joint rule,
   wrap + dynamic line stacking, kinsoku) and pinyin/opencc logic already exist in the
   web build — port the pure layout math into a Swift `ToneLayout` struct producing the
   same `[Spec]`; `ToneRenderer` draws them with `Path`/`Canvas`.
5. **Dictation** uses the native speech path already wired in Capacitor; in a pure-SwiftUI
   build use `SFSpeechRecognizer` + `AVAudioEngine` directly. Live tone preview reuses
   `ToneLayout` on the interim transcript.
6. **Motion** is best done with `Canvas` + `TimelineView` (or `KeyframeAnimator`) so the
   glyph→segment collapse is a per-glyph interpolation, not a cross-fade.
7. **Phosphor**: add the Phosphor Swift package (or asset catalog of the SVGs). Wrap in a
   `PhosphorIcon(_:weight:)` view so weight/size/color are consistent app-wide.
8. **Accessibility:** every icon button has an `accessibilityLabel`; Dynamic Type on all
   text; dock labels can hide under very large type, keeping ≥44pt targets; honor
   Reduce Motion (Motion Preview falls back to a quick dissolve).

---

### The feel
Open app → tap → type or dictate → watch Chinese flow into tone waves → nudge tone/style
in a calm sheet → press play and watch the characters melt into pure tone lines.
A focused creative instrument, not a settings panel.
