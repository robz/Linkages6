
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
    console.log(l2, l1, l0);
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
                points[link.p0] = p0;
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
                points[link.p1] = p1;
                points[link.p2] = calcHinge(p0, p1, pt, l2t);
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
    function f(i) {
        const theta = i / n * 2 * Math.PI;
        let points = null;
        try {
            points = computePoints(linkage, theta);
        } catch (e) {
            k += 1;
            return;
        }
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

    return Object.values(traces).flat();
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

export function browserToLinkCoords(transform, {x, y}) {
    const invTransform = [
        [1 / transform[0][0], 0, -transform[0][2] / transform[0][0]],
        [0, 1 / transform[1][1], -transform[1][2] / transform[1][1]],
        [0, 0, 1],
    ];
    return {
        x: invTransform[0][0] * x + invTransform[0][2],
        y: invTransform[1][1] * y + invTransform[1][2],
    };
}

export function linkToBrowserCoords(transform, {x, y}) {
    return {
        x: transform[0][0] * x + transform[0][1] * y + transform[0][2],
        y: transform[1][0] * x + transform[1][1] * y + transform[1][2],
    };
}

// Non functional code
/*
function toLayers(linkage) {
    // compute connection map
    const connections; // Map<key, Set<key>>

    // compute intersections map
    const intersections; // Map<key, Set<key>>

    // convert to list of linkts
    const linkLayers = {}; // {key: layerNumber}

    for (const key of links) {
        let layer;
        let canidateLayers = [];
        for (const c of connections.get(key)) {
            const cLayer = linkLayers[c];
            if (cLayer != null) {
                // 2 possibilities per connection -- above or below
                canidateLayers.push(cLayer + 1).push(cLayer - 1);
            }
        }
        if (canidateLayers.length === 0) {
            // No connections have been visited yet, default to first layer
            layer = 0;
        } else {
            const intersectingLayers = new Set(
                Array.from(intersections[c]).map(
                    i => linkLayers[i],
                ).filter(Boolean)
            );
            canidateLayers = canidateLayers.filter(layer => intersectingLayers.has(layer));
            if (canidateLayers.length === 0) {
                throw new Error('no candidates after intersection test');
            } else {
                layer = canidateLayers[0];
            }
        }
        linkLayers[key] = layer;
    }

    return linkLayers;
}
*/