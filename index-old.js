const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Make canvas fullscreen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initial resize
resizeCanvas();

// Resize canvas when window is resized
window.addEventListener('resize', resizeCanvas);

// Initialize last point clicked and hover point
let lastPointClicked = null;
let hoverPoint = null;
let points = {};
let links = [];
const RADIUS = 10;

function addPoint({x, y}) {
    const id = `p${Object.keys(points).length}`;
    points[id] = {x, y};
    return id;
}

function addLink(start, end) {
    links.push([
        typeof start === 'string' ? start : addPoint(start),
        typeof end === 'string' ? end : addPoint(end),
    ]);
    console.log(links);
}

// Draw a single link
function drawLink(start, end, color='black', drawEndpoints=true) {
    const startPoint = typeof start === 'string' ? points[start] : start;
    const endPoint = typeof end === 'string' ? points[end] : end;

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

// euclidean distance between two points
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestPoint(p) {
    if (typeof p === 'string') {
        return [p, points[p]];
    }
    if (links.length === 0) {
        return null;
    }
    let nearestPointRef = links[0][0];
    let nearestPoint = points[nearestPointRef];
    let nearestDistance = distance(nearestPoint, p);
    for (const vertices of links) {
        for (const pointRef of vertices) {
            const point = points[pointRef];
            const d = distance(point, p);
            if (d < nearestDistance) {
                nearestDistance = d;
                nearestPointRef = pointRef;
                nearestPoint = point;
            }
        }
    }
    return nearestDistance < RADIUS ? [nearestPointRef, nearestPoint] : null;
}

// find the distanace from a point to a link (line segment)
function distanceFromPointToLink(p0, [p1, p2]) {
    const {x: px, y: py} = typeof p0 === 'string' ? points[p0] : p0;
    const {x: x1, y: y1} = points[p1];
    const {x: x2, y: y2} = points[p2];

    // Calculate the squared length of the line segment
    const lineLengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    // If the line segment is a point, return the distance from the point to this point
    if (lineLengthSquared === 0) {
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    // Calculate the projection of the point onto the line segment
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLengthSquared;
    // Clamp t to the range [0, 1] to ensure the projection falls on the segment
    t = Math.max(0, Math.min(1, t));
    // Find the closest point on the line segment
    const closestX = x1 + t * (x2 - x1);
    const closestY = y1 + t * (y2 - y1);
    // Calculate the distance from the point to the closest point on the segment
    const distance = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);

    return {distance, closestX, closestY};
}

function findNearestLink(p) {
    if (links.length === 0) {
        return null;
    }
    const point = typeof p === 'string' ? points[p] : p;
    let nearestLink = links[0];
    let nearestDistance = distanceFromPointToLink(point, nearestLink).distance;
    for (const link of links) {
        const {distance} = distanceFromPointToLink(point, link);
        if (distance < nearestDistance) {
            nearestLink = link;
            nearestDistance = distance;
        }
    }
    return nearestDistance < RADIUS ? nearestLink : null;
}

// Clicking the canvas draws a small black circle there, and then a line to where the mouse is hovering over
canvas.addEventListener('click', (event) => {
    if (lastPointClicked != null && hoverPoint != null) {
        addLink(lastPointClicked, hoverPoint);
        lastPointClicked = null;
        hoverPoint = null;
    } else {
        let p = {x: event.clientX, y: event.clientY};
        const nearestPointRef = findNearestPoint(p)?.[0];
        if (nearestPointRef != null) {
            lastPointClicked = nearestPointRef;
        } else {
            lastPointClicked = p;
        }
    }
});

// Draw a line from the last clicked point to the current mouse position
canvas.addEventListener('mousemove', (event) => {
    const p = {x: event.clientX, y: event.clientY};
    const nearestPointRef = findNearestPoint(p)?.[0];
    hoverPoint = nearestPointRef ?? p;
});

// Hits esc resets the state
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        lastPointClicked = null;
        hoverPoint = null;
    }
});

// Hitting cmd-z deletes the last link
document.addEventListener('keydown', (event) => {
    if (event.key === 'z' && event.metaKey) {
        links.pop();
    }
});

// Draw every animation frame
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw all links
    links.forEach(([start, end]) => drawLink(points[start], points[end]));

    // draw the hover/click state
    if (lastPointClicked != null && hoverPoint != null) {
        drawLink(lastPointClicked, hoverPoint, 'gray');
    } 
    if (typeof hoverPoint === 'string') {
        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.arc(points[hoverPoint].x, points[hoverPoint].y, RADIUS, 0, Math.PI * 2);
        ctx.fill();
    } else if (lastPointClicked == null && hoverPoint != null && links.length > 0) {
        const nearestLink = findNearestLink(hoverPoint);
        if (nearestLink != null) {
            drawLink(nearestLink[0], nearestLink[1], 'red', false);
        }
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);





/*
// Resize canvas when window is resized
window.addEventListener('resize', resizeCanvas);

// Draw blue square
ctx.fillStyle = 'blue';
ctx.fillRect(50, 50, 100, 100);

// Draw red circle
ctx.beginPath();
ctx.fillStyle = 'red';
ctx.arc(250, 100, 50, 0, Math.PI * 2);
ctx.fill();

// Draw empty triangle
ctx.beginPath();
ctx.moveTo(400, 150);
ctx.lineTo(350, 50);
ctx.lineTo(450, 50);
ctx.closePath();
ctx.strokeStyle = 'black';
ctx.stroke();
*/