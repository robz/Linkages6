import {distance, linkToBrowserCoords} from './geometry.js';
import {getLinkID} from './linkage.js';

export const RADIUS = 0.15;

let canvas, ctx;

export function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // Make canvas fullscreen
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Initial resize
    resizeCanvas();

    // Resize canvas when window is resized
    //window.addEventListener('resize', resizeCanvas);

    return {ctx, canvas};
}

// Draw a single link
export function drawLink(computedPoints, start, end, color='black', drawEndpoints=true) {
    const startPoint = typeof start === 'string' ? computedPoints[start] : start;
    const endPoint = typeof end === 'string' ? computedPoints[end] : end;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = RADIUS / 2;
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    if (drawEndpoints) {
        for (const point of [startPoint, endPoint]) {
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(point.x, point.y, RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export function drawState(computedPoints, state, hoverPoint, hoverLink, theta) {
    switch (state.type) {
        case 'init':
            if (hoverLink != null) {
                drawLink(computedPoints, hoverLink[0], hoverLink[1], "gray");
            }
            break;
        case 'r':
            const p = {
                x: hoverPoint.x + Math.cos(theta),
                y: hoverPoint.y + Math.sin(theta),
            };
            drawLink(computedPoints, hoverPoint, p, "gray");
            break;
        case 'p':
            drawLink(computedPoints, state.p0, hoverPoint, "gray");
            break;
        case 'g':
            if (hoverLink != null) {
                drawLink(computedPoints, state.p0, hoverLink[0], "gray");
                drawLink(computedPoints, state.p0, hoverLink[1], "gray");
            } else {
                drawLink(computedPoints, state.p0, hoverPoint, "gray");
            }
            break;
        case 'pg':
        case 'gg':
            drawLink(computedPoints, state.p0, state.p1, "gray");
            drawLink(computedPoints, state.p1, hoverPoint, "gray");
            break;
        case 'pp':
        case 'gp':
            drawLink(computedPoints, state.p0, hoverPoint, "gray");
            drawLink(computedPoints, state.p1, hoverPoint, "gray");
            break;
    }
}

export function drawTraces(traces) {
    ctx.strokeStyle = 'gray';   
    for (const trace of traces) {
        ctx.beginPath();
        ctx.lineWidth = RADIUS / 8;
        ctx.moveTo(trace[0].x, trace[0].y);
        for (let i = 1; i < trace.length; i++) {
            ctx.lineTo(trace[i].x, trace[i].y);
        }
        ctx.stroke();
    }
}

export function drawLengths(segments, computedPoints, handlers, focusLength, transform) {
    const ids = new Set();

    for (const [p0Ref, p1Ref] of segments) {
        const p0 = computedPoints[p0Ref];
        const p1 = computedPoints[p1Ref];
        // Show the length of the segment in the center of the segment
        const midpoint = linkToBrowserCoords(transform, {
            x: (p0.x + p1.x) / 2,
            y: (p0.y + p1.y) / 2
        });
        // Get the length of the text in pixels
        const text = distance(p0, p1).toFixed(2);

        // Use a color that contrasts stronly with both white background and the black links
        const id = getLinkID(p0Ref, p1Ref);
        ids.add(id);
        const textWidth = ctx.measureText(text).width + 20;

        // get the existing element if it exists
        let input = document.getElementById(id);
        if (input == null) {
            input = document.createElement('input');
            input.type = "number";
            input.step = 0.1;
            input.min = 0;
            input.id = id;
            Object.assign(input.style, {
                position: 'absolute',
                color: 'black',
                padding: '5px',
                fontSize: '10px',
                fontFamily: 'sans-serif',
                zIndex: '1000',
                width: `${textWidth}px`,
                background: 'lightGray',
                borderRadius: '5px',
                border: '1px solid white',
                boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(10px)',
            });
            document.body.appendChild(input);
            Object.keys(handlers).forEach(name => {
                input.addEventListener(name, handlers[name]);
            });
        }
        if (id !== focusLength) {
            input.value = Number(text);
        }

        // update the top/left
        input.style.left = (midpoint.x - textWidth / 2) + 'px';
        input.style.top = (midpoint.y - 10) + 'px';
    }

    // remove any elements that are not in the ids set
    for (const input of document.querySelectorAll('input')) {
        const id = input.id;
        if (id.startsWith('len-') && !ids.has(id)) {
            input.remove();
        }
    }
}

export function removeLengths() {
    for (const input of document.querySelectorAll('input')) {
        const id = input.id;
        if (id.startsWith('len-')) {
            input.remove();
        }
    }
}