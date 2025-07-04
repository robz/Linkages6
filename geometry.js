
// euclidean distance between two points
export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function findNearestPoint(pointRefs, computedPoints, p, minDistance) {
    if (typeof p === 'string') {
        return [p, computedPoints[p]];
    }
    if (pointRefs.length === 0) {
        return null;
    }
    let nearestPointRef = pointRefs[0];
    let nearestPoint = computedPoints[nearestPointRef];
    let nearestDistance = distance(nearestPoint, p);
    for (const pointRef of pointRefs) {
        const point = computedPoints[pointRef];
        const d = distance(point, p);
        if (d < nearestDistance) {
            nearestDistance = d;
            nearestPointRef = pointRef;
            nearestPoint = point;
        }
    }
    return nearestDistance < minDistance ? [nearestPointRef, nearestPoint] : null;
}

// find the distanace from a point to a link (line segment)
export function distanceFromPointToLink(points, p0, [p1, p2]) {
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

export function findNearestLink(links, points, p, minDistance) {
    if (links.length === 0) {
        return null;
    }
    const point = typeof p === 'string' ? points[p] : p;
    let nearestLink = links[0];
    let nearestDistance = distanceFromPointToLink(points, point, nearestLink).distance;
    for (const link of links) {
        const {distance} = distanceFromPointToLink(points, point, link);
        if (distance < nearestDistance) {
            nearestLink = link;
            nearestDistance = distance;
        }
    }
    return nearestDistance < minDistance ? nearestLink : null;
}

export function updateHingeParamsWithLengths(
    // current points
    {x: x0, y: y0},
    {x: x1, y: y1},
    // old params
    {x: xt, y: yt},
    l2t,
    // new lengths
    {l0, l1},
) {
    if (l0 == null) {
        l0 = Math.sqrt(xt ** 2 + yt ** 2);
    } else if (l1 == null) {
        l1 = Math.sqrt((l2t - xt) ** 2 + yt ** 2);
    } else {
        throw new Error('either l0 or l1 must be provided');
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = Math.sqrt(dx ** 2 + dy ** 2);
    if (l2 > l0 + l1 || l0 > l2 + l1 || l1 > l2 + l0) {
        throw new Error("lengths don't make a triangle");
    }

    const ytSign = yt > 0 ? 1 : -1;
    xt = (l2 ** 2 + l0 ** 2 - l1 ** 2) / (2 * l2);
    yt = ytSign * Math.sqrt(l0 ** 2 - xt ** 2);
    return {
      pt: {x: xt, y: yt},
      l2t: l2,
    };
}

export function calcHingeParams(
    {x: x0, y: y0},
    {x: x1, y: y1},
    {x: x2, y: y2},
) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = Math.sqrt(dx ** 2 + dy ** 2);
    const cosTheta = dx / l2;
    const sinTheta = -dy / l2;
    const xt = x2 - x0;
    const yt = y2 - y0;
    return {
      pt: {
        x: xt * cosTheta - yt * sinTheta,
        y: xt * sinTheta + yt * cosTheta,
      },
      l2t: l2,
    };
}

function calcHinge(
    {x: x0, y: y0}, 
    {x: x1, y: y1}, 
    {x: xt, y: yt}, 
    l2t,
) {
    const l0 = Math.sqrt(xt ** 2 + yt ** 2);
    const l1 = Math.sqrt((l2t - xt) ** 2 + yt ** 2);
  
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = Math.sqrt(dx ** 2 + dy ** 2);
    if (l2 > l0 + l1 || l0 > l2 + l1 || l1 > l2 + l0) {
      throw new Error("lengths don't make a triangle");
    }

    const ytSign = yt > 0 ? 1 : -1;
    xt = (l2 ** 2 + l0 ** 2 - l1 ** 2) / (2 * l2);
    yt = ytSign * Math.sqrt(l0 ** 2 - xt ** 2);
    const cosTheta = dx / l2;
    const sinTheta = dy / l2;
    const x2 = x0 + xt * cosTheta - yt * sinTheta;
    const y2 = y0 + xt * sinTheta + yt * cosTheta;
    return {x: x2, y: y2};
}

function calcSlider({x: x1, y: y1}, {x: x2, y: y2}, len) {
    const alpha = Math.atan2(y2 - y1, x2 - x1);
    const p3 = {x: x1 + len * Math.cos(alpha), y: y1 + len * Math.sin(alpha)};
    if (distance(p3, {x: x1, y: y1}) < distance({x: x2, y: y2}, {x: x1, y: y1})) {
        throw new Error("slider is over extended");
    }
    return p3;
}

function toUnit(v) {
    const l = Math.sqrt(v.x ** 2 + v.y ** 2);
    return {x: v.x/l, y: v.y/l};
}

function dot(v0, v1) {
    return v0.x * v1.x + v0.y * v1.y;
}

export function projectSlider(p0, p1, p2Hover) {
    const v0 = {x: p0.x - p1.x, y: p0.y - p1.y};
    const v2 = {x: p2Hover.x - p0.x, y: p2Hover.y - p0.y};
    const v0u = toUnit(v0);
    const proj = dot(v2, v0u);
    return {x: p0.x + proj * v0u.x, y: p0.y + proj * v0u.y};
}

export function computePoints(linkage, theta) {
    const points = {};
    // add ground points
    for (const key of Object.keys(linkage.params)) {
        if (key.startsWith('p')) {
            points[key] = linkage.params[key];
        }
    }
    // add computed points  
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary': {
                const p0 = points[link.p0];
                const len = linkage.params[link.len];
                const thetaOffset = linkage.params[link.theta];
                points[link.p1] = {
                    x: Math.cos(theta + thetaOffset) * len + p0.x,
                    y: Math.sin(theta + thetaOffset) * len + p0.y,
                };
                break;
            }
            case 'hinge': {
                const p0 = points[link.p0];
                const p1 = points[link.p1];
                const pt = points[link.pt];
                const l2t = linkage.params[link.l2t];
                points[link.p2] = calcHinge(p0, p1, pt, l2t);
                break;
            }
            case 'slider': {
                const p0 = points[link.p0];
                const p1 = points[link.p1];
                const len = linkage.params[link.len];
                points[link.p2] = calcSlider(p0, p1, len);
                break;
            }
        }
    }
    return points;
}

