import {updateState} from './state.js';
import {
    findNearestLink,
    findNearestPoint,
    computePoints,
    computeTraces,
    browserToLinkCoords,
    linkToBrowserCoords,
    translateTransform,
    scaleTransform,
    rotateTransform,
    transposeTraces,
} from './geometry.js';
import {
    initCanvas, 
    drawState,
    drawTraces,
    RADIUS,
    drawParams,
    removeLengths,
    drawPlates,
    drawLinkage,
    drawSVG,
    drawStaticSVG,
    initSVG,
} from './draw.js';
import {
    movePoint,
    getSegments,
    getPointRefs,
    setLinkLength,
    setGroundPoint,
    computePlanes,
} from './linkage.js';

// Initialize last point clicked and hover point
let state = {type: 'init'};
let hoverPoint = null;
let hoverLink = null;
let theta = 0;
let isPaused = false;
let speed = 1;
let showLengths = false;
let showSVG = false;
const {ctx, canvas} = initCanvas();
const svg = initSVG();

// transform to zoom/rotate canvas
const transform = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];
const minDim = Math.min(canvas.width, canvas.height);
scaleTransform(transform, minDim/10, -minDim/10);
translateTransform(transform, canvas.width/2, canvas.height/2);

const urlLinkage = new URLSearchParams(location.search).get('linkage');
let linkage = urlLinkage != null ? JSON.parse(urlLinkage) : {
    n: 3,
    params: {p0: {x: 0, y: 0}, len2: 1, theta2: 0},
    links: [{type: 'rotary', p0: 'p0', p1: 'p1', len: 'len2', theta: 'theta2'}],
};
let computedPoints = computePoints(linkage, theta);

let showTraces = false;
let traces = null;
let showPlates = false;
let plateInfo = null;
function updateDerivedState() {
    if (showTraces || showPlates || showSVG) {
        traces = computeTraces(linkage);
    }
    if (showPlates || showSVG) {
        plateInfo = computePlanes(linkage, transposeTraces(linkage, traces));
    }
}

// Click and drag a point
canvas.addEventListener('mousedown', (event) => {
    if (state.type !== 'init') {
        return;
    }
    const op = {x: event.clientX, y: event.clientY};
    const p = browserToLinkCoords(transform, op);
    const pointRefs = getPointRefs(linkage);
    const nearestPointRef = findNearestPoint(pointRefs, computedPoints, p, RADIUS)?.[0];
    if (nearestPointRef) {
        state = {type: 'dragging', pRef: nearestPointRef, dragged: false};
    } else {
        state = {type: 'dragging-bg', p0: op, p1: op, dragged: false};
    }
});

function getRotation({x, y}) {
    x = x - canvas.width / 2;
    y = canvas.height / 2 - y;
    return -Math.atan2(y, x);
}

function computeHovers(p) {
    const pointRefs = getPointRefs(linkage);
    const nearestPointRef = findNearestPoint(pointRefs, computedPoints, p, RADIUS)?.[0];
    hoverPoint = nearestPointRef ?? p;
    if (nearestPointRef == null) {
        hoverLink = findNearestLink(getSegments(linkage), computedPoints, p, RADIUS);
    } else {
        hoverLink = null;
    }
}

// Draw a line from the last clicked point to the current mouse position
canvas.addEventListener('mousemove', (event) => {
    const op = {x: event.clientX, y: event.clientY};
    const p = browserToLinkCoords(transform, op);
    if (state.type === 'dragging') {
        state.dragged = true;
        movePoint(linkage, computedPoints, theta, state.pRef, p);
        updateDerivedState();
    } else if (state.type === 'dragging-bg') {
        state.dragged = true;
        translateTransform(transform, op.x - state.p1.x, op.y - state.p1.y);
        state.p1 = op;
    } else if (state.type === 'rotating') {
        const theta = getRotation(op);
        if (state.theta != null) {
            const dTheta = theta - state.theta;
            translateTransform(transform, -canvas.width/2, -canvas.height/2);
            rotateTransform(transform, dTheta);
            translateTransform(transform, canvas.width/2, canvas.height/2);
        } else {
            state.theta0 = theta;
        }
        state.theta = theta;
    } else {
        computeHovers(p);
    }
});

// Clicking the canvas draws a small black circle there, and then a line to where the mouse is hovering over
canvas.addEventListener('click', (event) => {
    if (state.type === 'rotating') {
        state = {
            type: 'init', 
        };
        return;
    } else if (state.type === 'dragging' || state.type === 'dragging-bg') {
        const {dragged} = state;
        state = {type: 'init'};
        if (dragged) {
            // don't make a new link if we're dragging
            return;
        }
    }
    if (hoverPoint == null) {
        return;
    }

    let action = {type: 'g', p0: hoverPoint};
    if (typeof hoverPoint === 'string') {
        action = {type: 'p', p0: hoverPoint};
    } else if (hoverLink != null && (state.type === 'g' || state.type === 'init')) {
        action = {type: 'pp', p0: hoverLink[0], p1: hoverLink[1]};
    }
    
    state = updateState(state, action, linkage, computedPoints);
    updateDerivedState();
    computedPoints = computePoints(linkage, theta);
    computeHovers(browserToLinkCoords(transform, {x: event.clientX, y: event.clientY}));
}); 

