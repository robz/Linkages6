import {distance} from './geometry.js';

const svgNS = 'http://www.w3.org/2000/svg';

const c = 0.25; //0.3; // curf
const s = 0.5; // 0.4; // spacer margin

const round = x => Math.round(x * 1000) / 1000;

const addCircle = (svg, cx, cy, r, stroke = 'black', fill = 'none') => {
  const el = document.createElementNS(svgNS, 'circle');
  el.setAttribute('cx', `${cx}`);
  el.setAttribute('cy', `${cy}`);
  el.setAttribute('r', `${r}`);
  el.setAttribute('stroke', stroke);
  el.setAttribute('fill', fill);
  svg.appendChild(el);
};

const addPolygon = (svg, tx = 0, ty = 0, points) => {
  const el = document.createElementNS(svgNS, 'polygon');
  const pointStr = points
    .map(([x, y]) => `${round(x + tx)},${round(-y + ty)}`)
    .join(' ');
  el.setAttribute('points', pointStr);
  el.setAttribute('stroke', 'black');
  el.setAttribute('fill', 'none');
  svg.appendChild(el);
};

function drawCap(svg, tx, ty, {outterDiam, materialThickness}) {
  const r = outterDiam / 2;
  addCircle(svg, tx, ty, r);

  const w = (materialThickness - c) / 2;
  const h = (3 * materialThickness - c) / 2;
  const pts = [
    [w, h],
    [w, w],
    [h, w],
    [h, -w],
    [w, -w],
    [w, -h],
    [-w, -h],
    [-w, -w],
    [-h, -w],
    [-h, w],
    [-w, w],
    [-w, h],
  ];
  addPolygon(svg, tx, ty, pts, 'red');
}

function drawSpacer(svg, tx, ty, {outterDiam, innerDiam}) {
  addCircle(svg, tx, ty, outterDiam / 2);
  addCircle(svg, tx, ty, (innerDiam + s - c) / 2, 'red');
}

function drawAxel(svg, tx, ty, numLayers, {materialThickness}) {
  const w = (3 * materialThickness + c) / 2;
  const h = (numLayers * 3 * materialThickness + c) / 2;
  const wi = (materialThickness - c) / 2;
  const hi = h - c/2;
  //const hi = 3 * materialThickness;

  const pts = [
    [w, h],
    [w, -h],
    [-w, -h],
    [-w, h],
    [-wi, h],
    [-wi, h - hi],
    [wi, h - hi],
    [wi, h],
  ];
  addPolygon(svg, tx, ty + h, pts);
}

function addRoundedPolygon(svg, points, radius) {
  if (points.length < 3) {
    throw new Error('A polygon requires at least 3 points.');
  }

  const svgNS = 'http://www.w3.org/2000/svg';

  const path = document.createElementNS(svgNS, 'path');

  const len = points.length;
  let d = '';

  function getVector(a, b) {
    return {x: b.x - a.x, y: b.y - a.y};
  }

  function normalize(vec) {
    const len = Math.hypot(vec.x, vec.y);
    return {x: vec.x / len, y: vec.y / len};
  }

  function scale(vec, scale) {
    return {x: vec.x * scale, y: vec.y * scale};
  }

  function add(p1, p2) {
    return {x: p1.x + p2.x, y: p1.y + p2.y};
  }

  function subtract(p1, p2) {
    return {x: p1.x - p2.x, y: p1.y - p2.y};
  }

  function innerAngle(p0, p1, p2) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const len0 = 40 * d(p0, p1);
    const len1 = 40 * d(p1, p2);
    const len2 = 40 * d(p0, p2);
    return Math.acos((len2 ** 2 - len0 ** 2 - len1 ** 2) / (-2 * len0 * len1));
  }

  for (let i = 0; i < len; i++) {
    const prev = points[(i - 1 + len) % len];
    const curr = points[i];
    const next = points[(i + 1) % len];

    const a = innerAngle(prev, curr, next);
    const x = radius * Math.tan((Math.PI - a) / 2);

    let v1 = normalize(getVector(curr, next));
    v1 = {x: v1.y, y: -v1.x};
    const offset1 = scale(v1, radius / 2);
    let p1 = add(curr, offset1);

    let v2 = normalize(getVector(curr, prev));
    v2 = {x: -v2.y, y: v2.x};
    const offset2 = scale(v2, radius / 2);
    let p2 = add(curr, offset2);

    if (i === 0) {
      d += `M ${p2.x} ${p2.y} `;
    } else {
      d += `L ${p2.x} ${p2.y} `;
    }

    // Use an arc to simulate the rounded corner
    d += `A ${radius / 2} ${radius / 2} 0 0 1 ${p1.x} ${p1.y} `;
  }

  d += 'Z';

  path.setAttribute('d', d);
  path.setAttribute('stroke', 'black');
  path.setAttribute('fill', 'none');

  svg.appendChild(path);
}

