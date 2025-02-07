import {distance, calcHingeParams, computePoints, updateHingeParamsWithLengths} from './geometry.js';


export function getPointRefs(linkage) {
    const points = new Set();
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                points.add(link.p0).add(link.p1);
                break;
            case 'hinge':
                points.add(link.p0).add(link.p1).add(link.p2);
                break;
        } 
    }
    return Array.from(points);
}

export function getGroundPointRefs(linkage) {
    const points = new Set();
    for (const link of linkage.links) {
        for (const p of [link.p0, link.p1, link.p2].filter(Boolean)) {
            if (linkage.params[p] != null) {
                points.add(p);
            }
        }
    }
    return Array.from(points);
}

export function getSegments(linkage) {
    const segments = [];
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                segments.push([link.p0, link.p1]);
                break;
            case 'hinge':
                segments.push([link.p0, link.p2]);
                segments.push([link.p1, link.p2]);
                break;
        }   
    }
    return segments;
}

export function addHinge(linkage, computedPoints, p0Ref, p1Ref, p1, p2) {
    const ptRef = `pt${linkage.n++}`;
    const l2tRef = `pt${linkage.n++}`;
    const p2Ref = `p${linkage.n++}`;

    linkage.links.push({
        type: 'hinge',
        p0: p0Ref,
        p1: p1Ref,
        pt: ptRef,
        l2t: l2tRef,
        p2: p2Ref,
    });

    const p0 = computedPoints[p0Ref];
    const {pt, l2t} = calcHingeParams(p0, p1, p2);

    linkage.params[ptRef] = pt;
    linkage.params[l2tRef] = l2t;

    return {type: 'init'};
}

function getLinksForPoint(linkage, p0Ref) {
    const links = [];
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary': 
                if (link.p0 === p0Ref || link.p1 === p0Ref) {
                    links.push(link);
                }
                break;
            case 'hinge':
                if (link.p0 === p0Ref || link.p1 === p0Ref || link.p2 === p0Ref) {
                    links.push(link);
                }
                break;
        }
    }
    return links;
}

export function removePoint(linkage, p0Ref) {
    const links = getLinksForPoint(linkage, p0Ref);
    if (links.length > 1) {
        // only remove the point if there's only one link connected to it
        return {type: 'init'};
    } 
    const link = links[0];

    // delete params
    switch (link.type) {
        case 'rotary':
            if (getLinksForPoint(linkage, link.p1).length > 1) {
                return {type: 'init'};
            }
            delete linkage.params[link.p1];
            if (getLinksForPoint(linkage, link.p0).length === 1) {
                delete linkage.params[link.p0];
            }
            delete linkage.params[link.len];
            delete linkage.params[link.theta];
            break;
        case 'hinge':
            if (getLinksForPoint(linkage, link.p2).length > 1) {
                return {type: 'init'};
            }
            delete linkage.params[link.p2];
            if (getLinksForPoint(linkage, link.p0).length === 1) {    
                delete linkage.params[link.p0];
            }
            if (getLinksForPoint(linkage, link.p1).length === 1) {
                delete linkage.params[link.p1];
            }
            delete linkage.params[link.pt];
            delete linkage.params[link.l2t];
            break;
    }

    // delete link
    const i = linkage.links.indexOf(link);
    linkage.links = [
        ...linkage.links.slice(0, i),
        ...linkage.links.slice(i + 1),
    ];

    console.log(linkage);
    return {type: 'init'};
}

export function addRotary(linkage, p) {
    console.log('adding rotary???????');
    const p0Ref = `p${linkage.n++}`;
    const p1Ref = `p${linkage.n++}`;
    const lenRef = `len${linkage.n++}`;
    const thetaRef = `theta${linkage.n++}`;
    linkage.params[p0Ref] = p;
    linkage.params[lenRef] = 1;
    linkage.params[thetaRef] = 0;
    linkage.links.push({
        type: 'rotary',
        p0: p0Ref,
        p1: p1Ref,
        len: lenRef,
        theta: thetaRef,
    });
    return {type: 'init'};
}

