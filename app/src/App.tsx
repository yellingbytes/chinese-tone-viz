// @ts-nocheck
/* Tone Canvas — ported from the original DesignCombo single-file component into a
   standard Vite + React + TS app. The component logic is preserved verbatim; only
   the framework glue changed: React is imported, pinyin-pro / opencc-js come from
   npm instead of CDN globals, and a render() method rebuilds the toolbar that the
   DC HTML template used to provide. (Next step: split tone/text/io into modules.) */
import React from 'react';
import { pinyin } from 'pinyin-pro';
import * as OpenCCImport from 'opencc-js';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import {
  ArrowCounterClockwise, ArrowClockwise, ShareFat, DotsThree,
  TextT, Microphone, SlidersHorizontal, Palette, TextAa,
  X, Check, Pause, Waveform, Info, Trash,
} from '@phosphor-icons/react';
import { ToneWaveIcon, HanziSegmentIcon, ToneSegmentsIcon, ToneFrameIcon, EdgeJointsIcon } from './ToneIcons';

// shared design tokens — shadcn/Tailwind "stone" palette (warm neutral) to match
// the cream canvas, with a single blue accent for selection/active states.
const TOK = {
  canvas: '#f3f1ec',                  // warm art surface
  ink: '#1c1917',                     // stone-900 — primary text/icon
  inkSoft: '#78716c',                 // stone-500 — secondary
  inkDim: '#a8a29e',                  // stone-400 — disabled
  accent: '#2563eb',                  // blue-600 — selection / active
  accentSoft: 'rgba(37,99,235,0.08)',
  rec: '#ef4444',                     // red-500 — listening dot only
  surface: 'rgba(255,255,255,0.88)',  // floating bars
  panel: '#ffffff',                   // sheets
  sep: '#e7e5e4',                     // stone-200 — borders
  sepSoft: 'rgba(28,25,23,0.06)',
};
// radius scale (px)
const R = { sm: 8, md: 10, lg: 12, xl: 14, pill: 999, sheet: 16 };
const COLOR_CHIPS = ['#1c1917', '#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#2563eb', '#8b5cf6', '#ec4899', '#ffffff'];

const pinyinPro = { pinyin };
const OpenCC = (OpenCCImport && OpenCCImport.Converter)
  ? OpenCCImport
  : ((OpenCCImport && OpenCCImport.default) || OpenCCImport);

export default class App extends React.Component {
  /* ===================================================================
   *  TONE CANVAS — dynamic Chinese tone typography engine
   * -------------------------------------------------------------------
   *  Each Hanzi is drawn as a geometric "tone segment" inside its own
   *  advance cell, then the segments are chained so the whole sentence
   *  reads as one continuous, unbroken wave:
   *
   *    tone 1 (flat)    — horizontal segment, net Δy = 0
   *    tone 2 (rising)  — segment rising left→right (skewY, Δy < 0)
   *    tone 3 (fold)    — stitched V: two oppositely-skewed half-glyphs,
   *                       masked at the centre, meeting at the valley
   *                       seam so it reads as ONE folded character
   *    tone 4 (falling) — segment falling left→right (skewY, Δy > 0)
   *    neutral          — light/dependent (currently flattened to tone 1;
   *                       target geometry is a short soft tail — see spec)
   *
   *  EDGE-CONNECTION RULE (the core invention): a character's left edge
   *  begins at the EXACT y-level where the previous character's right
   *  edge ended (next.start === prev.end). See layoutLine().
   *
   *  WHY SVG: glyphs are sheared with skewY and split/masked with
   *  <clipPath> so segment endpoints land on exact coordinates; the
   *  output is resolution-independent and export-friendly (poster/SVG).
   *
   *  Tone detection uses pinyin-pro (context-aware, polyphonic + sandhi)
   *  when loaded, falling back to the demo TONE_MAP below until it does.
   * -------------------------------------------------------------------
   *  toneMap — demo lookup, used only as a fallback before pinyin-pro loads
   *  tone: 1 flat · 2 rising · 3 fold(V) · 4 falling · 0 neutral
   * =================================================================== */
  static TONE_MAP = {
    '主':3,'题':2,'纹':2,'理':3,'设':4,'计':4,'逻':2,'辑':2,'整':3,
    '今':1,'天':1,'我':3,'想':3,'学':2,'习':2,'中':1,'文':2,'声':1,
    '调':4,'它':1,'像':4,'一':1,'条':2,'隐':3,'藏':2,'的':0,'旋':2,
    '律':4,'你':3,'好':3,'不':4,'是':4,'规':1,'则':2,'也':3,'说':1,
    '话':4,'里':3,'光':1,'线':4,'波':1,'浪':4,'旋':2,'隐':3,'藏':2,
    '设':4,'计':4,'像':4,'条':2,'律':4,'光':1
  };

  // Sample-text pool: short Mandarin tone / language fun-facts. "Sample Text" in
  // the Add dropdown drops a random one (different from the last) onto the canvas.
  static FUN_FACTS = [
    '普通话有四个声调，还有轻声。',
    '同样的拼音，声调不同，意思完全不同。',
    '妈麻马骂，全靠声调分辨。',
    '第三声像山谷，先下降再上升。',
    '声调是汉语的旋律。',
    '两个三声相连，前一个会变成二声。',
    '一和不，在不同声调前会变调。',
    '常用汉字大约三千个。',
    '声调让中文听起来像唱歌。',
    '每个汉字都有自己的声调形状。',
    '第二声从低到高，像在问问题。',
    '第四声短促有力，像下命令。'
  ];

  // lineTones — context-aware tone numbers for a whole line via pinyin-pro.
  // Returns an array aligned 1:1 with the line's characters, or null when the
  // library isn't loaded yet (we fall back to the demo map until then).
  lineTones(line) {
    const P = (typeof window !== 'undefined') ? pinyinPro : null;
    if (!P || !line) return null;
    try {
      const arr = P.pinyin(line, { type: 'all' });
      return (Array.isArray(arr) && arr.length === line.length) ? arr : null;
    } catch (e) { return null; }
  }

  /* ===================================================================
   *  Fonts — curated Chinese typefaces grouped by source. System fonts are
   *  already on the user's machine (Apple PingFang/Songti/Kaiti, Windows
   *  YaHei…); Google + Open-Source webfonts are injected lazily the first
   *  time they're shown. Google families ship Simplified (SC) and
   *  Traditional (TC) cuts, so the active script picks which one to load.
   * =================================================================== */
  static FONTS = [
    { id:'system',     label:'System Sans',           group:'System',      stack:'system-ui,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif' },
    { id:'pingfang',   label:'PingFang · 苹方',        group:'System',      stack:'"PingFang SC","PingFang TC","PingFang HK",sans-serif' },
    { id:'songti',     label:'Songti · 宋体',          group:'System',      stack:'"Songti SC","Songti TC","SimSun",serif' },
    { id:'kaiti',      label:'Kaiti · 楷体',           group:'System',      stack:'"Kaiti SC","Kaiti TC","STKaiti","KaiTi",serif' },
    { id:'noto-sans',  label:'Noto Sans',             group:'Google',      google:{ sc:'Noto Sans SC',  tc:'Noto Sans TC'  }, axis:true },
    { id:'noto-serif', label:'Noto Serif',            group:'Google',      google:{ sc:'Noto Serif SC', tc:'Noto Serif TC' }, axis:true },
    { id:'zcool',      label:'ZCOOL XiaoWei · 小薇',    group:'Google',      google:{ sc:'ZCOOL XiaoWei', tc:'ZCOOL XiaoWei' } },
    { id:'mashan',     label:'Ma Shan Zheng · 马善政',  group:'Google',      google:{ sc:'Ma Shan Zheng', tc:'Ma Shan Zheng' } },
    { id:'zhimang',    label:'Zhi Mang Xing · 芝芒行',  group:'Google',      google:{ sc:'Zhi Mang Xing', tc:'Zhi Mang Xing' } },
    { id:'longcang',   label:'Long Cang · 龙藏',        group:'Google',      google:{ sc:'Long Cang',     tc:'Long Cang'     } },
    { id:'lxgw',       label:'LXGW WenKai · 霞鹜文楷',  group:'Open Source', css:'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css', family:'LXGW WenKai' }
  ];

  fontDef(id){ return App.FONTS.find(f => f.id === id) || App.FONTS.find(f => f.id === 'noto-sans') || App.FONTS[0]; }

  // resolve a font id + script into a CSS font-family stack (TC cut first in traditional mode)
  fontStack(id, script){
    const f = this.fontDef(id);
    if (f.stack) return f.stack;
    if (f.css)   return `"${f.family}",sans-serif`;
    if (f.google){
      const primary = script === 'traditional' ? f.google.tc : f.google.sc;
      const second  = script === 'traditional' ? f.google.sc : f.google.tc;
      return primary === second ? `"${primary}",sans-serif` : `"${primary}","${second}",sans-serif`;
    }
    return 'sans-serif';
  }

  // inject a font's stylesheet once for the active script (idempotent)
  ensureFont(id, script){
    if (typeof document === 'undefined') return;
    if (!this._loadedFonts) this._loadedFonts = new Set();
    const f = this.fontDef(id);
    const add = (key, href) => {
      if (this._loadedFonts.has(key)) return;
      this._loadedFonts.add(key);
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    };
    if (f.css) { add('css:' + f.id, f.css); return; }
    if (f.google){
      const fam = script === 'traditional' ? f.google.tc : f.google.sc;
      const q = fam.replace(/ /g, '+');
      add('g:' + fam, f.axis
        ? `https://fonts.googleapis.com/css2?family=${q}:wght@100..900&display=swap`
        : `https://fonts.googleapis.com/css2?family=${q}&display=swap`);
    }
  }

  // load every font in play (default + each block) for the active script
  ensureUsedFonts(){
    const ids = new Set([this.state.defFont]);
    this.state.blocks.forEach(b => ids.add(b.font || this.state.defFont));
    ids.forEach(id => this.ensureFont(id, this.state.script));
  }

  /* ---- Simplified ⇄ Traditional (non-destructive, render-time) ------ */
  converter(){
    if (this.state.script !== 'traditional') return null;
    const O = (typeof window !== 'undefined') ? OpenCC : null;
    if (!O) return null;
    try { if (!this._s2t) this._s2t = O.Converter({ from: 'cn', to: 'tw' }); }
    catch (e) { return null; }
    return this._s2t;
  }
  // the text actually drawn as glyphs — converted to Traditional when toggled.
  // The stored block.text (and the edit textarea) always keep the original input.
  glyphsText(raw){
    const c = this.converter();
    if (!c || !raw) return raw;
    try { return c(raw); } catch (e) { return raw; }
  }

  // detectTone — returns {tone, kind}. kind: hanzi | neutral | punct | space.
  // `pz` is the pinyin-pro per-character result (or null before it loads).
  // NOTE: 轻声 (neutral / tone 0) is treated as first tone for now.
  detectTone(ch, pz) {
    if (ch === ' ' || ch === '\t') return { tone: 0, kind: 'space' };
    if (/[，。、；：？！,.\u2026\u201c\u201d“”‘’（）()]/.test(ch)) return { tone: 0, kind: 'punct' };
    if (pz) {
      if (pz.isZh) {
        let t = parseInt(pz.num, 10);
        if (isNaN(t) || t === 0) t = 1;        // 轻声 -> first tone for now
        return { tone: t, kind: 'hanzi' };
      }
      return { tone: 1, kind: 'hanzi' };        // latin / digits -> flat
    }
    // ---- fallback before pinyin-pro is available ----
    const m = App.TONE_MAP;
    if (Object.prototype.hasOwnProperty.call(m, ch)) {
      const t = m[ch];
      return { tone: t === 0 ? 1 : t, kind: 'hanzi' };  // neutral -> first tone
    }
    // deterministic fallback for unknown Hanzi (1..4 from codepoint)
    const t = (ch.charCodeAt(0) % 4) + 1;
    return { tone: t, kind: 'hanzi' };
  }