const drawTriangle = (svg, tx, ty, p0, p1, p2, {innerDiam, outterDiam}) => {
  const len0 = 40 * distance(p0, p1);
  const len1 = 40 * distance(p1, p2);
  const len2 = 40 * distance(p0, p2);
  const angle = Math.acos(
    (len2 ** 2 - len0 ** 2 - len1 ** 2) / (-2 * len0 * len1),
  );

  // 1. Triangle vertices
  p0 = {x: tx, y: ty}; // start point
  p1 = {x: tx + len0, y: ty}; // point along X
  p2 = {x: tx + Math.cos(angle) * len1, y: ty + Math.sin(angle) * len1}; // rotated point

  addRoundedPolygon(svg, [p0, p1, p2], outterDiam);

  // 3. Add inner circles (center of each side of the triangle shell)
  const r2 = (innerDiam + s) / 2;

  addCircle(svg, p0.x, p0.y, r2, 'red');
  addCircle(svg, p1.x, p1.y, r2, 'red');
  addCircle(svg, p2.x, p2.y, r2, 'red');

  return Math.sin(angle) * len1;
};

const drawLink = (svg, tx, ty, length, {innerDiam, outterDiam}) => {
  const height = outterDiam;

  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', tx - height / 2);
  rect.setAttribute('y', ty - height / 2);
  rect.setAttribute('rx', height / 2);
  rect.setAttribute('width', length + height);
  rect.setAttribute('height', height);
  rect.setAttribute('stroke', 'black');
  rect.setAttribute('fill', 'none');
  svg.appendChild(rect);

  addCircle(svg, tx, ty, (innerDiam + s) / 2, 'red');
  addCircle(svg, tx + length, ty, (innerDiam + s) / 2, 'red');
};

const toMM = x => (x / 96) * 25.4; // dpi=96 and mm/inch=25.4

export function initSVG() {
  let svg = document.getElementById('svgCanvas');
  const w = toMM(window.innerWidth);
  const h = toMM(window.innerHeight);

  // scale to mm at the svg element in order to handle polygons
  svg.setAttribute('width', w + 'mm');
  svg.setAttribute('height', h + 'mm');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  return svg;
}

export function drawSVG(
  svg,
  linkage,
  computedPoints,
  plateInfo,
  materialThickness = 3.5,
) {
  const innerDiam = materialThickness * Math.sqrt(10);
  const outterDiam = 2 * materialThickness + innerDiam;
  const params = {materialThickness, innerDiam, outterDiam};

  svg.innerHTML = ''; // Clear previous drawings

  let x = 10;
  let y = 10;

  const space = outterDiam + materialThickness;
  let planesPerPoint = new Map();
  const addPoints = (ps, plane) => {
    for (const p of ps) {
      planesPerPoint.set(p, (planesPerPoint.get(p) ?? new Set()).add(ps));
    }
  };

  for (const plane of plateInfo.planes) {
    for (const plate of plane) {
      if (plate.triangles.length > 0) {
        for (const [p0, p1, p2] of plate.triangles) {
          addPoints([p0, p1, p2], plane);
          const h = drawTriangle(
            svg,
            x,
            y,
            typeof p0 === 'string' ? computedPoints[p0] : p0,
            typeof p1 === 'string' ? computedPoints[p1] : p1,
            typeof p2 === 'string' ? computedPoints[p2] : p2,
            params,
          );
          y += space + h;
        }
      } else {
        for (const [p0, p1] of plate.segments) {
          addPoints([p0, p1], plane);
          const length = distance(
            typeof p0 === 'string' ? computedPoints[p0] : p0,
            typeof p1 === 'string' ? computedPoints[p1] : p1,
          );
          drawLink(svg, x, y, length * 40, params);
          y += space;
        }
      }
    }
  }

  let i = 0;
  for (const [_, planes] of planesPerPoint.entries()) {
    const numLayers = planes.size;
    console.log(numLayers);
    if (numLayers === 1) {
      continue;
    }
    for (let j = 0; j < 2; j++) {
      drawCap(svg, i * space + x, 0 + y, params);
      for (let k = 0; k < numLayers - 1; k++) {
        drawSpacer(svg, i * space + x, (k + 1) * space + y, params);
      }
      drawAxel(svg, i * space + x, numLayers * space + y - outterDiam/2, numLayers, params);
      i += 1;
    }
  }
}
