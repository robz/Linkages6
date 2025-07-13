import {distance} from './geometry.js';

const svgNS = 'http://www.w3.org/2000/svg';

const m = 3; // material_thickness
const c = 0.3; //0.3; // curf
const s = .5; // 0.4; // spacer margin

const innerDiam = m * Math.sqrt(10);
const outterDiam = 2 * m + innerDiam;

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

const addPolygon = (
  svg,
  tx = 0,
  ty = 0,
  points,
  stroke = 'black',
  fill = 'none',
) => {
  const el = document.createElementNS(svgNS, 'polygon');
  const pointStr = points
    .map(([x, y]) => `${round(x + tx)},${round(-y + ty)}`)
    .join(' ');
  el.setAttribute('points', pointStr);
  el.setAttribute('stroke', stroke);
  el.setAttribute('fill', fill);
  svg.appendChild(el);
};

function drawCap(svg, tx, ty) {
  const r = outterDiam / 2;
  addCircle(svg, tx, ty, r);

  const w = (m - c) / 2;
  const h = (3 * m - c) / 2;
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

function drawSpacer(svg, tx, ty) {
  addCircle(svg, tx, ty, outterDiam / 2);
  addCircle(svg, tx, ty, (innerDiam + s) / 2, 'red');
}

function drawAxel(svg, tx, ty) {
  const w = (3 * m + c) / 2;
  const h = (6 * m + c) / 2;
  const wi = (m - c) / 2;
  const hi = 3 * m;

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
  addPolygon(svg, tx, ty, pts);
}

const drawLink = (svg, tx, ty, length) => {
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
  svg.style.display = 'none';
  return svg;
}

export function drawSVG(svg, linkage, computedPoints, plateInfo) {
  svg.innerHTML = ''; // Clear previous drawings

  let x = 10;
  let y = 10;

  const space = outterDiam+m;
  let numLinks = 0;
  for (const plane of plateInfo.planes) {
    for (const plate of plane) {
      for (const [p0, p1] of plate.segments) {
        const length = distance(
          typeof p0 === 'string' ? computedPoints[p0] : p0,
          typeof p1 === 'string' ? computedPoints[p1] : p1,
        );
        drawLink(svg, x, y, length * 40);
        y += space;
        numLinks += 1;
      }
    }
  }

  for (let i = 0; i < numLinks * 2; i++) {
    drawCap(svg, i * space + x, 0 + y);
    drawSpacer(svg, i * space + x, space + y);
    drawAxel(svg, i * space + x, 7*m + space + y);
  }
}