  /* ===================================================================
   *  toneGeometry  —  each Hanzi owns a segment; next start === prev end.
   *  Using SVG skewY so end = (x+advance, y+deltaY) holds EXACTLY.
   * =================================================================== */
  metrics() {
    const FS = 70;                        // glyph size
    const ADV = FS * 0.9;                 // horizontal advance (cell width)
    const SLOPE = 0.5;                    // |deltaY| / advance  for tone 2/4
    const FOLD_ANGLE = 30;                // tone 3 half-skew angle (deg)
    const LINE_SPACING = FS * 0.55;       // vertical gap BETWEEN stacked lines (see layoutBlock)
    const HANZI_GAP = 4;                  // tracking between adjacent Hanzi (px)
    const PUNCT_GAP = 16;                 // tracking next to a punctuation mark (px)
    return { FS, ADV, SLOPE, FOLD_ANGLE, LINE_SPACING, HANZI_GAP, PUNCT_GAP, weight: 700 };
  }

  // metrics scaled by a per-block factor (font size). Ratios (slope/angle) stay put.
  scaleMetrics(M, s) {
    if (!s || s === 1) return M;
    return { ...M, FS: M.FS * s, ADV: M.ADV * s, LINE_SPACING: M.LINE_SPACING * s, HANZI_GAP: M.HANZI_GAP * s, PUNCT_GAP: M.PUNCT_GAP * s };
  }

  // CJK line-breaking (kinsoku) — characters that may not begin / end a wrapped line.
  static NO_LINE_START = '，。、；：？！）】》」』〉”’,.;:?!)…%·';   // can't start a line (hang instead)
  static NO_LINE_END   = '（【《「『〈“‘(';                          // can't end a line (carry down)

  // Break a paragraph's per-char infos into visual sub-lines that fit `wrapWidth`
  // (layout units). CJK breaks between any two characters; punctuation rules keep
  // closing marks from starting a line (they hang past the edge) and opening marks
  // from ending one (they're carried to the next line). wrapWidth=Infinity => no wrap.
  wrapInfos(text, infos, M, wrapWidth) {
    const { ADV, HANZI_GAP, PUNCT_GAP } = M;
    const entries = [];
    for (let i = 0; i < text.length; i++) entries.push({ ch: text[i], info: infos[i], i });
    if (!wrapWidth || wrapWidth === Infinity || wrapWidth <= 0) return [entries];

    const advOf = (info) => info.kind === 'punct' ? ADV * 0.55 : ADV;
    const gapOf = (prevKind, kind) => (prevKind && prevKind !== 'space')
      ? ((prevKind === 'punct' || kind === 'punct') ? PUNCT_GAP : HANZI_GAP) : 0;
    const lines = [];
    let cur = [], x = 0, prevKind = null;
    const flush = () => { lines.push(cur); cur = []; x = 0; prevKind = null; };

    for (const ent of entries) {
      const info = ent.info, ch = ent.ch;
      if (info.kind === 'space') {
        if (cur.length === 0) continue;                 // drop spaces at the start of a wrapped line
        const w = ADV * 0.45;
        if (x + w > wrapWidth) { flush(); continue; }   // a space at the edge just becomes the break
        x += w; prevKind = 'space'; cur.push(ent); continue;
      }
      const need = gapOf(prevKind, info.kind) + advOf(info);
      if (cur.length > 0 && x + need > wrapWidth) {
        if (App.NO_LINE_START.indexOf(ch) >= 0) {
          // closing punctuation: let it hang on this line rather than orphaning it
        } else {
          let carry = null;
          const last = cur[cur.length - 1];
          if (last && App.NO_LINE_END.indexOf(last.ch) >= 0 && cur.length > 1) carry = cur.pop();
          flush();
          if (carry) { cur.push(carry); x = advOf(carry.info); prevKind = carry.info.kind; }
        }
      }
      x += gapOf(prevKind, info.kind) + advOf(info);
      prevKind = info.kind; cur.push(ent);
    }
    lines.push(cur);
    return lines;
  }

  // Lay out one already-broken sub-line of entries at baseline `oy`. Within a line
  // the pen's y carries continuously so the glyphs read as one unbroken tone wave;
  // lines are positioned by layoutBlock so they never overlap.
  layoutSub(entries, oy, M) {
    const { ADV, SLOPE, FOLD_ANGLE, HANZI_GAP, PUNCT_GAP } = M;
    const specs = [];
    let x = 0, y = oy, prevKind = null, key = 0;
    for (const ent of entries) {
      const info = ent.info, ch = ent.ch;
      if (info.kind === 'space') { x += ADV * 0.45; prevKind = 'space'; continue; }
      if (prevKind && prevKind !== 'space') x += (prevKind === 'punct' || info.kind === 'punct') ? PUNCT_GAP : HANZI_GAP;
      prevKind = info.kind;
      const adv = info.kind === 'punct' ? ADV * 0.55 : ADV;
      if (info.tone === 3 && info.kind === 'hanzi') {
        const angle = FOLD_ANGLE;
        const dip = (adv / 2) * Math.tan(angle * Math.PI / 180);
        specs.push({ key: key++, kind: 'fold', ch, sx: x, sy: y, adv, dip, angle });
        x += adv;
      } else {
        let dy = 0;
        if (info.tone === 2) dy = -SLOPE * adv;
        else if (info.tone === 4) dy = SLOPE * adv;
        const angle = Math.atan2(dy, adv) * 180 / Math.PI;
        specs.push({ key: key++, kind: 'normal', ch, sx: x, sy: y, adv, dy, angle, neutral: info.kind === 'neutral', punct: info.kind === 'punct' });
        x += adv; y += dy;
      }
    }
    return { specs, endX: x };
  }

  // Lay out a whole block. Paragraphs (split on \n) are tone-detected with full
  // context for accurate sandhi, then wrapped to `wrapWidth` (layout units; pass
  // undefined/Infinity for auto width). Because the tone wave drifts vertically as
  // it flows, each visual line is measured and STACKED below the previous one with
  // a constant gap — so wrapped or pasted text never overlaps, whatever the tones.
  layoutBlock(text, M, wrapWidth) {
    const FS = M.FS;
    const LINE_SPACING = (M.LINE_SPACING != null) ? M.LINE_SPACING : FS * 0.55;
    // Three modes: explicit width (user dragged the handle -> fixed-width box),
    // no-wrap (Infinity, used to measure natural width), and auto. Auto still wraps
    // at a readable default so long pasted/typed text breaks consistently instead of
    // running off forever — same wrapping logic, just an automatic measure.
    const explicit = (typeof wrapWidth === 'number') && wrapWidth > 0 && wrapWidth !== Infinity;
    const noWrap = wrapWidth === Infinity;
    const DEFAULT_WRAP = M.ADV * 14;
    const effW = noWrap ? null : (explicit ? wrapWidth : DEFAULT_WRAP);
    const doWrap = effW != null;
    const paras = (text || '').split('\n');
    const all = [];
    let runningTop = 0, lineCounter = 0;

    for (const para of paras) {
      const tones = this.lineTones(para);                       // context-aware over the whole paragraph
      const infos = [];
      for (let i = 0; i < para.length; i++) infos.push(this.detectTone(para[i], tones ? tones[i] : null));
      const subLines = this.wrapInfos(para, infos, M, doWrap ? effW : Infinity);

      for (const entries of subLines) {
        const { specs } = this.layoutSub(entries, 0, M);
        // vertical extent of this line incl. the glyph body (~±FS/2 around the segment)
        let lmin = Infinity, lmax = -Infinity;
        if (specs.length) {
          for (const s of specs) {
            const ys = s.kind === 'fold' ? [s.sy, s.sy + s.dip] : [s.sy, s.sy + s.dy];
            for (const yy of ys) { lmin = Math.min(lmin, yy); lmax = Math.max(lmax, yy); }
          }
          lmin -= FS / 2; lmax += FS / 2;
        } else { lmin = 0; lmax = FS; }                          // empty paragraph -> a blank line
        const offset = runningTop - lmin;
        specs.forEach(s => { s.sy += offset; s.line = lineCounter; all.push(s); });
        runningTop += (lmax - lmin) + LINE_SPACING;
        lineCounter++;
      }
    }

    // bbox over segment points (pad covers the glyph body). A fixed-width box also
    // spans at least the wrap width so the box + handle sit at the wrap boundary.
    const pad = FS * 0.72 + 10;
    let minX = 0, minY = 0, maxX = FS, maxY = 0;
    if (all.length) {
      minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
      for (const s of all) {
        const ys = s.kind === 'fold' ? [s.sy, s.sy + s.dip] : [s.sy, s.sy + s.dy];
        minX = Math.min(minX, s.sx); maxX = Math.max(maxX, s.sx + s.adv);
        for (const yy of ys) { minY = Math.min(minY, yy); maxY = Math.max(maxY, yy); }
      }
    }
    const naturalWidth = (maxX - minX);
    if (explicit) { minX = Math.min(minX, 0); maxX = Math.max(maxX, wrapWidth); }
    return {
      specs: all,
      naturalWidth,
      bbox: { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 }
    };
  }

  /* ===================================================================
   *  ToneRenderer  —  SVG glyph following its segment
   * =================================================================== */
  glyphText(spec, fontSize, fill, opacity, M) {
    return React.createElement('text', {
      x: spec.adv / 2, y: 0, textAnchor: 'middle', dominantBaseline: 'central',
      fontFamily: M.fontFamily || "'Noto Sans SC', sans-serif",
      fontWeight: M.weight,
      fontSize, fill, fillOpacity: opacity
    }, spec.ch);
  }

  // returns array of svg nodes for one glyph (face only), at given fill/opacity, optional offset
  glyphFace(spec, fill, opacity, off, M, idBase, clipId) {
    const ox = off ? off[0] : 0, oy = off ? off[1] : 0;
    const FS = M.FS;
    if (spec.kind === 'fold') {
      // tone 3 (dip): two oppositely-skewed copies of the SAME glyph, each masked
      // to one half. Left half skews +angle (pivot at start), right half skews
      // -angle (pivot at end), so both halves meet at the centre valley and stick
      // together as a single folded hanzi.
      const a = spec.angle, adv = spec.adv;
      return React.createElement('g', {
        key: idBase, transform: `translate(${spec.sx + ox},${spec.sy + oy})`
      },
        React.createElement('g', { key: 'L', clipPath: `url(#${clipId}-L)` },
          React.createElement('g', { transform: `skewY(${a})` },
            this.glyphText(spec, FS, fill, opacity, M))),
        React.createElement('g', { key: 'R', clipPath: `url(#${clipId}-R)` },
          React.createElement('g', { transform: `translate(${adv},0) skewY(${-a}) translate(${-adv},0)` },
            this.glyphText(spec, FS, fill, opacity, M)))
      );
    }
    if (spec.neutral) {
      // 轻声 (neutral tone): same size & colour as the others, but laid flat into the
      // scene's perspective (Perspective Toolkit: horizontal skew -67, vertical skew
      // 30). Anchored at its south-west (bottom-left) corner so that corner stays on
      // the baseline and the glyph leans up-right out of the previous / into the next.
      const SKX = -67, SKY = 30;
      return React.createElement('g', {
        key: idBase,
        transform: `translate(${spec.sx + ox},${spec.sy + oy}) skewX(${SKX}) skewY(${SKY}) translate(0,${-0.5 * FS})`
      }, this.glyphText(spec, FS, fill, opacity, M));
    }
    const op = opacity;   // punctuation uses the same colour/opacity as the Hanzi
    return React.createElement('g', {
      key: idBase, transform: `translate(${spec.sx + ox},${spec.sy + oy}) skewY(${spec.angle})`
    }, this.glyphText(spec, FS, fill, op, M));
  }