export function computeTraces(linkage, n=100) {
    const groundPoints = new Set();
    for (const key of Object.keys(linkage.params)) {
        if (key.startsWith('p')) {
            groundPoints.add(key);
        }
    }
    const traces = {};

    let k = 0;
    let computed = false;
    function f(i) {
        const theta = i / n * 2 * Math.PI;
        let points = null;
        try {
            points = computePoints(linkage, theta);
        } catch (e) {
            if (computed) {
                k += 1;
                computed = false;
            }
            return;
        }
        computed = true;
        for (const key of Object.keys(points)) {
            if (!groundPoints.has(key)) {
                if (!(key in traces)) {
                    traces[key] = [];
                }
                if (!(k in traces[key])) {
                    traces[key][k] = [];
                }
                traces[key][k].push(points[key]);
            }
        }
    }
    for (let i = 0; i < n; i++) {
        f(i);
    }
    f(0); // loop back
    return traces;
}

export function transposeTraces(linkage, traces) {
    const groundPoints = {};
    for (const key of Object.keys(linkage.params)) {
        if (key.startsWith('p') && !key.startsWith('pt')) {
            groundPoints[key] = linkage.params[key];
        }
    }

    const pointsList = [];
    for (const [pKey, pTraces] of Object.entries(traces)) {
        let i = 0;
        for (const pTrace of pTraces) {
            for (const p of pTrace) {
                if (pointsList.length <= i) {
                    pointsList.push({...groundPoints});
                }
                pointsList[i][pKey] = p;
                i += 1;
            }
        }
    }
    return pointsList;
}