function downloadSVG() {
    console.log('hi?');
    const filename = 'linkage.svg';
    const svg = document.getElementById("svgCanvas");

    // Get the SVG XML as a string
    const svgData = new XMLSerializer().serializeToString(svg);

    // Create a Blob and an Object URL
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    // Create a temporary <a> element to trigger the download
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Hits esc resets the state
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        // Hit Backspace or Escape to reset the state
        case 'Backspace':
        case 'Escape':
            state = {type: 'init'};
            break;
        // Hit c to change direction
        case 'c':
            speed *= -1;
            break;
        // Hit d to delete a link
        case 'd':
            if (showSVG) {
                downloadSVG();
            } else if (state.type === 'init') {
                state = updateState(state, {type: 'd', p0: hoverPoint}, linkage, computedPoints);
                hoverPoint = null;
                updateDerivedState();
            } 
            break;
        // Hit i to add a slider link
        case 'i': {
            state = {type: 'slider'};
            break;
        }
        // Hold down r to add another rotary link
        case 'r':
            state = {type: 'r'};
            break;
        // Hit s to save to URL
        case 's': 
            location.search = new URLSearchParams({linkage: JSON.stringify(linkage)}).toString();
            break;
        // Hold down Shift to rotate the canvas
        case 'Shift': {
            state = {
                type: 'rotating',
                theta: null,
                theta0: null,
            };
            break;
        }
        // Hit space to toggle pause
        case ' ':
            isPaused = !isPaused;
            break;
        // Hit t to toggle traces
        case 't':
            showTraces = !showTraces;
            updateDerivedState();
            break;
      case 'v':
          showSVG = !showSVG;
          if (showSVG) {
              updateDerivedState();

              // hide the canvas
              canvas.style.display = 'none';
              svg.style.display = 'block';
          } else {
              canvas.style.display = 'block';
              svg.style.display = 'none';
              requestAnimationFrame(draw);
          }
          break;
      // Hit l to toggle lengths
      case 'l':
          showLengths = !showLengths;
          if (!showLengths) {
              removeLengths();
          }
          break;
      // Hit p to toggle plates
      case 'p': {
          showPlates = !showPlates;
          updateDerivedState();
          break;
      }
      // Hold down x to center the canvas
      case 'x': {
          // get the latest version of traces
          traces = computeTraces(linkage);
          const flatTraces = Object.values(traces).flat();
          // get min and max x and y across all traces
          const xs = flatTraces.flatMap(trace => trace.map(p => p.x));
          const ys = flatTraces.flatMap(trace => trace.map(p => p.y));
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const center = linkToBrowserCoords(transform, {x: (minX + maxX) / 2, y: (minY + maxY) / 2});
          translateTransform(transform, canvas.width / 2 - center.x, canvas.height / 2 - center.y);
          break;
      }
      // +/- to change speed
      case '+':
          speed *= 1.1;
          break;
      case '-':
          speed *= 0.9;
          break;
      default:
          console.log(event.key);
          break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.key) {
      case 'Shift':
          state = {type: 'init'};
          break;
      default:
          break;
  }
});

document.addEventListener('mousewheel', (event) => {
  const scaleFactor = 1.01; // Adjust for stronger/weaker zoom
  const zoom = event.wheelDeltaY < 0 ? 1/scaleFactor : scaleFactor;
  const x = event.clientX
  const y = event.clientY;

  translateTransform(transform, -x, -y);
    scaleTransform(transform, zoom, zoom);
    translateTransform(transform, x, y);
});

let focusID = null;

const paramHandlers = {
    focus(e) {
        focusID = e.target.id;
    },
    blur(e) {
        focusID = null;
    },
    keydown(e) {
        if (e.target.id !== focusID) {
            return;
        }
        const newValue = Number(e.target.value);
        switch (e.key) {
            case 'Escape':
                e.target.blur();
                break;
            case 'Enter':
                if (focusID.startsWith('param-len-')) {
                    setLinkLength(linkage, theta, computedPoints, focusID, newValue);
                } else {
                    setGroundPoint(linkage, theta, focusID, newValue);
                }
                updateDerivedState();
                e.target.blur();
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                if (focusID.startsWith('param-len-')) {
                    setLinkLength(linkage, theta, computedPoints, focusID, newValue);
                } else {
                    setGroundPoint(linkage, theta, focusID, newValue);
                }
                updateDerivedState();
                break;
        }
    }
};

// Draw every animation frame
let startTime = performance.now();
function draw() {
    const curTime = performance.now();
    const delta = (isPaused ? 0 : (curTime - startTime)) / 1000 * Math.PI * 2 * speed;
    theta += delta;
    startTime = curTime;

    // if it throws an error, reverse direction
    try {
        computedPoints = computePoints(linkage, theta);
    } catch (e) {
        speed = -speed;
        theta -= delta;
        computedPoints = computePoints(linkage, theta);
    }

    if (showSVG) {
        // drawSVG(svg, linkage, computedPoints, transform);
        drawStaticSVG(svg, linkage, computedPoints, transform, plateInfo);
        return;
    } else {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(
            transform[0][0], transform[1][0],
            transform[0][1], transform[1][1],
            transform[0][2], transform[1][2]
        );
        if (showPlates && plateInfo != null) {
            drawPlates(computedPoints, plateInfo);
        } else {
            drawLinkage(computedPoints, linkage);
        }
        drawState(computedPoints, linkage, state, hoverPoint, hoverLink, theta);
        if (showTraces) {
            drawTraces(traces, hoverPoint);
        }
        if (showLengths) {
            drawParams(linkage, computedPoints, paramHandlers, focusID, transform);
        }
    }

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