  // two half-masks for a fold glyph, split at the cell centre (cell-local space,
  // so every skewed/extruded copy shares the same seam).
  foldClips(spec, idBase, M) {
    const FS = M.FS, cx = spec.adv / 2, y = -2 * FS, h = 4 * FS, w = 3 * FS;
    return [
      React.createElement('clipPath', { key: idBase + '-L', id: idBase + '-L', clipPathUnits: 'userSpaceOnUse' },
        React.createElement('rect', { x: cx - w, y, width: w, height: h })),
      React.createElement('clipPath', { key: idBase + '-R', id: idBase + '-R', clipPathUnits: 'userSpaceOnUse' },
        React.createElement('rect', { x: cx, y, width: w, height: h }))
    ];
  }

  debugFrame(spec, idBase, M) {
    const FS = M.FS, blue = '#2f6bff', red = '#ff5a3c';
    const dot = (cx, cy, c) => React.createElement('circle', { key: idBase + c + cx + cy, cx, cy, r: 4.5, fill: '#fff', stroke: c, strokeWidth: 2 });
    const els = [];
    if (spec.kind === 'fold') {
      const vx = spec.sx + spec.adv / 2, vy = spec.sy + spec.dip, ex = spec.sx + spec.adv, ey = spec.sy;
      els.push(React.createElement('polyline', { key: idBase + 'seg', points: `${spec.sx},${spec.sy} ${vx},${vy} ${ex},${ey}`, fill: 'none', stroke: blue, strokeWidth: 1.6, strokeDasharray: '5 4' }));
      els.push(React.createElement('rect', { key: idBase + 'cell', x: spec.sx, y: vy - FS / 2, width: spec.adv, height: FS, fill: 'none', stroke: red, strokeWidth: 1, strokeOpacity: 0.55 }));
      els.push(dot(spec.sx, spec.sy, blue)); els.push(dot(vx, vy, '#10b07a')); els.push(dot(ex, ey, blue));
    } else {
      const ex = spec.sx + spec.adv, ey = spec.sy + spec.dy;
      els.push(React.createElement('line', { key: idBase + 'seg', x1: spec.sx, y1: spec.sy, x2: ex, y2: ey, stroke: blue, strokeWidth: 1.6, strokeDasharray: '5 4' }));
      els.push(React.createElement('g', { key: idBase + 'cell', transform: `translate(${spec.sx},${spec.sy}) skewY(${spec.angle})` },
        React.createElement('rect', { x: 0, y: -FS / 2, width: spec.adv, height: FS, fill: 'none', stroke: red, strokeWidth: 1, strokeOpacity: 0.5 })));
      els.push(dot(spec.sx, spec.sy, blue)); els.push(dot(ex, ey, blue));
    }
    return els;
  }

  renderBlockSvg(block, M) {
    // per-block size (scale) + colour + variable-font weight
    const MB = {
      ...this.scaleMetrics(M, block.scale || 1),
      weight: block.weight != null ? block.weight : M.weight,
      fontFamily: this.fontStack(block.font || this.state.defFont, this.state.script)
    };
    const faceFill = block.color || '#161410';
    const lay = this.layoutBlock(this.glyphsText(block.text), MB, block.width);
    const { bbox, specs } = lay;

    // Tone visualization mode (set via the Tone sheet)
    const mode = this.state.canvasMode;
    const showSeg = mode !== 'hanzi';                 // segments under all modes except pure Hanzi
    const segOnly = mode === 'segmentsOnly';
    const motion = this.state.motionPlaying;
    const facesOpacity = motion ? 0.08 : (segOnly ? 0 : 1);

    const defs = [], faces = [], segs = [], joints = [], frames = [];
    specs.forEach(s => {
      const id = `g-${block.id}-${s.line}-${s.key}`;
      if (!segOnly) {
        if (s.kind === 'fold') this.foldClips(s, id, MB).forEach(d => defs.push(d));
        faces.push(this.glyphFace(s, faceFill, 1, null, MB, id + '-f', id));
      }
      if (showSeg || motion) {
        // Hybrid (Hanzi + Segments): a bold accent-coloured tone line under the
        // glyphs so the contour reads clearly. Segments Only: the block colour.
        const segColor = segOnly ? faceFill : TOK.accent;
        const segOp = segOnly ? 0.95 : 0.9;
        const segW = segOnly ? 0.05 : 0.09;
        segs.push(this.segmentLine(s, segColor, segOp, segW, id + '-s', MB));
      }
      if (this.state.showEdgeJoints) joints.push(this.jointDot(s, faceFill, id + '-j', MB));
      if (this.state.showFrames) this.debugFrame(s, id, MB).forEach(f => frames.push(f));
    });
    return React.createElement('svg', {
      width: bbox.w, height: bbox.h, viewBox: `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`,
      style: { display: 'block', overflow: 'visible', pointerEvents: 'none' }
    },
      React.createElement('defs', { key: 'defs' }, defs),
      segs.length ? React.createElement('g', { key: 'sg' }, segs) : null,
      React.createElement('g', { key: 'fc', style: { opacity: facesOpacity, transition: `opacity ${0.7 / (this.state.motionSpeed || 1)}s cubic-bezier(0.22,0.61,0.36,1)` } }, faces),
      joints.length ? React.createElement('g', { key: 'jt' }, joints) : null,
      frames.length ? React.createElement('g', { key: 'fr' }, frames) : null
    );
  }

