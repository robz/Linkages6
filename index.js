import {findNearestLink, findNearestPoint, computePoints, computeTraces, browserToLinkCoords, translateTransform, scaleTransform} from './geometry.js';
import {updateState} from './state.js';
import {initCanvas, drawState, drawLink, drawTraces, RADIUS, drawLengths, removeLengths} from './draw.js';
import {movePoint, getSegments, getGroundPointRefs, getPointRefs, setLinkLength} from './linkage.js';

// Initialize last point clicked and hover point
let state = {type: 'init'};
let hoverPoint = null;
let hoverLink = null;
let theta = 0;
let isPaused = false;
let speed = 1;
let tracing = false;
let traces = null;
let showLengths = false;

const {ctx, canvas} = initCanvas();

// transform to zoom/rotate canvas
const transform = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];

function setTransform() {
    ctx.setTransform(
        transform[0][0], transform[1][0],
        transform[0][1], transform[1][1],
        transform[0][2], transform[1][2]
    );
}

const minDim = Math.min(canvas.width, canvas.height);
scaleTransform(transform, minDim/10, -minDim/10);
translateTransform(transform, canvas.width/2, canvas.height/2);
setTransform();

const urlLinkage = new URLSearchParams(location.search).get('linkage');
export let linkage = urlLinkage != null ? JSON.parse(urlLinkage) : {
    n: 3,
    params: {p0: {x: 0, y: 0}, len2: 1, theta2: 0},
    links: [{type: 'rotary', p0: 'p0', p1: 'p1', len: 'len2', theta: 'theta2'}],
};
export let computedPoints = computePoints(linkage, theta);

// Click and drag a point
canvas.addEventListener('mousedown', (event) => {
    if (state.type !== 'init') {
        return;
    }
    const p = browserToLinkCoords(transform, {x: event.clientX, y: event.clientY});
    const pointRefs = getPointRefs(linkage);
    const nearestPointRef = findNearestPoint(pointRefs, computedPoints, p, RADIUS)?.[0];
    if (nearestPointRef) {
        state = {type: 'dragging', pRef: nearestPointRef, dragged: false};
    } else {
        state = {type: 'dragging-bg', p, dragged: false};
    }
});

// Draw a line from the last clicked point to the current mouse position
canvas.addEventListener('mousemove', (event) => {
    const p = browserToLinkCoords(transform, {x: event.clientX, y: event.clientY});
    if (state.type === 'dragging') {
        state.dragged = true;
        movePoint(linkage, computedPoints, theta, state.pRef, p);
        if (tracing) {
            traces = computeTraces(linkage);
        }
    } else if (state.type === 'dragging-bg') {
        state.dragged = true;
        const dx = p.x - state.p.x;
        const dy = p.y - state.p.y;
        // shift all ground points by how much the mouse moved
        for (const pRef of getGroundPointRefs(linkage)) {
            const p = linkage.params[pRef];
            p.x += dx;
            p.y += dy;
        }
        if (tracing) {
            traces = computeTraces(linkage);
        }
        state.p = p;
    } else {
        const pointRefs = getPointRefs(linkage);
        const nearestPointRef = findNearestPoint(pointRefs, computedPoints, p, RADIUS)?.[0];
        hoverPoint = nearestPointRef ?? p;
        if (nearestPointRef == null) {
            hoverLink = findNearestLink(getSegments(linkage), computedPoints, p, RADIUS);
        } else {
            hoverLink = null;
        }
    }
});

// Clicking the canvas draws a small black circle there, and then a line to where the mouse is hovering over
canvas.addEventListener('click', (event) => {
    if (state.type === 'dragging' || state.type === 'dragging-bg') {
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
    if (tracing) {
        traces = computeTraces(linkage);
    }
});

// Hits esc resets the state
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        // Hit Escape to reset the state
        case 'Escape':
        case 'Backspace':
            state = {type: 'init'};
            break;
        // Hit space to toggle pause
        case ' ':
            isPaused = !isPaused;
            break;
        // Hit c to change direction
        case 'c':
            speed *= -1;
            break;
        // Hit t to toggle tracing
        case 't':
            tracing = !tracing;
            if (tracing) {  
                traces = computeTraces(linkage);
            }
            break;
        // Hit l to toggle lengths
        case 'l':
            showLengths = !showLengths;
            if (!showLengths) {
                removeLengths();
            }
            break;
        // Hit d to delete a link
        case 'd':
            if (state.type === 'init') {
                state = updateState(state, {type: 'd', p0: hoverPoint}, linkage, computedPoints);
                hoverPoint = null;
                if (tracing) { 
                    traces = computeTraces(linkage);
                }
            }
            break;
        // Hit d to save to URL
        case 's': 
            location.search = new URLSearchParams({linkage: JSON.stringify(linkage)}).toString();
            break;
        // +/- to change speed
        case '+':
            speed *= 1.1;
            break;
        case '-':
            speed *= 0.9;
            break;
        // Hold down r to add another rotary link
        case 'r':
            state = {type: 'r'};
            break;
        default:
            console.log(event.key);
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'q':
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
    setTransform();
});

let focusLength = null;
const lengthHandlers = {
    focus(e) {
        focusLength = e.target.id;
    },
    blur(e) {
        focusLength = null;
    },
    keydown(e) {
        if (e.target.id !== focusLength) {
            return;
        }
        switch (e.key) {
            case 'Enter':
                setLinkLength(linkage, theta, computedPoints, focusLength, Number(e.target.value));
                if (tracing) {
                    traces = computeTraces(linkage);
                }
                e.target.blur();
                break;
            case 'Escape':
                e.target.blur();
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                setLinkLength(linkage,  theta, computedPoints, focusLength, Number(e.target.value));
                if (tracing) {
                    traces = computeTraces(linkage);
                }
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

    const {x: sx, y: sy} = browserToLinkCoords(transform, {x: 0, y: 0});
    const {x: ex, y: ey} = browserToLinkCoords(transform, {x: canvas.width, y: canvas.height});
    ctx.clearRect(sx, sy, ex - sx, ey - sy);

    // draw all links
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                drawLink(computedPoints, link.p0, link.p1, 'black');
                break;
            case 'hinge':
                drawLink(computedPoints, link.p0, link.p2, 'black');
                drawLink(computedPoints, link.p1, link.p2, 'black');
                break;
        }
    }

    drawState(computedPoints, state, hoverPoint, hoverLink, theta);

    if (typeof hoverPoint === 'string') {
        ctx.beginPath();
        ctx.fillStyle = 'lightGray';
        ctx.arc(computedPoints[hoverPoint].x, computedPoints[hoverPoint].y, RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    if (tracing) {
        drawTraces(traces);
    }

    if (showLengths) {
        drawLengths(getSegments(linkage), computedPoints, lengthHandlers, focusLength, transform);
    }

    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);