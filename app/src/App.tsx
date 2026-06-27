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
    // per-block colour + variable-font weight
    const MB = {
      ...M,
      weight: block.weight != null ? block.weight : M.weight,
      fontFamily: this.fontStack(block.font || this.state.defFont, this.state.script)
    };
    const faceFill = block.color || '#161410';
    const lay = this.layoutBlock(this.glyphsText(block.text), MB, block.width);
    const { bbox, specs } = lay;
    const defs = [], faces = [], frames = [];
    specs.forEach(s => {
      const id = `g-${block.id}-${s.line}-${s.key}`;
      if (s.kind === 'fold') this.foldClips(s, id, MB).forEach(d => defs.push(d));
      faces.push(this.glyphFace(s, faceFill, 1, null, MB, id + '-f', id));
      if (this.state.showFrames) this.debugFrame(s, id, MB).forEach(f => frames.push(f));
    });
    return React.createElement('svg', {
      width: bbox.w, height: bbox.h, viewBox: `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`,
      style: { display: 'block', overflow: 'visible', pointerEvents: 'none' }
    },
      React.createElement('defs', { key: 'defs' }, defs),
      React.createElement('g', { key: 'fc' }, faces),
      frames.length ? React.createElement('g', { key: 'fr' }, frames) : null
    ) ;
  }

  /* ===================================================================
   *  Canvas state + interaction
   * =================================================================== */
  state = {
    blocks: [
      { id: 1, x: 150, y: 250, text: '今天我想学习中文声调，\n它像一条隐藏的旋律。' },
      { id: 2, x: 250, y: 620, text: '设计声调像一条波浪' }
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
    recStatus: ''            // short status line shown on the record chip
  };
  _nextId = 3;
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
    const { bbox } = this.layoutBlock(this.glyphsText(b.text), M, b.width);
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
    this._act = { type: 'maybe-marquee', sx: e.clientX, sy: e.clientY, add: e.shiftKey, base: e.shiftKey ? this.state.selectedIds.slice() : [], moved: false };
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
    } else {
      a.type = 'drag';
      const z = this.state.zoom, wdx = dx / z, wdy = dy / z;
      this.setState(s => ({ blocks: s.blocks.map(b => a.origins[b.id] ? { ...b, x: a.origins[b.id].x + wdx, y: a.origins[b.id].y + wdy } : b) }));
    }
  }
  onUp(e) {
    const a = this._act; this._act = null; if (!a) return;
    if (a.type === 'maybe-marquee') {
      // plain click on empty canvas -> just clears selection (already done on down).
      // Text blocks are created via the "+ Add Text" button, not by clicking.
    } else if (a.type === 'marquee') {
      this.setState({ marquee: null });
    } else if ((a.type === 'drag' || a.type === 'resize') && a.moved) {
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
    this._act = { type: 'pan', sx: t.clientX, sy: t.clientY, px: this.state.panX, py: this.state.panY, moved: false };
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
    if (e.touches.length >= 2) {                          // pinch zoom + two-finger pan
      e.preventDefault();
      this._act = null;
      const a = e.touches[0], b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
      if (!this._pinch) { this._pinch = { dist, cx, cy }; return; }
      if (this._pinch.dist > 0) this.zoomBy(dist / this._pinch.dist, cx, cy);
      const ddx = cx - this._pinch.cx, ddy = cy - this._pinch.cy;
      if (ddx || ddy) this.setState(s => ({ panX: s.panX + ddx, panY: s.panY + ddy }));
      this._pinch = { dist, cx, cy };
      return;
    }
    if (this._pinch) return;                              // wait for all fingers up after a pinch
    if (this._act) { e.preventDefault(); const t = e.touches[0]; this.onMove({ clientX: t.clientX, clientY: t.clientY }); }
  }
  onTouchEnd(e) {
    if (e.touches.length >= 1) { this._pinch = null; this._act = null; return; }  // pinch -> fewer fingers: reset
    this._pinch = null;
    const a = this._act;
    if (a && a.type === 'pan' && !a.moved) this.setState({ selectedIds: [] });    // tap empty space -> deselect
    this.onUp({});
  }
  finishEdit(id) {
    // While dictating into this block, just leave the textarea — keep the block
    // alive (even if momentarily empty) so incoming speech still has a target.
    if (this.state.recording && id === this._recBlockId) {
      this.setState(s => ({ editingId: s.editingId === id ? null : s.editingId }));
      return;
    }
    this.setState(s => {
      const b = s.blocks.find(b => b.id === id);
      const empty = !b || !b.text || !b.text.trim();
      return {
        editingId: s.editingId === id ? null : s.editingId,
        blocks: empty ? s.blocks.filter(b => b.id !== id) : s.blocks,
        selectedIds: empty ? s.selectedIds.filter(x => x !== id) : s.selectedIds
      };
    });
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
    const lay = this.layoutBlock(this.glyphsText(block.text), M, block.width);
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
      const corner = (s) => React.createElement('div', { key: 'c' + s.left + s.top, style: { position: 'absolute', width: '9px', height: '9px', background: '#fff', border: '1.5px solid #2f6bff', borderRadius: '2px', ...s } });
      children.push(corner({ left: '-6px', top: '-6px' }));
      children.push(corner({ right: '-6px', top: '-6px' }));
      children.push(corner({ left: '-6px', bottom: '-6px' }));
      children.push(corner({ right: '-6px', bottom: '-6px' }));
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
      children.push(React.createElement('div', {
        key: 'tb', style: {
          position: 'absolute', left: '50%', top: '-40px', transform: 'translateX(-50%)',
          display: 'flex', gap: '2px', padding: '4px', background: '#fff',
          border: '1px solid rgba(20,18,12,0.10)', borderRadius: '9px',
          boxShadow: '0 6px 20px rgba(20,18,12,0.14)', pointerEvents: 'auto', whiteSpace: 'nowrap'
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
    const divider = (k) => h('div', { key: 'd' + k, style: { width: 1, height: 22, background: 'rgba(20,18,12,0.10)', margin: '0 2px', flex: '0 0 auto' } });
    const lbl = (t) => h('span', { style: { fontSize: '12.5px', fontWeight: 600, color: '#5b5648', whiteSpace: 'nowrap' } }, t);
    const toolbar = h('div', {
      className: 'tc-bar',
      style: {
        position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(20,18,12,0.08)', borderRadius: 14,
        boxShadow: '0 8px 30px rgba(20,18,12,0.10),0 1px 2px rgba(20,18,12,0.06)', zIndex: 50, userSelect: 'none'
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px 0 4px' } },
        h('span', { style: { fontSize: 22, fontWeight: 900, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1, letterSpacing: '-1px' } }, '聲'),
        h('span', { style: { fontSize: 13, fontWeight: 600, letterSpacing: '-0.2px', color: '#211e16', whiteSpace: 'nowrap' } }, 'Tone Canvas')
      ),
      divider(1),
      h('label', { title: 'Text color', style: { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', cursor: 'pointer' } },
        lbl('Color'),
        h('input', { type: 'color', value: v.colorVal, onInput: v.setColor, onChange: v.setColor, style: { width: 24, height: 24, border: '1px solid rgba(20,18,12,0.12)', borderRadius: 7, background: 'none', cursor: 'pointer', padding: 0 } })
      ),
      divider(2),
      h('div', { title: 'Font weight', style: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' } },
        lbl('Weight'),
        h('input', { type: 'range', min: 100, max: 900, step: 10, value: v.weightVal, onInput: v.setWeight, onChange: v.setWeight, style: { width: 88, cursor: 'pointer', accentColor: '#1c1a14' } }),
        h('span', { style: { fontSize: '11.5px', fontWeight: 700, color: '#211e16', width: 26, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, v.weightVal)
      ),
      divider(3),
      h('div', { title: 'Typeface', style: { display: 'flex', alignItems: 'center', gap: 7, padding: '0 4px' } }, lbl('Font'), v.fontSelect),
      divider(4),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' } }, v.scriptToggle),
      divider(5),
      v.recordControl,
      divider(6),
      h('button', { onClick: v.toggleFrames, style: v.framesBtnStyle },
        h('span', { style: { fontSize: 13, lineHeight: 1 } }, '◇'), ' Tone frames'),
      divider(7),
      h('div', { id: 'tc-add', style: { position: 'relative', display: 'flex', alignItems: 'stretch' } },
        h('button', { onClick: v.addText, style: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: '12.5px', fontWeight: 700, color: '#fff', background: '#1c1a14', border: 'none', borderRadius: '8px 0 0 8px', whiteSpace: 'nowrap' } },
          h('span', { style: { fontSize: 14, lineHeight: 1 } }, '+'), ' Add Text'),
        h('button', { onClick: v.toggleAddMenu, title: 'More', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, padding: 0, fontSize: 10, color: '#fff', background: '#1c1a14', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.18)', borderRadius: '0 8px 8px 0' } }, '▾'),
        h('div', { style: v.addMenuStyle },
          h('button', { onClick: v.addSample, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', padding: '8px 11px', fontSize: '12.5px', fontWeight: 600, color: '#211e16', background: 'transparent', border: 'none', borderRadius: 8, textAlign: 'left' } },
            h('span', null, 'Sample Text'),
            h('span', { style: { fontSize: '10.5px', fontWeight: 500, color: '#8a8674' } }, 'Add a random tone fun-fact')
          )
        )
      )
    );
    const hintItem = (b, rest) => h('span', null, h('b', { style: { color: '#2f2a1f', fontWeight: 700 } }, b), rest);
    const sep = (k) => h('span', { key: 's' + k, style: { opacity: 0.4 } }, '·');
    const hint = h('div', {
      className: 'tc-hint',
      style: {
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 14, padding: '7px 15px',
        background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(20,18,12,0.06)', borderRadius: 11, fontSize: '11.5px',
        color: '#6c685c', fontWeight: 500, letterSpacing: '0.1px', zIndex: 40, userSelect: 'none', whiteSpace: 'nowrap'
      }
    },
      hintItem('+ Add Text', ' to start'), sep(1),
      hintItem('Double-click', ' to edit'), sep(2),
      hintItem('Drag', ' to move'), sep(3),
      hintItem('⌫', ' delete'), sep(4),
      hintItem('⌘D', ' duplicate')
    );
    return h('div', {
      style: { position: 'fixed', inset: 0, overflow: 'hidden', background: '#f3f1ec', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: '#17150f', WebkitFontSmoothing: 'antialiased' }
    }, v.canvasContent, toolbar, hint);
  }

}