export function movePoint(linkage, computedPoints, theta, pRef, p) {
    // if it's a ground point, just move it in the linkage params
    const point = linkage.params[pRef];
    if (point != null) {
        const oldPoint = {...point};
        try {
            point.x = p.x;
            point.y = p.y;
            computePoints(linkage, theta);
        } catch (e) {
            point.x = oldPoint.x;
            point.y = oldPoint.y;
        }
        return;
    } 
    // if it's the tip of a rotary link, then updating theta and the len
    const rotary = linkage.links.find(l => l.type === 'rotary' && l.p1 === pRef);
    if (rotary != null) {
        const oldLen = linkage.params[rotary.len];
        const oldThetaOffset = linkage.params[rotary.theta];

        const p0 = linkage.params[rotary.p0];
        const newLen = distance(p, p0);
        const newTheta = Math.atan2(p.y - p0.y, p.x - p0.x);

        try {
            linkage.params[rotary.len] = newLen;
            linkage.params[rotary.theta] = newTheta - theta;
            computePoints(linkage, theta);
        } catch (e) {
            linkage.params[rotary.len] = oldLen;
            linkage.params[rotary.theta] = oldThetaOffset;
        }
        return;
    }
    // otherwise, it's a hinge point, so we need to recompute the hinge params
    const oldParams = {};
    for (const hinge of linkage.links.filter(l => l.type === 'hinge')) {
        if (
            hinge.p0 !== pRef &&
            hinge.p1 !== pRef &&
            hinge.p2 !== pRef
        ) {
            continue;
        }

        oldParams[hinge.pt] = linkage.params[hinge.pt];
        oldParams[hinge.l2t] = linkage.params[hinge.l2t];

        const ps = [hinge.p0, hinge.p1, hinge.p2].map(p => computedPoints[p]);

        if (hinge.p0 === pRef) {
            ps[0] = p;
        } else if (hinge.p1 === pRef) {
            ps[1] = p;
        } else {
            ps[2] = p;
        }
        const {pt, l2t} = calcHingeParams(...ps);
        linkage.params[hinge.pt] = pt;
        linkage.params[hinge.l2t] = l2t;
    }
    if (Object.keys(oldParams).length === 0) {
        // the point is not part of any link, so something went wrong
        throw new Error('Unknown point moved');
    }

    try {
        computePoints(linkage, theta);
    } catch (e) {
        console.log(e);
        // revert all param changes if updating the linkage fails
        for (const [key, value] of Object.entries(oldParams)) {
            linkage.params[key] = value;
        }
    }
}

export function getLinkID(p0Ref, p1Ref) {
    const ps = [p0Ref, p1Ref];
    ps.sort();
    return `len-${ps[0]}-${ps[1]}`;
}

function getPointsFromLinkID(linkID) { // {p0, p1}
    return linkID.match(/^len-(?<p0>[^-]+)-(?<p1>[^-]+)$/).groups;
}

export function setLinkLength(linkage, theta, computedPoints, linkID, len) {
    const {p0, p1} = getPointsFromLinkID(linkID);
    // figure out which link these belong to
    for (const link of linkage.links) {
        switch (link.type) {
            case 'rotary':
                if (linkID === getLinkID(link.p0, link.p1)) {
                    const oldLen = linkage.params[link.len];
                    linkage.params[link.len] = len;
                    try {
                        computePoints(linkage, theta);
                    } catch (e) {
                        // revert all param changes if updating the linkage fails
                        linkage.params[link.len] = oldLen;
                    }
                    return;
                }
                break;
            case 'hinge':
                if (linkID === getLinkID(link.p0, link.p2)) {
                    const oldPT = linkage.params[link.pt];
                    const oldL2T = linkage.params[link.l2t];
                    const {pt, l2t} = updateHingeParamsWithLengths(
                        computedPoints[link.p0],
                        computedPoints[link.p1],
                        oldPT,
                        oldL2T,
                        {l0: len},
                    );
                    linkage.params[link.pt] = pt;
                    linkage.params[link.l2t] = l2t;
                    try {
                        computePoints(linkage, theta);
                    } catch (e) {
                        // revert all param changes if updating the linkage fails
                        linkage.params[link.pt] = oldPT;
                        linkage.params[link.l2t] = oldL2T;
                    }
                    return;
                } else if (linkID === getLinkID(link.p1, link.p2)) {
                    const oldPT = linkage.params[link.pt];
                    const oldL2T = linkage.params[link.l2t];
                    const {pt, l2t} = updateHingeParamsWithLengths(
                        computedPoints[link.p0],
                        computedPoints[link.p1],
                        oldPT,
                        oldL2T,
                        {l1: len},
                    );
                    linkage.params[link.pt] = pt;
                    linkage.params[link.l2t] = l2t;
                    try {
                        computePoints(linkage, theta);
                    } catch (e) {
                        // revert all param changes if updating the linkage fails
                        linkage.params[link.pt] = oldPT;
                        linkage.params[link.l2t] = oldL2T;
                    }
                    return;
                }
                break;
        }
    }

    throw new Error('couldnt find link owner');
}
