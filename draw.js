import {distance, linkToBrowserCoords, projectSlider} from './geometry.js';
import {getSegments, getFocusID, getGroundPointRefs} from './linkage.js';

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

export function drawSliderJoint(p0, p1, color='black') {
    const theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(theta);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(-RADIUS, -RADIUS, RADIUS*2, RADIUS*0.7);
    ctx.rect(-RADIUS, RADIUS*0.3, RADIUS*2, RADIUS*0.7);
    ctx.fill();
    ctx.restore();
}


// deterministic set of colors for 10 plates
const COLORS = ['green', 'blue', 'yellow', 'purple', 'orange', 'brown', 'pink', 'gray', 'black'];

export function drawPlates(computedPoints, {planes}) {
    let i = 0;
    for (const plane of planes) {
        const color = COLORS[i++ % COLORS.length];

        for (const plate of plane) {
            ctx.fillStyle = color;
            for (const triangle of plate.triangles) {
                const p0 = computedPoints[triangle[0]];
                const p1 = computedPoints[triangle[1]];
                const p2 = computedPoints[triangle[2]];
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.closePath();
                ctx.fill();
            }

            for (const slider of plate.sliders) {
                drawSliderJoint(
                    computedPoints[slider[0]],
                    computedPoints[slider[1]],
                    'black',
                );
            }

            for (const [p0, p1] of plate.segments) {
                drawLink(computedPoints, p0, p1);
            }

            ctx.lineWidth = RADIUS / 4;
            ctx.strokeStyle = color;
            ctx.lineJoin = 'round';
            for (let [p0, p1] of plate.segments) {
                p0 = computedPoints[p0];
                p1 = computedPoints[p1];
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            }
        }
    }
}

