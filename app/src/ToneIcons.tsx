// Custom tone-line icons for Tone Canvas, drawn in the Phosphor language:
// 24-unit canvas, ~2pt round strokes, generous negative space. Functional SVG
// components so they inherit size/color and match @phosphor-icons/react usage.
import React from 'react';

type IconProps = { size?: number; color?: string; weight?: string; className?: string; style?: React.CSSProperties };

function svg(children: React.ReactNode, { size = 24, color = 'currentColor', style }: IconProps) {
  return React.createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style },
    children
  );
}

// Tone Mode — connected tone wave: rise · flat · fold(V) · fall
export const ToneWaveIcon = (p: IconProps) =>
  svg(React.createElement('polyline', { key: 'l', points: '3,16 8,9 12,9 15,15 18,9 21,16' }), p);

// Hanzi + Segments — a character cell riding its tone segment
export const HanziSegmentIcon = (p: IconProps) =>
  svg([
    React.createElement('rect', { key: 'r', x: 7, y: 4, width: 10, height: 10, rx: 2 }),
    React.createElement('line', { key: 'b', x1: 9, y1: 9, x2: 15, y2: 9 }),
    React.createElement('line', { key: 's', x1: 4, y1: 19, x2: 20, y2: 16 }),
  ], p);

// Segments Only — pure connected tone line + edge-joint dots
export const ToneSegmentsIcon = (p: IconProps) =>
  svg([
    React.createElement('polyline', { key: 'l', points: '4,17 10,8 14,14 20,8' }),
    React.createElement('circle', { key: 'a', cx: 4, cy: 17, r: 1.4, fill: p.color || 'currentColor', stroke: 'none' }),
    React.createElement('circle', { key: 'b', cx: 20, cy: 8, r: 1.4, fill: p.color || 'currentColor', stroke: 'none' }),
  ], p);

// Tone Frames — the skewed parallelogram advance cell
export const ToneFrameIcon = (p: IconProps) =>
  svg(React.createElement('polygon', { key: 'p', points: '5,18 9,6 21,6 17,18' }), p);

// Edge Joints — two segments meeting at a shared seam dot
export const EdgeJointsIcon = (p: IconProps) =>
  svg([
    React.createElement('polyline', { key: 'l', points: '3,16 12,10 21,16' }),
    React.createElement('circle', { key: 'd', cx: 12, cy: 10, r: 2.2, fill: p.color || 'currentColor', stroke: 'none' }),
  ], p);