  // a single clean tone-segment line for a spec (the connecting wave)
  segmentLine(spec, color, opacity, widthMul, key, M) {
    const w = M.FS * (widthMul || 0.05);
    if (spec.kind === 'fold') {
      const vx = spec.sx + spec.adv / 2, vy = spec.sy + spec.dip, ex = spec.sx + spec.adv, ey = spec.sy;
      return React.createElement('polyline', { key, points: `${spec.sx},${spec.sy} ${vx},${vy} ${ex},${ey}`, fill: 'none', stroke: color, strokeOpacity: opacity, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' });
    }
    const ex = spec.sx + spec.adv, ey = spec.sy + spec.dy;
    return React.createElement('line', { key, x1: spec.sx, y1: spec.sy, x2: ex, y2: ey, stroke: color, strokeOpacity: opacity, strokeWidth: w, strokeLinecap: 'round' });
  }

  // the seam dot at a glyph cell's start edge (Edge Joints)
  jointDot(spec, color, key, M) {
    return React.createElement('circle', { key, cx: spec.sx, cy: spec.sy, r: M.FS * 0.05, fill: color });
  }

  /* ===================================================================
   *  Canvas state + interaction
   * =================================================================== */
  state = {
    blocks: [
      { id: 1, x: 150, y: 250, text: '中文声调像一条波浪\n开始发现隐藏的旋律。' }
    ],
    selectedIds: [1],
    editingId: null,
    showFrames: false,
    panX: 0, panY: 0, zoom: 1,
    marquee: null,           // {x, y, w, h} in screen space while box-selecting
    defColor: '#161410',     // colour + weight applied to new blocks / shown in toolbar
    defWeight: 700,
    defFont: 'noto-sans',    // typeface applied to new blocks / shown in toolbar
    script: 'simplified',    // 'simplified' | 'traditional' — render-time glyph conversion
    addMenuOpen: false,      // "+ Add Text" split-button dropdown
    recording: false,        // live Chinese dictation in progress
    recStatus: '',           // short status line shown on the record chip
    activeSheet: null,       // null | 'dictation' | 'tone' | 'style' | 'motion' | 'more'
    canvasMode: 'hanziSegments', // 'hanzi' | 'hanziSegments' | 'segmentsOnly' | 'motionPreview'
    motionPlaying: false,    // Motion preview animation in progress
    motionSpeed: 1,          // 0.5 | 1 | 2
    motionLoop: false,
    showEdgeJoints: false,   // draw the seam dot where glyph cells meet
    toast: ''                // transient status message
  };
  _nextId = 2;
  _act = null;   // active pointer action
  _space = false; // spacebar held -> pan mode
  _undo = [];
  _redo = [];

  componentDidMount() {
    this._onMove = (e) => this.onMove(e);
    this._onUp = (e) => this.onUp(e);
    this._onKey = (e) => this.onKey(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    this._onWheel = (e) => this.onWheel(e);
    this._onDocDown = (e) => {
      // close the Add dropdown when clicking anywhere outside the split button
      if (this.state.addMenuOpen && !(e.target.closest && e.target.closest('#tc-add'))) {
        this.setState({ addMenuOpen: false });
      }
    };
    this._onTouchMove = (e) => this.onTouchMove(e);
    this._onTouchEnd = (e) => this.onTouchEnd(e);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('mousedown', this._onDocDown);
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);
    window.addEventListener('touchcancel', this._onTouchEnd);
    this.ensureUsedFonts();
    this.centerView();   // center the default text in the viewport on load
  }
  // pan so the first block sits centered in the visible canvas (slightly biased
  // up to clear the bottom tool dock)
  centerView() {
    const b = this.state.blocks[0]; if (!b) return;
    const M = this.metrics();
    const r = this.blockWorldRect(b, M);
    const z = this.state.zoom || 1;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2 - 24;
    this.setState({ panX: cx - (r.x + r.w / 2) * z, panY: cy - (r.y + r.h / 2) * z });
  }
  componentWillUnmount() {
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('wheel', this._onWheel, { passive: false });
    window.removeEventListener('mousedown', this._onDocDown);
    window.removeEventListener('touchmove', this._onTouchMove, { passive: false });
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
    if (this._recog) { try { this._recog.onend = null; this._recog.stop(); } catch (e) {} this._recog = null; }
  }

  /* ---- coordinate + history helpers ---- */
  toWorld(cx, cy) {
    const { panX, panY, zoom } = this.state;
    return { x: (cx - panX) / zoom, y: (cy - panY) / zoom };
  }
  snap() { return JSON.stringify({ blocks: this.state.blocks, selectedIds: this.state.selectedIds }); }
  pushHistory() { this._undo.push(this.snap()); if (this._undo.length > 120) this._undo.shift(); this._redo = []; }
  undo() {
    if (!this._undo.length) return;
    this._redo.push(this.snap());
    const s = JSON.parse(this._undo.pop());
    this.setState({ blocks: s.blocks, selectedIds: s.selectedIds, editingId: null });
  }
  redo() {
    if (!this._redo.length) return;
    this._undo.push(this.snap());
    const s = JSON.parse(this._redo.pop());
    this.setState({ blocks: s.blocks, selectedIds: s.selectedIds, editingId: null });
  }
  blockWorldRect(b, M) {
    const { bbox } = this.layoutBlock(this.glyphsText(b.text), this.scaleMetrics(M, b.scale || 1), b.width);
    const w = (!b.text ? 240 : bbox.w), h = (!b.text ? 50 : bbox.h);
    return { x: b.x + bbox.x, y: b.y + bbox.y, w, h };
  }
  zoomBy(factor, cx, cy) {
    this.setState(s => {
      const z = Math.min(4, Math.max(0.15, s.zoom * factor));
      const k = z / s.zoom;
      return { zoom: z, panX: cx - (cx - s.panX) * k, panY: cy - (cy - s.panY) * k };
    });
  }
  startEdit(id) { this._editPre = this.snap(); this._editDirty = false; this.setState({ editingId: id, selectedIds: [id] }); }

  /* ---- pointer interaction ---- */
  onBgDown(e) {
    if (e.button === 1 || (e.button === 0 && this._space)) {
      this._act = { type: 'pan', sx: e.clientX, sy: e.clientY, px: this.state.panX, py: this.state.panY, moved: false };
      return;
    }
    if (e.button !== 0) return;
    // left-drag on empty space -> marquee box-select; a plain click adds text
    this._act = { type: 'maybe-marquee', sx: e.clientX, sy: e.clientY, add: e.shiftKey, base: e.shiftKey ? this.state.selectedIds.slice() : [], moved: false, hadSel: this.state.selectedIds.length > 0 };
    if (!e.shiftKey && this.state.selectedIds.length) this.setState({ selectedIds: [] });
  }
  onBlockDown(e, id) {
    if (e.button === 1 || (e.button === 0 && this._space)) return; // let bg pan
    if (e.button !== 0) return;
    if (this.state.editingId === id) return; // let textarea handle
    e.stopPropagation();
    let sel = this.state.selectedIds.slice();
    if (e.shiftKey) sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    else if (!sel.includes(id)) sel = [id];
    this.setState({ selectedIds: sel });
    const origins = {};
    this.state.blocks.forEach(b => { if (sel.includes(b.id)) origins[b.id] = { x: b.x, y: b.y }; });
    this._act = { type: 'maybe-drag', origins, sx: e.clientX, sy: e.clientY, moved: false, preSnap: this.snap() };
  }
  // start dragging the right-edge wrap handle (sets block.width in layout units)
  onResizeDown(e, id) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const b = this.state.blocks.find(x => x.id === id);
    if (!b) return;
    const M = this.metrics();
    // seed the drag from the box's CURRENT right edge so the handle doesn't jump
    const lay = this.layoutBlock(this.glyphsText(b.text), M, b.width);
    const startWidth = (b.width != null) ? b.width : Math.max(M.ADV * 1.2, lay.naturalWidth);
    this.setState({ selectedIds: [id] });
    this._act = { type: 'resize', id, sx: e.clientX, startWidth, moved: false, preSnap: this.snap() };
  }
  // clear a block's fixed width -> back to auto width (called on handle double-click)
  resetWidth(id) {
    const b = this.state.blocks.find(x => x.id === id);
    if (!b || b.width == null) return;
    this.pushHistory();
    this.setState(s => ({ blocks: s.blocks.map(x => { if (x.id !== id) return x; const nb = { ...x }; delete nb.width; return nb; }) }));
  }
  // start scaling a block by dragging a corner handle (scales about its centre)
  onScaleDown(e, id) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.stopPropagation();
    const b = this.state.blocks.find(x => x.id === id); if (!b) return;
    const r = this.blockWorldRect(b, this.metrics());
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const t = e.touches ? e.touches[0] : e;
    const w = this.toWorld(t.clientX, t.clientY);
    const startDist = Math.hypot(w.x - cx, w.y - cy) || 1;
    this.setState({ selectedIds: [id] });
    this._act = { type: 'scale', id, cx, cy, startDist, startScale: b.scale || 1, moved: false, preSnap: this.snap() };
  }
  // set a block's scale while keeping its centre fixed
  applyScale(id, s, cx, cy) {
    s = Math.max(0.25, Math.min(6, s));
    const b = this.state.blocks.find(x => x.id === id); if (!b) return;
    const { bbox } = this.layoutBlock(this.glyphsText(b.text), this.scaleMetrics(this.metrics(), s), b.width);
    const nx = cx - (bbox.x + bbox.w / 2), ny = cy - (bbox.y + bbox.h / 2);
    this.setState(st => ({ blocks: st.blocks.map(x => x.id === id ? { ...x, scale: s, x: nx, y: ny } : x) }));
  }
  // scale every selected block to `s` about its own centre (Size presets)
  applyScaleSelected(s) {
    this.pushHistory();
    const M = this.metrics();
    this.state.selectedIds.forEach(id => {
      const b = this.state.blocks.find(x => x.id === id); if (!b) return;
      const r = this.blockWorldRect(b, M);
      this.applyScale(id, s, r.x + r.w / 2, r.y + r.h / 2);
    });
  }
  onMove(e) {
    const a = this._act; if (!a) return;
    const dx = e.clientX - a.sx, dy = e.clientY - a.sy;
    if (!a.moved && Math.hypot(dx, dy) < 4) return;
    a.moved = true;
    if (a.type === 'pan') {
      this.setState({ panX: a.px + dx, panY: a.py + dy });
    } else if (a.type === 'maybe-marquee' || a.type === 'marquee') {
      a.type = 'marquee';
      const x = Math.min(a.sx, e.clientX), y = Math.min(a.sy, e.clientY), w = Math.abs(dx), h = Math.abs(dy);
      const M = this.metrics();
      const p0 = this.toWorld(x, y), p1 = this.toWorld(x + w, y + h);
      const hit = this.state.blocks.filter(b => {
        const r = this.blockWorldRect(b, M);
        return !(r.x > p1.x || r.x + r.w < p0.x || r.y > p1.y || r.y + r.h < p0.y);
      }).map(b => b.id);
      this.setState({ marquee: { x, y, w, h }, selectedIds: a.add ? Array.from(new Set([...a.base, ...hit])) : hit });
    } else if (a.type === 'resize') {
      const z = this.state.zoom;
      const MINW = this.metrics().ADV * 1.2;             // ~one character minimum
      const w = Math.max(MINW, a.startWidth + dx / z);
      this.setState(s => ({ blocks: s.blocks.map(b => b.id === a.id ? { ...b, width: w } : b) }));
    } else if (a.type === 'scale') {
      const w = this.toWorld(e.clientX, e.clientY);
      const dist = Math.hypot(w.x - a.cx, w.y - a.cy);
      this.applyScale(a.id, a.startScale * (dist / a.startDist), a.cx, a.cy);
    } else {
      a.type = 'drag';
      const z = this.state.zoom, wdx = dx / z, wdy = dy / z;
      this.setState(s => ({ blocks: s.blocks.map(b => a.origins[b.id] ? { ...b, x: a.origins[b.id].x + wdx, y: a.origins[b.id].y + wdy } : b) }));
    }
  }
  onUp(e) {
    const a = this._act; this._act = null; if (!a) return;
    if (a.type === 'maybe-marquee') {
      // plain tap on empty canvas just clears selection (already done on pointer-down).
      // Text blocks are created via the Text tool / empty-state buttons, not by tapping.
    } else if (a.type === 'marquee') {
      this.setState({ marquee: null });
    } else if ((a.type === 'drag' || a.type === 'resize' || a.type === 'scale') && a.moved) {
      this._undo.push(a.preSnap); if (this._undo.length > 120) this._undo.shift(); this._redo = [];
    }
  }
  onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    else this.setState(s => ({ panX: s.panX - e.deltaX, panY: s.panY - e.deltaY }));
  }

  /* ---- touch interaction (mobile) ----------------------------------- *
   *  One finger: drag a block / pan the empty canvas; tap empty space to
   *  deselect; double-tap a block to edit. Two fingers: pinch to zoom + pan.
   *  We reuse the existing pointer pipeline (onMove/onUp) by handing them a
   *  {clientX, clientY} shim, so behaviour matches the mouse exactly.        */
  onBgTouchStart(e) {
    if (e.touches.length >= 2) { this._act = null; this._pinch = null; return; }
    e.preventDefault();                                  // suppress the synthetic mouse + page scroll
    const t = e.touches[0];
    this._act = { type: 'pan', sx: t.clientX, sy: t.clientY, px: this.state.panX, py: this.state.panY, moved: false, hadSel: this.state.selectedIds.length > 0 };
  }
  onBlockTouchStart(e, id) {
    if (e.touches.length >= 2) { this._act = null; this._pinch = null; return; }
    if (this.state.editingId === id) return;             // let the textarea handle it
    e.stopPropagation(); e.preventDefault();
    const now = Date.now();
    if (this._lastTap && this._lastTap.id === id && (now - this._lastTap.t) < 320) {
      this._lastTap = null; this._act = null; this.startEdit(id); return;   // double-tap -> edit
    }
    this._lastTap = { id, t: now };
    let sel = this.state.selectedIds.slice();
    if (!sel.includes(id)) sel = [id];
    this.setState({ selectedIds: sel });
    const origins = {};
    this.state.blocks.forEach(b => { if (sel.includes(b.id)) origins[b.id] = { x: b.x, y: b.y }; });
    const t = e.touches[0];
    this._act = { type: 'maybe-drag', origins, sx: t.clientX, sy: t.clientY, moved: false, preSnap: this.snap() };
  }
  onResizeTouchStart(e, id) {
    if (e.touches.length >= 2) return;
    e.stopPropagation(); e.preventDefault();
    const b = this.state.blocks.find(x => x.id === id); if (!b) return;
    const M = this.metrics();
    const lay = this.layoutBlock(this.glyphsText(b.text), M, b.width);
    const startWidth = (b.width != null) ? b.width : Math.max(M.ADV * 1.2, lay.naturalWidth);
    const t = e.touches[0];
    this.setState({ selectedIds: [id] });
    this._act = { type: 'resize', id, sx: t.clientX, startWidth, moved: false, preSnap: this.snap() };
  }
  onTouchMove(e) {
    if (e.touches.length >= 2) {                          // two fingers
      e.preventDefault();
      this._act = null;
      const a = e.touches[0], b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
      if (!this._pinch) {
        // pinch on a single selected block -> scale the text; otherwise zoom canvas
        const bid = this.state.selectedIds.length === 1 ? this.state.selectedIds[0] : null;
        let pcx, pcy;
        if (bid != null) { const r = this.blockWorldRect(this.state.blocks.find(x => x.id === bid), this.metrics()); pcx = r.x + r.w / 2; pcy = r.y + r.h / 2; }
        this._pinch = { dist, cx, cy, bid, pcx, pcy };
        return;
      }
      const factor = this._pinch.dist > 0 ? dist / this._pinch.dist : 1;
      if (this._pinch.bid != null) {
        const cur = this.state.blocks.find(x => x.id === this._pinch.bid);
        if (cur) this.applyScale(this._pinch.bid, (cur.scale || 1) * factor, this._pinch.pcx, this._pinch.pcy);
      } else {
        this.zoomBy(factor, cx, cy);
        const ddx = cx - this._pinch.cx, ddy = cy - this._pinch.cy;
        if (ddx || ddy) this.setState(s => ({ panX: s.panX + ddx, panY: s.panY + ddy }));
      }
      this._pinch = { ...this._pinch, dist, cx, cy };
      return;
    }
    if (this._pinch) return;                              // wait for all fingers up after a pinch
    if (this._act) { e.preventDefault(); const t = e.touches[0]; this.onMove({ clientX: t.clientX, clientY: t.clientY }); }
  }
  onTouchEnd(e) {
    if (e.touches.length >= 1) { this._pinch = null; this._act = null; return; }  // pinch -> fewer fingers: reset
    this._pinch = null;
    const a = this._act;
    if (a && a.type === 'pan' && !a.moved) this.setState({ selectedIds: [] });     // tap empty -> deselect
    this.onUp({});
  }
  finishEdit(id) {
    // While dictating into this block, just leave the textarea — keep the block
    // alive (even if momentarily empty) so incoming speech still has a target.
    if (this.state.recording && id === this._recBlockId) {
      this.setState(s => ({ editingId: s.editingId === id ? null : s.editingId }));
      return;
    }
    // Leave the block in place even if empty — an empty box stays as a draggable
    // placeholder you can reposition, then tap to type (delete via menu / ⌫).
    this.setState(s => ({ editingId: s.editingId === id ? null : s.editingId }));
    this._editDirty = false;
  }
  onKey(e) {
    const { editingId, selectedIds } = this.state;
    const tag = e.target && e.target.tagName;
    if (e.key === ' ' && editingId == null && !this._space && tag !== 'TEXTAREA' && tag !== 'INPUT') {
      this._space = true; e.preventDefault(); this.forceUpdate(); return;
    }
    if (editingId != null) {
      if (e.key === 'Escape') { e.preventDefault(); this.finishEdit(editingId); }
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.redo(); return; }
    if (mod && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); this.setState(s => ({ selectedIds: s.blocks.map(b => b.id) })); return; }
    if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); this.duplicate(); return; }
    if (mod && e.key === '0') { e.preventDefault(); this.setState({ zoom: 1, panX: 0, panY: 0 }); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); this.zoomBy(1.2, window.innerWidth / 2, window.innerHeight / 2); return; }
    if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); this.zoomBy(1 / 1.2, window.innerWidth / 2, window.innerHeight / 2); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.length) { e.preventDefault(); this.del(); return; }
    if (e.key === 'Escape') { if (selectedIds.length) this.setState({ selectedIds: [] }); return; }
    if (e.key === 'Enter' && selectedIds.length === 1) { e.preventDefault(); this.startEdit(selectedIds[0]); }
  }
  onKeyUp(e) { if (e.key === ' ' && this._space) { this._space = false; this.forceUpdate(); } }

  duplicate() {
    const sel = this.state.selectedIds;
    const src = this.state.blocks.filter(b => sel.includes(b.id));
    if (!src.length) return;
    this.pushHistory();
    const newIds = [];
    const news = src.map(b => { const id = this._nextId++; newIds.push(id); return { ...b, id, x: b.x + 34, y: b.y + 34 }; });
    this.setState(s => ({ blocks: [...s.blocks, ...news], selectedIds: newIds }));
  }
  del() {
    const sel = this.state.selectedIds; if (!sel.length) return;
    this.pushHistory();
    this.setState(s => ({ blocks: s.blocks.filter(b => !sel.includes(b.id)), selectedIds: [], editingId: null }));
  }
  editText(id, v) {
    if (!this._editDirty) { this._undo.push(this._editPre || this.snap()); if (this._undo.length > 120) this._undo.shift(); this._redo = []; this._editDirty = true; }
    // If you hand-edit while dictating, adopt your text as the new anchor so the
    // next recognized words append after your edit instead of overwriting it.
    if (this.state.recording && id === this._recBlockId) { this._recBase = v; this._recFinal = ''; }
    this.setState(s => ({ blocks: s.blocks.map(b => b.id === id ? { ...b, text: v } : b) }));
  }
  // apply a colour / weight patch to the selected blocks (and remember as default)
  applyStyle(patch) {
    this.setState(s => {
      const def = {};
      if ('color' in patch) def.defColor = patch.color;
      if ('weight' in patch) def.defWeight = patch.weight;
      if ('font' in patch) def.defFont = patch.font;
      const ids = s.selectedIds;
      if (!ids.length) return def;
      return { ...def, blocks: s.blocks.map(b => ids.includes(b.id) ? { ...b, ...patch } : b) };
    });
  }
  // create an empty, editable text block at the centre of the screen
  addTextBlock() {
    const id = this._nextId++;
    const c = this.toWorld(window.innerWidth / 2, window.innerHeight / 2);
    this.pushHistory();
    this._editDirty = true; // creation already recorded; don't double on first keystroke
    this.setState(s => ({
      blocks: [...s.blocks, { id, x: c.x - 20, y: c.y, text: '', color: s.defColor, weight: s.defWeight, font: s.defFont }],
      selectedIds: [id], editingId: id, addMenuOpen: false
    }));
  }
  // a random fun-fact, different from the one used last time
  randomSample() {
    const facts = App.FUN_FACTS;
    let i = Math.floor(Math.random() * facts.length);
    if (facts.length > 1 && i === this._lastFact) i = (i + 1) % facts.length;
    this._lastFact = i;
    return facts[i];
  }
  // drop a random fun-fact sample at the centre of the screen
  addSampleBlock() {
    const id = this._nextId++;
    const c = this.toWorld(window.innerWidth / 2, window.innerHeight / 2);
    this.pushHistory();
    this.setState(s => ({
      blocks: [...s.blocks, { id, x: c.x - 150, y: c.y, text: this.randomSample(), color: s.defColor, weight: s.defWeight, font: s.defFont }],
      selectedIds: [id], addMenuOpen: false
    }));
  }

  /* ===================================================================
   *  Live Chinese dictation (speech-to-text)
   * -------------------------------------------------------------------
   *  Streams the microphone through the browser's SpeechRecognition engine
   *  (lang=zh-CN), which returns interim results with minimal latency so the
   *  tone-wave redraws as you speak. Recognised text lands in a live block;
   *  the Simplified/Traditional toggle still controls how it's rendered.
   *  (A hosted LLM STT model — Whisper / gpt-4o-transcribe / Gemini — can be
   *  swapped in here, but needs an API key + relay; see notes to the user.)
   * =================================================================== */
  toggleDictation() { this.state.recording ? this.stopDictation() : this.startDictation(); }

  async startDictation() {
    // On packaged iOS/Android the WebView has no Web Speech API — use the native
    // speech plugin instead. The web/PWA build keeps the Web Speech path below.
    if (Capacitor.isNativePlatform()) { return this.startNativeDictation(); }
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { this.setState({ recStatus: 'Speech recognition needs Chrome / Edge' }); return; }
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      this.setState({ recStatus: 'Mic blocked on file:// — serve over http://localhost' }); return;
    }

    // Best-effort permission prompt up front so the user gets a clear dialog. This is
    // ADVISORY only: SpeechRecognition manages the mic itself, so the sole hard blocker
    // is an outright permission/security denial. Other getUserMedia quirks (e.g. a
    // NotFoundError from device enumeration) must NOT abort — we fall through and let
    // SpeechRecognition try, which often still works.
    this.setState({ recStatus: 'Starting…' });
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());  // release it; SpeechRecognition opens its own
      }
    } catch (err) {
      const name = err && err.name ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        const inFrame = (window.self !== window.top);
        this.setState({ recStatus: inFrame
          ? 'Mic blocked in embedded preview — open the page in its own tab'
          : 'Mic blocked — on macOS enable Chrome in System Settings ▸ Privacy & Security ▸ Microphone, then reopen Chrome' });
        return;
      }
      // not a permission problem — keep going and let SpeechRecognition handle the mic
      console.warn('[Tone Canvas] mic pre-check failed (' + (name || 'unknown') + '); trying SpeechRecognition anyway');
    }

    // Hitting Record always drops a fresh, empty text box at the centre of the
    // view and opens it as a textarea, so you can watch the dictated text stream
    // in live and edit it anytime — never appending onto existing blocks.
    const id = this._nextId++;
    const c = this.toWorld(window.innerWidth / 2, window.innerHeight / 2);
    this.pushHistory();
    this._recBase = '';
    this.setState(s => ({
      blocks: [...s.blocks, { id, x: c.x - 150, y: c.y, text: '', color: s.defColor, weight: s.defWeight, font: s.defFont }],
      selectedIds: [id], editingId: id, recording: true, recStatus: 'Listening…'
    }));
    this._recBlockId = id;
    this._recFinal = '';        // dictation appended this session (after _recBase)
    this._editPre = this.snap(); // so manual edits during dictation are undoable
    this._editDirty = true;

    const r = new SR();
    this._recog = r;
    r.lang = 'zh-CN';        // stored text stays Simplified; the script toggle handles display
    r.continuous = true;
    r.interimResults = true; // emit partials for low-latency live updates
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = '';
      // accumulate newly finalized chunks; resultIndex marks what changed.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) this._recFinal += res[0].transcript.replace(/\s+/g, '');
        else interim += res[0].transcript;
      }
      interim = interim.replace(/\s+/g, '');
      const bid = this._recBlockId;
      // text = your existing/edited text  +  what's been dictated  +  live partial
      const text = (this._recBase || '') + this._recFinal + interim;
      this.setState(s => ({
        blocks: s.blocks.map(b => b.id === bid ? { ...b, text } : b),
        recStatus: interim ? '… ' + interim.slice(-14) : 'Listening…'
      }));
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // fatal: stop retrying and guide the user instead of looping the error
        this.stopDictation('Mic blocked — on macOS enable Chrome in System Settings ▸ Privacy & Security ▸ Microphone, then reopen Chrome');
        return;
      }
      if (e.error === 'audio-capture') { this.stopDictation('No microphone detected — check System Settings ▸ Sound ▸ Input'); return; }
      if (e.error === 'network') { this.setState({ recStatus: 'Speech service needs an internet connection' }); return; }
      this.setState({ recStatus: 'Mic error: ' + e.error });
    };
    r.onend = () => {
      // the engine auto-stops after a pause; restart while the user still wants it
      if (this.state.recording && this._recog === r) { try { r.start(); } catch (e) {} }
    };
    try { r.start(); } catch (e) { this.setState({ recStatus: 'Could not start mic' }); }
  }

  // Native (iOS/Android) dictation via @capacitor-community/speech-recognition.
  // Mirrors the web flow: a fresh editable block fills in live. Native engines
  // return a cumulative transcript per utterance and auto-stop on pauses, so we
  // commit each utterance into _recBase and restart to keep capturing.
  async startNativeDictation() {
    const id = this._nextId++;
    const c = this.toWorld(window.innerWidth / 2, window.innerHeight / 2);
    this.pushHistory();
    this._recBase = ''; this._nativePartial = ''; this._nativeStt = true;
    this.setState(s => ({
      blocks: [...s.blocks, { id, x: c.x - 150, y: c.y, text: '', color: s.defColor, weight: s.defWeight, font: s.defFont }],
      selectedIds: [id], editingId: id, recording: true, recStatus: 'Starting…'
    }));
    this._recBlockId = id; this._editPre = this.snap(); this._editDirty = true;

    const render = () => {
      const bid = this._recBlockId;
      const text = (this._recBase || '') + (this._nativePartial || '');
      this.setState(s => ({
        blocks: s.blocks.map(b => b.id === bid ? { ...b, text } : b),
        recStatus: this._nativePartial ? '… ' + this._nativePartial.slice(-14) : 'Listening…'
      }));
    };
    const begin = () => SpeechRecognition.start({ language: 'zh-CN', maxResults: 1, partialResults: true, popup: false });
    try {
      const perm = await SpeechRecognition.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') {
        this.stopDictation('Mic/speech blocked — enable it in Settings'); return;
      }
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener('partialResults', (data: any) => {
        const m = data && data.matches && data.matches[0] ? String(data.matches[0]) : '';
        this._nativePartial = m.replace(/\s+/g, ''); render();
      });
      await SpeechRecognition.addListener('listeningState', (data: any) => {
        if (data && data.status === 'stopped' && this._nativeStt) {
          this._recBase = (this._recBase || '') + (this._nativePartial || ''); this._nativePartial = '';
          if (this.state.recording) { try { begin(); } catch (e) {} }   // keep capturing after a pause
        }
      });
      await begin();
      this.setState({ recStatus: 'Listening…' });
    } catch (e) {
      this.stopDictation('Could not start microphone');
    }
  }

  stopDictation(status) {
    if (this._nativeStt) {
      this._nativeStt = false;
      try { SpeechRecognition.stop(); } catch (e) {}
      try { SpeechRecognition.removeAllListeners(); } catch (e) {}
      this._recBase = (this._recBase || '') + (this._nativePartial || ''); this._nativePartial = '';
    }
    const r = this._recog; this._recog = null;
    if (r) { try { r.onend = null; r.stop(); } catch (e) {} }
    const id = this._recBlockId;
    // Keep the block open and editable so you can correct the transcript; only
    // discard it if nothing was captured and it was empty to begin with.
    this.setState(s => {
      const b = s.blocks.find(x => x.id === id);
      const empty = b && (!b.text || !b.text.trim());
      return {
        recording: false, recStatus: status || '',
        blocks: empty ? s.blocks.filter(x => x.id !== id) : s.blocks,
        editingId: empty ? null : s.editingId,
        selectedIds: empty ? s.selectedIds.filter(x => x !== id) : s.selectedIds
      };
    });
  }

  /* ===================================================================
   *  render
   * =================================================================== */
  renderBlockNode(block, M) {
    const lay = this.layoutBlock(this.glyphsText(block.text), this.scaleMetrics(M, block.scale || 1), block.width);
    const { bbox } = lay;
    // positioned in WORLD space — the world container applies pan + zoom.
    const selected = this.state.selectedIds.includes(block.id);
    const editing = this.state.editingId === block.id;
    const empty = !block.text;
    const left = block.x + bbox.x, top = block.y + bbox.y;

    const children = [];
    // selection frame
    if (selected) {
      children.push(React.createElement('div', {
        key: 'sel', style: {
          position: 'absolute', inset: '-2px', border: '1.5px solid #2f6bff',
          borderRadius: '3px', pointerEvents: 'none', boxShadow: '0 0 0 4px rgba(47,107,255,0.08)'
        }
      }));
      ['-7px -7px', '-7px auto auto calc(100% - 7px)'].forEach(() => {});
      // corner handles — drag any corner to scale the block (about its centre)
      const zc = this.state.zoom || 1;
      const corner = (s, cur) => React.createElement('div', {
        key: 'c' + s.left + s.top + s.right + s.bottom,
        onMouseDown: (e) => this.onScaleDown(e, block.id),
        onTouchStart: (e) => this.onScaleDown(e, block.id),
        title: 'Drag to resize',
        style: { position: 'absolute', width: `${14 / zc}px`, height: `${14 / zc}px`, background: '#fff', border: `${1.5 / zc}px solid ${TOK.accent}`, borderRadius: `${3 / zc}px`, cursor: cur, pointerEvents: 'auto', touchAction: 'none', zIndex: 24, ...s }
      });
      const off = `${-7 / zc}px`;
      children.push(corner({ left: off, top: off }, 'nwse-resize'));
      children.push(corner({ right: off, top: off }, 'nesw-resize'));
      children.push(corner({ left: off, bottom: off }, 'nesw-resize'));
      children.push(corner({ right: off, bottom: off }, 'nwse-resize'));
      // right-edge wrap handle (Figma-style): drag to set the wrap width, double-click for auto
      if (!editing) {
        children.push(React.createElement('div', {
          key: 'rsz',
          onMouseDown: (e) => this.onResizeDown(e, block.id),
          onTouchStart: (e) => this.onResizeTouchStart(e, block.id),
          onDoubleClick: (e) => { e.stopPropagation(); this.resetWidth(block.id); },
          title: block.width != null ? 'Drag to set wrap width · double-click for auto width' : 'Drag left to wrap text',
          style: {
            position: 'absolute', top: '10px', bottom: '10px', right: '-10px', width: '20px',
            cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none', zIndex: 23,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }
        }, React.createElement('div', {
          key: 'grip', style: {
            width: '5px', height: '34px', maxHeight: '70%', background: '#2f6bff',
            borderRadius: '3px', boxShadow: '0 1px 3px rgba(20,18,12,0.30)'
          }
        })));
      }
      // mini toolbar
      const z = this.state.zoom || 1;
      children.push(React.createElement('div', {
        key: 'tb', style: {
          // counter-scale by 1/zoom so the menu stays a constant screen size,
          // anchored a constant gap above the block regardless of zoom level.
          position: 'absolute', left: '50%', bottom: '100%', marginBottom: `${8 / z}px`,
          transform: `translateX(-50%) scale(${1 / z})`, transformOrigin: 'center bottom',
          display: 'flex', gap: '2px', padding: '4px', background: TOK.panel,
          border: `1px solid ${TOK.sep}`, borderRadius: '10px',
          boxShadow: '0 6px 20px rgba(28,25,23,0.14)', pointerEvents: 'auto', whiteSpace: 'nowrap'
        },
        onMouseDown: (e) => e.stopPropagation()
      },
        React.createElement('button', { key: 'e', onClick: () => this.startEdit(block.id), style: this.miniBtn() }, 'Edit'),
        React.createElement('button', { key: 'd', onClick: () => this.duplicate(), style: this.miniBtn() }, 'Duplicate'),
        React.createElement('button', { key: 'x', onClick: () => this.del(), style: { ...this.miniBtn(), color: '#d23b3b' } }, 'Delete')
      ));
    }
    // the glyph svg / placeholder
    if (empty && !editing) {
      children.push(React.createElement('div', {
        key: 'ph', style: { padding: '14px 20px', color: '#a8a395', fontSize: '15px', fontWeight: 500, fontStyle: 'italic', whiteSpace: 'nowrap' }
      }, '输入中文… type or paste'));
    } else {
      children.push(React.createElement('div', { key: 'svg', style: { position: 'absolute', left: 0, top: 0 } }, this.renderBlockSvg(block, M)));
    }

    const blockDiv = React.createElement('div', {
      key: 'blk-' + block.id,
      onMouseDown: (e) => this.onBlockDown(e, block.id),
      onTouchStart: (e) => this.onBlockTouchStart(e, block.id),
      onDoubleClick: (e) => { e.stopPropagation(); this.startEdit(block.id); },
      style: {
        position: 'absolute', left: left + 'px', top: top + 'px',
        width: (empty && !editing ? 240 : bbox.w) + 'px',
        height: (empty && !editing ? 50 : bbox.h) + 'px',
        cursor: this._act && this._act.type === 'drag' ? 'grabbing' : 'grab',
        pointerEvents: 'auto', touchAction: editing ? 'auto' : 'none',
        zIndex: selected ? 20 : 10
      }
    }, children);

    // editing textarea (sibling overlay, not clipped)
    let editor = null;
    if (editing) {
      const taW = Math.max(280, bbox.w);
      editor = React.createElement('textarea', {
        key: 'ta-' + block.id, autoFocus: true,
        value: block.text,
        onChange: (e) => this.editText(block.id, e.target.value),
        onMouseDown: (e) => e.stopPropagation(),
        onBlur: () => this.finishEdit(block.id),
        spellCheck: false,
        style: {
          position: 'absolute',
          left: (left + bbox.w / 2 - taW / 2) + 'px',
          top: (top + bbox.h + 12) + 'px',
          minWidth: '280px', width: taW + 'px', height: '52px',
          padding: '10px 13px', fontSize: '17px', fontWeight: 500, lineHeight: 1.3,
          color: '#17150f', background: 'rgba(255,255,255,0.97)', resize: 'none',
          border: '1.5px solid #2f6bff', borderRadius: '10px', outline: 'none',
          boxShadow: '0 10px 30px rgba(47,107,255,0.18)', zIndex: 30,
          pointerEvents: 'auto', userSelect: 'text', WebkitUserSelect: 'text',
          fontFamily: this.fontStack(block.font || this.state.defFont, this.state.script)
        }
      });
    }
    return React.createElement(React.Fragment, { key: 'f-' + block.id }, blockDiv, editor);
  }

  miniBtn() {
    return { padding: '5px 10px', fontSize: '12px', fontWeight: 600, color: '#211e16', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer' };
  }

  /* ---- mobile chrome: sheets, tone modes, motion, tap-to-add ---- */
  openSheet(name) { this.setState({ activeSheet: name }); }
  closeSheet() { if (this.state.recording) this.stopDictation(); this.setState({ activeSheet: null }); }
  setCanvasMode(m) { this.setState({ canvasMode: m }); }
  toggleEdgeJoints() { this.setState(s => ({ showEdgeJoints: !s.showEdgeJoints })); }
  resetCanvas() { this.pushHistory(); this.setState({ blocks: [], selectedIds: [], editingId: null, activeSheet: null }); }
  flash(msg) { this.setState({ toast: msg }); clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState({ toast: '' }), 1800); }
  share() { this.flash('Export coming soon'); }
  playMotion() {
    const spd = this.state.motionSpeed || 1;
    this.setState({ canvasMode: 'motionPreview', motionPlaying: false });
    requestAnimationFrame(() => this.setState({ motionPlaying: true }));
    clearTimeout(this._motionT);
    this._motionT = setTimeout(() => {
      this.setState({ motionPlaying: false });
      if (this.state.motionLoop && this.state.activeSheet === 'motion') {
        clearTimeout(this._loopT); this._loopT = setTimeout(() => this.playMotion(), 700 / spd);
      }
    }, 1500 / spd);
  }
  // create an empty editable block at a world point (tap-to-add on the canvas)
  addTextBlockAt(wx, wy) {
    const id = this._nextId++;
    this.pushHistory(); this._editDirty = true;
    this.setState(s => ({
      blocks: [...s.blocks, { id, x: wx, y: wy, text: '', color: s.defColor, weight: s.defWeight, font: s.defFont }],
      selectedIds: [id], editingId: id
    }));
  }
  // dictation routed through the bottom sheet
  dictateTap() { this.setState({ activeSheet: 'dictation' }); if (!this.state.recording) this.startDictation(); }
  insertDictation() { this.stopDictation(); this.setState({ activeSheet: null }); }
  cancelDictation() {
    const id = this._recBlockId; this.stopDictation();
    this.setState(s => ({ blocks: s.blocks.filter(b => b.id !== id), selectedIds: s.selectedIds.filter(x => x !== id), activeSheet: null }));
  }

  renderVals() {
    const M = this.metrics();
    this.ensureUsedFonts();  // make sure every typeface in view is loaded for the active script
    const { panX, panY, zoom, marquee } = this.state;
    const cell = 26 * zoom;

    const grid = React.createElement('div', {
      key: 'grid', style: {
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundColor: '#f3f1ec',
        backgroundImage: 'radial-gradient(rgba(20,18,12,0.10) 1.1px, transparent 1.1px)',
        backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `${panX}px ${panY}px`
      }
    });
    const panning = this._act && this._act.type === 'pan';
    const bg = React.createElement('div', {
      key: 'bg', onMouseDown: (e) => this.onBgDown(e), onTouchStart: (e) => this.onBgTouchStart(e),
      onDoubleClick: (e) => { const p = this.toWorld(e.clientX, e.clientY); this.addTextBlockAt(p.x, p.y); },
      style: { position: 'absolute', inset: 0, touchAction: 'none', cursor: panning ? 'grabbing' : (this._space ? 'grab' : 'default') }
    });

    // world layer: pan + zoom applied once; blocks live in world coordinates.
    const world = React.createElement('div', {
      key: 'world', style: {
        position: 'absolute', left: 0, top: 0, width: 0, height: 0,
        transformOrigin: '0 0', transform: `translate(${panX}px,${panY}px) scale(${zoom})`,
        pointerEvents: 'none'
      }
    }, this.state.blocks.map(b => this.renderBlockNode(b, M)));

    const marqueeEl = marquee ? React.createElement('div', {
      key: 'mq', style: {
        position: 'absolute', left: marquee.x + 'px', top: marquee.y + 'px',
        width: marquee.w + 'px', height: marquee.h + 'px', pointerEvents: 'none',
        border: '1px solid #2f6bff', background: 'rgba(47,107,255,0.08)', zIndex: 25
      }
    }) : null;

    const canvasContent = React.createElement('div', {
      style: { position: 'absolute', inset: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }
    }, grid, bg, world, marqueeEl);

    // current colour / weight shown in the toolbar = first selected block, else default
    const sel = this.state.blocks.filter(b => this.state.selectedIds.includes(b.id));
    const colorVal = sel.length ? (sel[0].color || '#161410') : this.state.defColor;
    const weightVal = sel.length ? (sel[0].weight != null ? sel[0].weight : 700) : this.state.defWeight;
    const fontVal = sel.length ? (sel[0].font || this.state.defFont) : this.state.defFont;

    // Font picker — native <select> with one <optgroup> per source.
    const groups = {};
    App.FONTS.forEach(f => { (groups[f.group] = groups[f.group] || []).push(f); });
    const fontSelect = React.createElement('select', {
      value: fontVal,
      onChange: (e) => this.applyStyle({ font: e.target.value }),
      onMouseDown: (e) => e.stopPropagation(),
      title: 'Typeface',
      style: {
        fontSize: '12.5px', fontWeight: 600, color: '#211e16', padding: '4px 22px 4px 8px',
        border: '1px solid rgba(20,18,12,0.14)', borderRadius: '8px', background: '#fff',
        cursor: 'pointer', outline: 'none', maxWidth: '170px',
        fontFamily: this.fontStack(fontVal, this.state.script)
      }
    }, Object.keys(groups).map(g =>
      React.createElement('optgroup', { key: g, label: g },
        groups[g].map(f => React.createElement('option', { key: f.id, value: f.id, style: { fontFamily: 'system-ui, sans-serif' } }, f.label)))
    ));

    // Simplified / Traditional segmented toggle.
    const seg = (label, val) => {
      const active = this.state.script === val;
      return React.createElement('button', {
        key: val, onClick: () => this.setState({ script: val }), title: val === 'simplified' ? 'Simplified 简体' : 'Traditional 繁體',
        style: {
          padding: '4px 11px', fontSize: '14px', fontWeight: 700, lineHeight: 1, borderRadius: '6px',
          fontFamily: "'Noto Sans SC','Noto Sans TC',sans-serif", border: 'none', cursor: 'pointer',
          color: active ? '#fff' : '#5b5648',
          background: active ? '#1c1a14' : 'transparent',
          boxShadow: active ? '0 1px 2px rgba(20,18,12,0.25)' : 'none'
        }
      }, label);
    };
    const scriptToggle = React.createElement('div', {
      style: { display: 'flex', gap: '2px', padding: '2px', background: 'rgba(20,18,12,0.06)', borderRadius: '8px' }
    }, seg('简', 'simplified'), seg('繁', 'traditional'));

    // Live dictation record button (+ inline status while listening).
    const rec = this.state.recording;
    const recordBtn = React.createElement('button', {
      onClick: () => this.toggleDictation(),
      onMouseDown: (e) => e.stopPropagation(),
      title: rec ? 'Stop dictation' : 'Live Chinese dictation (speech-to-text)',
      style: {
        display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
        fontSize: '12.5px', fontWeight: 700, borderRadius: '9px', cursor: 'pointer',
        color: rec ? '#fff' : '#b3261e',
        background: rec ? '#d23b3b' : 'rgba(210,59,59,0.10)',
        border: rec ? 'none' : '1px solid rgba(210,59,59,0.28)'
      }
    },
      React.createElement('span', {
        key: 'dot', style: {
          width: '9px', height: '9px', borderRadius: '50%', flex: '0 0 auto',
          background: rec ? '#fff' : '#d23b3b',
          animation: rec ? 'tc-pulse 1.2s ease-out infinite' : 'none'
        }
      }),
      rec ? 'Stop' : 'Record'
    );
    const recStatus = this.state.recStatus;
    const recErr = /block|error|denied|serve|internet|found|use|file|reopen/i.test(recStatus || '');
    const recordControl = React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '8px' }
    },
      recordBtn,
      recStatus ? React.createElement('span', {
        key: 'st', title: recStatus,
        style: { fontSize: '11px', fontWeight: 500, color: recErr ? '#b3261e' : '#8a8674', maxWidth: '210px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }
      }, recStatus) : null
    );

    const framesActive = this.state.showFrames;
    const framesBtnStyle = {
      display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px',
      fontSize: '12.5px', fontWeight: 600, borderRadius: '9px', cursor: 'pointer',
      color: framesActive ? '#2f6bff' : '#5b5648',
      background: framesActive ? 'rgba(47,107,255,0.10)' : 'transparent',
      border: framesActive ? '1px solid rgba(47,107,255,0.30)' : '1px solid transparent'
    };
    const addMenuStyle = {
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '188px', padding: '5px',
      background: '#fff', border: '1px solid rgba(20,18,12,0.10)', borderRadius: '11px',
      boxShadow: '0 12px 34px rgba(20,18,12,0.16)', zIndex: 60,
      display: this.state.addMenuOpen ? 'block' : 'none'
    };

    return {
      canvasContent,
      framesBtnStyle,
      colorVal,
      weightVal,
      fontVal,
      fontSelect,
      scriptToggle,
      recordControl,
      addMenuStyle,
      setColor: (e) => this.applyStyle({ color: e && e.target ? e.target.value : e }),
      setWeight: (e) => this.applyStyle({ weight: parseInt(e && e.target ? e.target.value : e, 10) || 100 }),
      toggleFrames: () => this.setState(s => ({ showFrames: !s.showFrames })),
      addText: () => this.addTextBlock(),
      toggleAddMenu: () => this.setState(s => ({ addMenuOpen: !s.addMenuOpen })),
      addSample: () => this.addSampleBlock()
    };
  }

  render() {
    const v = this.renderVals();
    const h = React.createElement;
    const st = this.state;
    const hasSel = st.selectedIds.length > 0;

    // -- small building blocks -------------------------------------------------
    const iconBtn = (Comp, label, onClick, opts = {}) => {
      const dis = !!opts.disabled, act = !!opts.active;
      const c = dis ? TOK.inkDim : (opts.danger ? TOK.rec : (act ? TOK.accent : TOK.ink));
      return h('button', {
        key: label, 'aria-label': label, title: label, disabled: dis,
        onClick: dis ? undefined : onClick,
        onMouseEnter: (e) => { if (!dis) e.currentTarget.style.background = TOK.sepSoft; },
        onMouseLeave: (e) => { e.currentTarget.style.background = act ? TOK.accentSoft : 'transparent'; },
        style: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: act ? TOK.accentSoft : 'transparent', border: 'none', borderRadius: R.sm, color: c, cursor: dis ? 'default' : 'pointer', transition: 'background 0.15s' }
      }, h(Comp, { size: 19, color: c, weight: act ? 'fill' : 'regular' }));
    };
    const dockItem = (Comp, label, onClick, opts = {}) => {
      const dis = !!opts.disabled, act = !!opts.active;
      const c = dis ? TOK.inkDim : (act ? TOK.accent : TOK.ink);
      return h('button', {
        key: label, disabled: dis, onClick: dis ? undefined : onClick,
        style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', margin: '0 2px', background: act ? TOK.accentSoft : 'transparent', border: 'none', borderRadius: R.lg, color: c, cursor: dis ? 'default' : 'pointer', transition: 'background 0.15s' }
      },
        h(Comp, { size: 21, color: c, weight: act ? 'fill' : 'regular' }),
        h('span', { style: { fontSize: 11, fontWeight: act ? 600 : 500, letterSpacing: '0.1px' } }, label)
      );
    };

    // -- top app bar (centered, capped width so it never stretches on desktop) -
    const topBar = h('div', {
      style: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 'env(safe-area-inset-top)', display: 'flex', justifyContent: 'center', zIndex: 50, userSelect: 'none', pointerEvents: 'none' }
    },
      h('div', { style: { pointerEvents: 'auto', width: 'calc(100% - 16px)', maxWidth: 680, marginTop: 8, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 0 10px', background: TOK.surface, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${TOK.sep}`, borderRadius: R.xl, boxShadow: '0 1px 2px rgba(28,25,23,0.04),0 6px 22px rgba(28,25,23,0.06)' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
          h('div', { style: { width: 26, height: 26, borderRadius: R.sm, background: TOK.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans SC',sans-serif", fontWeight: 800, fontSize: 15, lineHeight: 1 } }, '聲'),
          h('span', { style: { fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', color: TOK.ink } }, 'Tone Canvas')
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 1 } },
          iconBtn(ArrowCounterClockwise, 'Undo', () => this.undo(), { disabled: !this._undo.length }),
          iconBtn(ArrowClockwise, 'Redo', () => this.redo(), { disabled: !this._redo.length }),
          iconBtn(ShareFat, 'Share', () => this.share(), { disabled: !st.blocks.length }),
          iconBtn(DotsThree, 'More', () => this.openSheet('more'), { active: st.activeSheet === 'more' })
        )
      )
    );

    // -- bottom tool dock (centered, capped width; Motion removed) -------------
    const dock = h('div', {
      style: { position: 'absolute', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 10px)', display: 'flex', justifyContent: 'center', zIndex: 50, userSelect: 'none', pointerEvents: 'none' }
    },
      h('div', { style: { pointerEvents: 'auto', width: 'calc(100% - 24px)', maxWidth: 420, display: 'flex', padding: 6, background: TOK.surface, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${TOK.sep}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(28,25,23,0.04),0 10px 30px rgba(28,25,23,0.08)' } },
        dockItem(TextT, 'Text', () => this.addTextBlock()),
        dockItem(Microphone, 'Dictate', () => this.dictateTap(), { active: st.recording || st.activeSheet === 'dictation' }),
        dockItem(ToneWaveIcon, 'Tone', () => this.openSheet('tone'), { disabled: !hasSel, active: st.activeSheet === 'tone' }),
        dockItem(SlidersHorizontal, 'Style', () => this.openSheet('style'), { disabled: !hasSel, active: st.activeSheet === 'style' })
      )
    );

    // -- empty state -----------------------------------------------------------
    const pill = (Comp, label, onClick) => h('button', {
      key: label, onClick,
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, color: TOK.ink, background: TOK.panel, border: `1px solid ${TOK.sep}`, borderRadius: R.md, boxShadow: '0 1px 2px rgba(28,25,23,0.05)', cursor: 'pointer' }
    }, h(Comp, { size: 17, color: TOK.inkSoft }), label);
    const empty = (!st.blocks.length) ? h('div', {
      style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'none', zIndex: 5 }
    },
      h('div', { style: { fontSize: 16, fontWeight: 500, color: TOK.inkSoft, letterSpacing: '-0.01em' } }, 'Add text to start'),
      h('div', { style: { display: 'flex', gap: 10, pointerEvents: 'auto' } }, pill(TextT, 'Text', () => this.addTextBlock()), pill(Microphone, 'Dictate', () => this.dictateTap()))
    ) : null;

    // -- bottom sheet shell (centered, capped width) ---------------------------
    const sheet = (title, body, onClose) => h('div', { key: 'sheet', style: { position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' } },
      h('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(28,25,23,0.28)', backdropFilter: 'blur(1px)' } }),
      h('div', { style: { position: 'relative', width: '100%', maxWidth: 460, maxHeight: '82vh', overflowY: 'auto', background: TOK.panel, border: `1px solid ${TOK.sep}`, borderBottom: 'none', borderRadius: `${R.sheet}px ${R.sheet}px 0 0`, boxShadow: '0 -8px 40px rgba(28,25,23,0.16)', padding: '8px 18px calc(20px + env(safe-area-inset-bottom))' } },
        h('div', { style: { width: 36, height: 5, borderRadius: 3, background: TOK.sep, margin: '0 auto 12px' } }),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
          h('div', { style: { fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: TOK.ink } }, title),
          h('button', { onClick: onClose, 'aria-label': 'Close', style: { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: R.sm, border: `1px solid ${TOK.sep}`, background: TOK.panel, cursor: 'pointer', color: TOK.inkSoft } }, h(X, { size: 16 }))
        ),
        body
      )
    );

    const activeSheet = this.renderActiveSheet(v, h, sheet);

    // -- toast -----------------------------------------------------------------
    const toast = st.toast ? h('div', { key: 'toast', style: { position: 'fixed', left: '50%', bottom: 'calc(100px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', background: TOK.ink, color: '#fff', fontSize: 13, fontWeight: 500, padding: '9px 15px', borderRadius: R.md, zIndex: 90, boxShadow: '0 8px 24px rgba(28,25,23,0.28)' } }, st.toast) : null;

    return h('div', {
      style: { position: 'fixed', inset: 0, overflow: 'hidden', background: TOK.canvas, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: TOK.ink, WebkitFontSmoothing: 'antialiased' }
    }, v.canvasContent, empty, topBar, dock, activeSheet, toast);
  }

  // ---- sheet bodies ----------------------------------------------------------
  renderActiveSheet(v, h, sheet) {
    const st = this.state;
    switch (st.activeSheet) {
      case 'dictation': return this.sheetDictation(v, h, sheet);
      case 'tone': return this.sheetTone(v, h, sheet);
      case 'style': return this.sheetStyle(v, h, sheet);
      case 'more': return this.sheetMore(v, h, sheet);
      default: return null;
    }
  }

  sectionHeader(h, Comp, text) {
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '4px 0 10px', color: TOK.inkSoft } },
      Comp ? h(Comp, { size: 17, color: TOK.inkSoft }) : null,
      h('span', { style: { fontSize: 12.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' } }, text));
  }

  sheetDictation(v, h, sheet) {
    const st = this.state, rec = st.recording;
    // shadcn-style buttons (shared visual language with the other sheets)
    const btnOutline = (Comp, label, onClick) => h('button', { onClick, style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: R.md, border: `1px solid ${TOK.sep}`, background: TOK.panel, color: TOK.ink, fontWeight: 600, fontSize: 14, cursor: 'pointer' } }, h(Comp, { size: 17 }), label);
    const btnPrimary = (Comp, label, onClick) => h('button', { onClick, style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: R.md, border: 'none', background: TOK.ink, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' } }, h(Comp, { size: 17, weight: 'bold' }), label);

    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      // status card
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '22px 16px', borderRadius: R.lg, border: `1px solid ${TOK.sep}`, background: '#fafaf9' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, color: rec ? TOK.rec : TOK.inkSoft, fontSize: 13.5, fontWeight: 600 } },
          h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: rec ? TOK.rec : TOK.inkDim, animation: rec ? 'tc-pulse 1.2s ease-out infinite' : 'none' } }),
          rec ? (st.recStatus || 'Listening…') : 'Paused'
        ),
        h(Waveform, { size: 38, color: rec ? TOK.ink : TOK.inkDim, weight: 'duotone' }),
        h('div', { style: { fontSize: 12.5, color: TOK.inkSoft, textAlign: 'center' } }, 'Speak Mandarin — text appears on the canvas live.')
      ),
      // pause / resume (secondary, full width)
      h('button', { onClick: () => (rec ? this.stopDictation() : this.startDictation()), style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: R.md, border: `1px solid ${TOK.sep}`, background: '#fafaf9', color: TOK.ink, fontWeight: 600, fontSize: 14, cursor: 'pointer' } },
        h(rec ? Pause : Microphone, { size: 18, weight: 'fill' }), rec ? 'Pause' : 'Resume'),
      // cancel / insert
      h('div', { style: { display: 'flex', gap: 10 } },
        btnOutline(X, 'Cancel', () => this.cancelDictation()),
        btnPrimary(Check, 'Insert', () => this.insertDictation())
      )
    );
    return sheet('Dictate', body, () => this.closeSheet());
  }

  sheetTone(v, h, sheet) {
    const st = this.state;
    const opts = [
      ['hanzi', TextT, 'Hanzi', 'Characters only.'],
      ['hanziSegments', HanziSegmentIcon, 'Hanzi + Segments', 'Characters riding the tone wave.'],
      ['segmentsOnly', ToneSegmentsIcon, 'Segments Only', 'Pure connected tone lines.'],
    ];
    const row = ([val, Comp, title, sub]) => {
      const active = st.canvasMode === val;
      return h('button', {
        key: val,
        onClick: () => this.setCanvasMode(val),
        style: { display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '11px 10px', background: active ? TOK.accentSoft : 'transparent', border: 'none', borderRadius: R.lg, textAlign: 'left', cursor: 'pointer' }
      },
        h('div', { style: { width: 28, display: 'flex', justifyContent: 'center' } }, h(Comp, { size: 25, color: active ? TOK.accent : TOK.ink })),
        h('div', { style: { flex: 1 } },
          h('div', { style: { fontSize: 14.5, fontWeight: 600, color: TOK.ink } }, title),
          h('div', { style: { fontSize: 12.5, color: TOK.inkSoft, marginTop: 1 } }, sub)
        ),
        active ? h(Check, { size: 18, weight: 'bold', color: TOK.accent }) : null
      );
    };
    return sheet('Tone Mode', h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } }, opts.map(row)), () => this.closeSheet());
  }

  sheetStyle(v, h, sheet) {
    const st = this.state;
    // Color
    const chip = (col) => {
      const sel = (v.colorVal || '').toLowerCase() === col.toLowerCase();
      return h('button', { key: col, onClick: () => this.applyStyle({ color: col }), 'aria-label': col,
        style: { width: 30, height: 30, borderRadius: '50%', background: col, cursor: 'pointer', flex: '0 0 auto', border: col.toLowerCase() === '#ffffff' ? `1px solid ${TOK.sep}` : 'none', outline: sel ? `2px solid ${TOK.accent}` : 'none', outlineOffset: 2, transform: sel ? 'scale(1.08)' : 'none', transition: 'transform 0.12s' } });
    };
    const colorRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
      COLOR_CHIPS.map(chip),
      h('label', { title: 'Custom color', style: { width: 30, height: 30, borderRadius: '50%', border: `1px dashed ${TOK.inkDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', color: TOK.inkSoft } },
        h(Palette, { size: 15, color: TOK.inkSoft }),
        h('input', { type: 'color', value: v.colorVal, onInput: v.setColor, onChange: v.setColor, style: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' } })
      )
    );
    // Weight
    const weightRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      h('input', { type: 'range', min: 100, max: 900, step: 10, value: v.weightVal, onInput: v.setWeight, onChange: v.setWeight, style: { flex: 1, accentColor: TOK.ink, height: 28 } }),
      h('span', { style: { width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: TOK.ink } }, v.weightVal)
    );
    // Font (horizontal preview row)
    const fontCell = (f) => {
      const sel = v.fontVal === f.id;
      return h('button', { key: f.id, onClick: () => this.applyStyle({ font: f.id }), title: f.label,
        style: { flex: '0 0 auto', minWidth: 64, padding: '8px 12px', borderRadius: R.md, border: `1px solid ${sel ? TOK.accent : TOK.sep}`, background: sel ? TOK.accentSoft : TOK.panel, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 } },
        h('span', { style: { fontSize: 22, lineHeight: 1, color: TOK.ink, fontFamily: this.fontStack(f.id, st.script) } }, '字'),
        h('span', { style: { fontSize: 10.5, color: sel ? TOK.accent : TOK.inkSoft, fontWeight: 600, whiteSpace: 'nowrap' } }, f.label.split(' · ')[0])
      );
    };
    const fontRow = h('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 } }, App.FONTS.map(fontCell));
    // Script
    const seg = (label, val) => {
      const active = st.script === val;
      return h('button', { key: val, onClick: () => this.setState({ script: val }),
        style: { flex: 1, padding: '9px 0', fontSize: 16, fontWeight: 700, fontFamily: "'Noto Sans SC','Noto Sans TC',sans-serif", borderRadius: 8, border: 'none', cursor: 'pointer', color: active ? '#fff' : TOK.inkSoft, background: active ? TOK.ink : 'transparent' } }, label);
    };
    const scriptRow = h('div', { style: { display: 'flex', gap: 3, padding: 3, background: 'rgba(20,18,12,0.06)', borderRadius: 11 } }, seg('简 Simplified', 'simplified'), seg('繁 Traditional', 'traditional'));
    // Size (font-size presets — scales the whole block)
    const selBlk = st.blocks.find(b => st.selectedIds.includes(b.id));
    const curScale = selBlk ? (selBlk.scale || 1) : 1;
    const sizes = [['S', 0.6], ['M', 1], ['L', 1.6], ['XL', 2.4]];
    const nearest = sizes.reduce((a, b) => Math.abs(b[1] - curScale) < Math.abs(a[1] - curScale) ? b : a, sizes[1]);
    const sizeSeg = (s) => h('button', { key: s[0], onClick: () => this.applyScaleSelected(s[1]),
      style: { flex: 1, padding: '9px 0', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', color: nearest[0] === s[0] ? '#fff' : TOK.inkSoft, background: nearest[0] === s[0] ? TOK.ink : 'transparent' } }, s[0]);
    const sizeRow = h('div', { style: { display: 'flex', gap: 3, padding: 3, background: 'rgba(28,25,23,0.06)', borderRadius: 11 } }, sizes.map(sizeSeg));

    const body = h('div', { style: { display: 'flex', flexDirection: 'column' } },
      this.sectionHeader(h, TextAa, 'Size'), sizeRow,
      h('div', { style: { height: 18 } }),
      this.sectionHeader(h, Palette, 'Color'), colorRow,
      h('div', { style: { height: 18 } }),
      this.sectionHeader(h, SlidersHorizontal, 'Weight'), weightRow,
      h('div', { style: { height: 18 } }),
      this.sectionHeader(h, TextAa, 'Font'), fontRow,
      h('div', { style: { height: 18 } }),
      this.sectionHeader(h, null, 'Script'), scriptRow
    );
    return sheet('Style', body, () => this.closeSheet());
  }

  sheetMore(v, h, sheet) {
    const st = this.state;
    const toggleRow = (Comp, label, on, onClick) => h('button', { key: label, onClick,
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 6px', background: 'none', border: 'none', cursor: 'pointer' } },
      h('span', { style: { display: 'flex', alignItems: 'center', gap: 11, color: TOK.ink, fontWeight: 500, fontSize: 15.5 } }, h(Comp, { size: 20, color: TOK.ink }), label),
      h('span', { style: { width: 42, height: 26, borderRadius: 13, background: on ? TOK.accent : 'rgba(20,18,12,0.15)', position: 'relative' } },
        h('span', { style: { position: 'absolute', top: 3, left: on ? 19 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } }))
    );
    const actionRow = (Comp, label, onClick, danger) => h('button', { key: label, onClick,
      style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '13px 6px', background: 'none', border: 'none', cursor: 'pointer', color: danger ? TOK.rec : TOK.ink, fontWeight: 500, fontSize: 15.5 } },
      h(Comp, { size: 20, color: danger ? TOK.rec : TOK.ink }), label);
    const body = h('div', null,
      toggleRow(ToneFrameIcon, 'Tone Frames', st.showFrames, () => this.setState(s => ({ showFrames: !s.showFrames }))),
      toggleRow(EdgeJointsIcon, 'Edge Joints', st.showEdgeJoints, () => this.toggleEdgeJoints()),
      h('div', { style: { height: 1, background: TOK.sep, margin: '6px 0' } }),
      actionRow(Trash, 'Reset Canvas', () => { if (typeof window !== 'undefined' && window.confirm('Clear the whole canvas?')) this.resetCanvas(); }, true),
      actionRow(Info, 'About', () => this.flash('Tone Canvas · Mandarin tone typography'))
    );
    return sheet('More', body, () => this.closeSheet());
  }

}