export function drawState(
    computedPoints,
    linkage,
    state,
    hoverPoint,
    hoverLink,
    theta,
) {
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
        case 'slider':
            if (hoverPoint != null) {
                ctx.fillStyle = 'gray';
                ctx.beginPath();
                ctx.arc(hoverPoint.x, hoverPoint.y, RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'slider_g':
            drawLink(computedPoints, state.p0, hoverPoint, "gray");
            break;
        case 'slider_p':
            drawLink(computedPoints, state.p0, hoverPoint, "gray");
            break;
        case 'slider_pg': 
        case 'slider_pp': 
        case 'slider_gp': {
            const p0 = typeof state.p0 === 'string' ? computedPoints[state.p0] : state.p0;
            const p1 = typeof state.p1 === 'string' ? computedPoints[state.p1] : state.p1;
            drawSliderJoint(p0, p1);
            drawLink(computedPoints, p0, projectSlider(p0, p1, hoverPoint), "gray");
            break;
        }
        case 'rotating': {
            if (state.theta != null) {
                ctx.save();
                ctx.resetTransform();
                const len = canvas.width/4;
                const p0 = {x: canvas.width/2, y: canvas.height/2};
                const p1 = {x: p0.x + len, y: p0.y};
                const p2 = {
                    x: p0.x + len * Math.cos(state.theta), 
                    y: p0.y + len * Math.sin(state.theta)
                };
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'gray';

                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(p0.x, p0.y, len, state.theta0, state.theta, state.theta0 > state.theta);
                ctx.stroke();
                ctx.restore();
            }
            break;
        }
    }

    if (typeof hoverPoint === 'string') {
        const p = computedPoints[hoverPoint];
        const slider = linkage.links.find(link => link.type === 'slider' && link.p1 === hoverPoint);
        ctx.fillStyle = 'lightGray';
        if (slider != null) {
            drawSliderJoint(computedPoints[slider.p0], p, "lightGray");
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export function drawTraces(traces/*: {[pRef]: Array<Array<{x: number, y: number}>>}*/, hoverPoint) {
    //for (const trace of Object.values(traces).flat()) {
    for (const [pRef, pTraces] of Object.entries(traces)) {
        ctx.strokeStyle = pRef === hoverPoint ? 'red' : 'gray';
        ctx.lineWidth = RADIUS / (pRef === hoverPoint ? 4 : 8);
        for (const trace of pTraces) {
            ctx.beginPath();
            ctx.moveTo(trace[0].x, trace[0].y);
            for (let i = 1; i < trace.length; i++) {
                ctx.lineTo(trace[i].x, trace[i].y);
            }
            ctx.stroke();
        }
    }
}

function drawParam(id, text, midpoint, focusID, handlers) {
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
    if (id !== focusID) {
        input.value = Number(text);
    }

    // update the top/left
    input.style.left = (midpoint.x - textWidth / 2) + 'px';
    input.style.top = (midpoint.y - 10) + 'px';
}

export function drawParams(linkage, computedPoints, handlers, focusID, transform) {
    const ids = new Set();
    const segments = getSegments(linkage);

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
        const id = getFocusID({p0: p0Ref, p1: p1Ref});
        ids.add(id);

        drawParam(id, text, midpoint, focusID, handlers);
    }

    for (const key of getGroundPointRefs(linkage)) {
        const p0 = linkage.params[key];
        const p = linkToBrowserCoords(transform, p0);

        let {x, y} = p0;
        x = x.toFixed(2);
        const textWidth = ctx.measureText(x).width;
        const dx = textWidth+35;
        
        const idX = getFocusID({p0: key, xy: 'x'});
        drawParam(idX, x, {x: p.x-dx/2-5, y: p.y+20}, focusID, handlers);

        const idY = getFocusID({p0: key, xy: 'y'});
        drawParam(idY, y.toFixed(2), {x: p.x+dx/2-5, y: p.y+20}, focusID, handlers);

        ids.add(idX).add(idY);
    }

    // remove any elements that are not in the ids set
    for (const input of document.querySelectorAll('input')) {
        const id = input.id;
        if (id.startsWith('param-') && !ids.has(id)) {
            input.remove();
        }
    }
}

export function removeLengths() {
    for (const input of document.querySelectorAll('input')) {
        if (input.id.startsWith('param-')) {
            input.remove();
        }
    }
}

export function drawLinkage(computedPoints, linkage) {
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                drawLink(computedPoints, link.p0, link.p1, 'black');
                break;
            case 'hinge':
                drawLink(computedPoints, link.p0, link.p2, 'black');
                drawLink(computedPoints, link.p1, link.p2, 'black');
                break;
            case 'slider':
                const p0 = computedPoints[link.p0];
                const p1 = computedPoints[link.p1];
                drawSliderJoint(p0, p1);
                drawLink(computedPoints, p0, link.p2, 'black');
                break;
        }
    }
}

const svgNS = "http://www.w3.org/2000/svg";

export function initSVG() {
    let svg = document.getElementById("svgCanvas");
    //if (!svg) {
        //svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("id", "svgCanvas");
        svg.setAttribute("width", window.innerWidth);
        svg.setAttribute("height", window.innerHeight);
        svg.style.display = 'none';
        //document.body.appendChild(svg);
    //}
    return svg;
}

export function drawSVG(svg, linkage, computedPoints, transform) {
    svg.innerHTML = ""; // Clear previous drawings

    // Apply transformation
    const transformStr = `matrix(${transform[0][0]} ${transform[1][0]} ${transform[0][1]} ${transform[1][1]} ${transform[0][2]} ${transform[1][2]})`;
    
    const drawSVGLink = (p0Ref, p1Ref, color) => {
        const p0 = typeof p0Ref === 'string' ? computedPoints[p0Ref] : p0Ref;
        const p1 = typeof p1Ref === 'string' ? computedPoints[p1Ref] : p1Ref;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", p0.x);
        line.setAttribute("y1", p0.y);
        line.setAttribute("x2", p1.x);
        line.setAttribute("y2", p1.y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", RADIUS / 2);
        line.setAttribute("transform", transformStr);
        svg.appendChild(line);
    };

    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                drawSVGLink(link.p0, link.p1, 'black');
                break;
            case 'hinge':
                drawSVGLink(link.p0, link.p2, 'black');
                drawSVGLink(link.p1, link.p2, 'black');
                break;
            case 'slider':
                //drawSliderJoint(p0, p1);
                drawSVGLink(link.p0, link.p2, 'black');
                break;
        }
    }
}

