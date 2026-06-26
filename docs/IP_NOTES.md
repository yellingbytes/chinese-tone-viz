# IP Notes

Working notes on protecting the originality of Tone Canvas during early exploration.

> **This document is not legal advice.** It is an internal hygiene checklist. Consult a
> qualified attorney before relying on any of it for a real filing or dispute.

---

## The honest baseline

**Ideas alone are hard to protect.** "Render Hanzi as connected tone geometry" is a
concept, and concepts as such are generally not protectable. What *can* be protected is
the concrete **expression and implementation** of the idea.

## Potentially protectable assets

Depending on jurisdiction and how the project matures, protectable assets may include:

- **Source code** — the engine, layout logic, and renderer (copyright in the code).
- **Visual expression** — the specific look of the connected tone-wave, the stitched-V
  treatment, and distinctive generated outputs.
- **Brand** — the product name, logo, and wordmark (trademark).
- **Documentation** — these specs and design docs as authored works.
- **Generated graphics** — exported posters/SVGs as individual creative works.
- **UI / interaction design** — the canvas tool's distinctive interface.
- **Specific implementation details** — the exact geometric method (e.g. the masked,
  seam-stitched fold).

## Hygiene checklist (early stage)

- [x] **Keep this repo private** during early exploration.
- [x] **Keep a clear, timestamped commit history** — authorship evidence lives in git.
- [x] **Maintain dated documentation** of concept, geometry, and decisions (this repo).
- [ ] **Use open-source or system fonts only** while prototyping; do **not** embed or
      ship proprietary/commercial fonts without a license. (Current prototype uses Noto
      Sans SC, an open-source font — see note below.)
- [ ] **Avoid copying** any copyrighted visual assets, datasets, or UI from existing tone
      tools; build distinctive expression from scratch.
- [ ] **Record provenance** for any third-party library (license, version) used.
- [ ] **Snapshot milestones** into `/snapshots` so visual evolution is dated.

## Forward-looking considerations (when the direction matures)

- **Trademark** — consider registering the product name/wordmark once it stabilizes.
- **Design registration / design patent** — consider for distinctive, non-functional
  visual outputs or UI if the look becomes a defining asset.
- **Patent** — a genuinely novel technical method *might* be patentable, but this is
  expensive, jurisdiction-specific, and time-sensitive (public disclosure can start or
  forfeit clocks). Get professional advice before disclosing publicly.
- **Licensing** — decide an explicit license before the repo ever goes public; "no
  license" defaults to all-rights-reserved but is ambiguous for collaborators.

## Notes on current dependencies

- **Noto Sans SC** — open-source (SIL Open Font License); safe for prototyping and
  distribution under its license terms.
- **pinyin-pro** — open-source tone/pinyin library; record its license and pinned version
  if it ships in a release.

---

*Again: not legal advice. This is a checklist to keep the project clean and well-evidenced
so that future, properly-advised IP decisions are easier.*