export function scalePoint(p0, p1, d) {
    const {x: x0, y: y0} = p0;
    const {x: x1, y: y1} = p1;
    return {
        x: x0 + (x1 - x0) * d,
        y: y0 + (y1 - y0) * d,
    }
}

export function translateTransform(transform, tx, ty) {
    transform[0][2] += tx;
    transform[1][2] += ty;
}

export function scaleTransform(transform, sx, sy) {
    transform[0][0] *= sx;
    transform[0][1] *= sx;
    transform[0][2] *= sx;
    transform[1][0] *= sy;
    transform[1][1] *= sy;
    transform[1][2] *= sy;
}

export function rotateTransform(transform, theta) {
    const c = Math.cos(-theta);
    const s = Math.sin(-theta);
    const [[t00, t01, t02], [t10, t11, t12]] = transform;
    transform[0][0] = c * t00 + s * t10;
    transform[0][1] = c * t01 + s * t11;
    transform[0][2] = c * t02 + s * t12;
    transform[1][0] = -s * t00 + c * t10;
    transform[1][1] = -s * t01 + c * t11;
    transform[1][2] = -s * t02 + c * t12;
}

export function browserToLinkCoords(transform, {x, y}) {
    const [[t00, t01, t02], [t10, t11, t12], [t20, t21, t22]] = transform;
    const det = t00 * (t11 * t22) - t01 * (t10 * t22);
    if (det === 0) {
        throw new Error("Matrix is singular and cannot be inverted.");
    }
    const inv = [
        [t11 * t22, -t01 * t22, t01 * t12 - t02 * t11],
        [-t10 * t22, t00 * t22, t02 * t10 - t00 * t12],
        [0, 0, t00 * t11 - t01 * t10],
    ];
    return {
        x: (inv[0][0] * x + inv[0][1] * y + inv[0][2]) / det,
        y: (inv[1][0] * x + inv[1][1] * y + inv[1][2]) / det,
    };
}

export function linkToBrowserCoords(transform, {x, y}) {
    return {
        x: transform[0][0] * x + transform[0][1] * y + transform[0][2],
        y: transform[1][0] * x + transform[1][1] * y + transform[1][2],
    };
}

export function lineSegmentsIntersect(p0, p1, p2, p3) {
    function cross(p, q) {
        return p.x * q.y - p.y * q.x;
    }

    function subtract(p, q) {
        return { x: p.x - q.x, y: p.y - q.y };
    }

    function isBetween(a, b, c) {
        return Math.min(a, b) <= c && c <= Math.max(a, b);
    }

    function onSegment(p, q, r) {
        return isBetween(p.x, q.x, r.x) && isBetween(p.y, q.y, r.y);
    }

    let d1 = cross(subtract(p1, p0), subtract(p2, p0));
    let d2 = cross(subtract(p1, p0), subtract(p3, p0));
    let d3 = cross(subtract(p3, p2), subtract(p0, p2));
    let d4 = cross(subtract(p3, p2), subtract(p1, p2));

    if ((d1 * d2 < 0) && (d3 * d4 < 0)) return true; // General case

    // Special cases: check if collinear points are on the segment
    return (d1 === 0 && onSegment(p0, p1, p2)) ||
           (d2 === 0 && onSegment(p0, p1, p3)) ||
           (d3 === 0 && onSegment(p2, p3, p0)) ||
           (d4 === 0 && onSegment(p2, p3, p1));
}

export function platesIntersect(segments0, segments1, computedPoints) {
    for (const [p0, p1] of segments0) {
        for (const [p2, p3] of segments1) {
            if (lineSegmentsIntersect(...[p0, p1, p2, p3].map(p => computedPoints[p]))) {
                return true;
            }
        }
    }
    return false;
}