export function drawStaticSVG(svg, linkage, computedPoints, transform, plateInfo) {
    svg.innerHTML = ""; // Clear previous drawings
    
    const drawSVGHole = (x, y, diameter, scale, color="red") => {
        const hole = document.createElementNS(svgNS, "circle");
        hole.setAttribute("cx", x);
        hole.setAttribute("cy", y);
        hole.setAttribute("r", diameter/2);
        hole.setAttribute("transform", `scale(${scale})`);
        hole.setAttribute("fill", 'none');
        hole.setAttribute("stroke-width", RADIUS / 2 / 5);
        hole.setAttribute("stroke", color);
        svg.appendChild(hole);
    };

    function drawPlus(x, y, diameter, thickness, scale) {
        const halfOuter = diameter / 2;
        const halfThickness = thickness / 2;
    
        // Create a path for the plus outline
        const path = document.createElementNS(svgNS, "path");
    
        // Path definition
        const d = [
        // Start at top vertical arm
        `M ${x - halfThickness} ${y - halfOuter}`,
        `L ${x + halfThickness} ${y - halfOuter}`,
        `L ${x + halfThickness} ${y - halfThickness}`,
        `L ${x + halfOuter} ${y - halfThickness}`,
        `L ${x + halfOuter} ${y + halfThickness}`,
        `L ${x + halfThickness} ${y + halfThickness}`,
        `L ${x + halfThickness} ${y + halfOuter}`,
        `L ${x - halfThickness} ${y + halfOuter}`,
        `L ${x - halfThickness} ${y + halfThickness}`,
        `L ${x - halfOuter} ${y + halfThickness}`,
        `L ${x - halfOuter} ${y - halfThickness}`,
        `L ${x - halfThickness} ${y - halfThickness}`,
        `Z`
        ].join(" ");
    
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "red");
        path.setAttribute("stroke-width", RADIUS / 2 / 5);
        path.setAttribute("transform", `scale(${scale})`);
    
        svg.appendChild(path);
    }

    function drawOutlinedPlus(x, y, diameter, thickness, scale, notchWidth) {
        const halfOuter = diameter / 2;
        const halfThickness = thickness / 2;
        const halfNotch = notchWidth / 2;
      
        const path = document.createElementNS(svgNS, "path");
      
        const d = [
          // Top notch
          `M ${x - halfNotch} ${y - halfOuter - thickness}`,
          `L ${x + halfNotch} ${y - halfOuter - thickness}`,
          `L ${x + halfNotch} ${y - halfOuter}`,
      
          // Top vertical arm
          `L ${x + halfThickness} ${y - halfOuter}`,
          `L ${x + halfThickness} ${y - halfThickness}`,
          `L ${x + halfOuter} ${y - halfThickness}`,
          `L ${x + halfOuter} ${y + halfThickness}`,
          `L ${x + halfThickness} ${y + halfThickness}`,
          `L ${x + halfThickness} ${y + halfOuter}`,
          `L ${x - halfThickness} ${y + halfOuter}`,
          `L ${x - halfThickness} ${y + halfThickness}`,
          `L ${x - halfOuter} ${y + halfThickness}`,
          `L ${x - halfOuter} ${y - halfThickness}`,
          `L ${x - halfThickness} ${y - halfThickness}`,
          `L ${x - halfThickness} ${y - halfOuter}`,
          `L ${x - halfNotch} ${y - halfOuter}`,
          `Z`
        ].join(" ");
      
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "black");
        path.setAttribute("stroke-width", RADIUS / 2 / 5);
        path.setAttribute("transform", `scale(${scale})`);
      
        svg.appendChild(path);
    }

    const drawSVGLink = (
        p0Ref,
        p1Ref,
        xoffset,
        yoffset,
        scale,
        height,
        holeDiam,
    ) => {
        const p0 = typeof p0Ref === 'string' ? computedPoints[p0Ref] : p0Ref;
        const p1 = typeof p1Ref === 'string' ? computedPoints[p1Ref] : p1Ref;

        const d = distance(p0, p1);

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", xoffset);
        rect.setAttribute("y", yoffset);
        rect.setAttribute("rx", height/2);
        rect.setAttribute("width", d);
        rect.setAttribute("height", height);
        rect.setAttribute("transform", `scale(${scale})`);
        rect.setAttribute("fill", 'none');
        rect.setAttribute("stroke-width", RADIUS / 2 / 5);
        rect.setAttribute("stroke", 'black');
        svg.appendChild(rect);

        const holeOffset = height / 2;

        for (const dx of [holeOffset, d - holeOffset]) {
            drawSVGHole(
                xoffset + dx,
                yoffset + holeOffset,
                holeDiam,
                scale,
            )
        }
    };

    const drawSpacer = (x, y, diameter, scale, thickness) => {
        drawSVGHole(x, y, diameter, scale, "black");
        drawPlus(x, y, diameter*0.6, thickness, scale);
    };

    const HEIGHT = 0.39;
    const MARGIN = 0.3;
    const Y_OFFSET = HEIGHT * 1.5;
    const HOLE_DIAM = HEIGHT * 0.5;
    const SCALE = 200;
    const THICKNESS = HEIGHT/4;

    let i = 0;
    for (const plane of plateInfo.planes) {
        for (const plate of plane) {
            for (const [p0, p1] of plate.segments) {
                drawSVGLink(p0, p1, MARGIN, MARGIN + Y_OFFSET * i, SCALE, HEIGHT, HOLE_DIAM);
                i += 1;
            }
        }
    }

    const spacerOffset = HEIGHT + Y_OFFSET * i;

    // i*2 spacer, i*2 connectors
    for (let j = 0; j < i*2; j++) {
        drawSpacer(
            MARGIN + HEIGHT/2 + HEIGHT * 1.1 * j,
            spacerOffset,
            HEIGHT,
            SCALE,
            THICKNESS,
        );
    }

    const connectorOffset = HEIGHT + spacerOffset;

    // i*2 spacer, i*2 connectors
    for (let j = 0; j < i*2; j++) {
        drawOutlinedPlus(
            MARGIN + HEIGHT/2 + HEIGHT * 1.1 * j,
            connectorOffset,
            HEIGHT,
            SCALE,
            THICKNESS,
            HEIGHT/5,
        );
    }
}