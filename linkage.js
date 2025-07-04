import {
  distance,
  calcHingeParams,
  computePoints,
  updateHingeParamsWithLengths,
  projectSlider,
  platesIntersect,
  distanceFromPointToLink,
} from './geometry.js';

import {layerPlates} from './compute_planes.js';

export function getPointRefs(linkage) {
  const points = new Set();
  for (const link of linkage.links) {
    switch (link.type) {
      case 'rotary':
        points.add(link.p0).add(link.p1);
        break;
      case 'hinge':
        points
          .add(link.p0)
          .add(link.p1)
          .add(link.p2);
        break;
      case 'slider':
        points
          .add(link.p0)
          .add(link.p1)
          .add(link.p2);
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
      case 'slider':
        segments.push([link.p0, link.p2]);
        break;
    }
  }
  return segments;
}

export function addHinge(linkage, computedPoints, p0Ref, p1Ref, p1, p2) {
  const ptRef = `pt${linkage.n++}`;
  const l2tRef = `l2t${linkage.n++}`;
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

export function addSlider(linkage, computedPoints, state, p2Hover) {
  let {p0, p1} = state;
  const p0Value = typeof p0 === 'string' ? computedPoints[p0] : p0;
  const p1Value = typeof p1 === 'string' ? computedPoints[p1] : p1;
  const p2 = projectSlider(p0Value, p1Value, p2Hover);
  const totalLen = distance(p0Value, p2);
  if (totalLen < distance(p0Value, p1Value)) {
    return state;
  }

  const lenRef = `len${linkage.n++}`;
  const p0Ref = typeof p0 === 'string' ? p0 : `p${linkage.n++}`;
  const p1Ref = typeof p1 === 'string' ? p1 : `p${linkage.n++}`;
  const p2Ref = `p${linkage.n++}`;

  linkage.links.push({
    type: 'slider',
    p0: p0Ref,
    p1: p1Ref,
    len: lenRef,
    p2: p2Ref,
  });

  if (typeof p0 !== 'string') {
    linkage.params[p0Ref] = p0;
  } else {
    p0 = p0Value;
  }
  if (typeof p1 !== 'string') {
    linkage.params[p1Ref] = p1;
  } else {
    p1 = p1Value;
  }

  linkage.params[lenRef] = totalLen;

  return {type: 'init'};
}

function getLinksForPoint(linkage, p0Ref) {
  return linkage.links.filter(
    link => link.p0 === p0Ref || link.p1 === p0Ref || link.p2 === p0Ref,
  );
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
  linkage.links = [...linkage.links.slice(0, i), ...linkage.links.slice(i + 1)];

  return {type: 'init'};
}

export function addRotary(linkage, p) {
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

  // if it's the tip of a rotary link, then update theta and the len
  const rotary = linkage.links.find(l => l.type === 'rotary' && l.p1 === pRef);
  if (rotary != null) {
    const oldLen = linkage.params[rotary.len];
    const oldThetaOffset = linkage.params[rotary.theta];

    const p0 = linkage.params[rotary.p0];
    const newLen = distance(p, p0);
    const newTheta = Math.atan2(p.y - p0.y, p.x - p0.x);

    try {
      linkage.params[rotary.len] = newLen;
      linkage.params[rotary.theta] = (newTheta - theta) % (2 * Math.PI);
      computePoints(linkage, theta);
    } catch (e) {
      linkage.params[rotary.len] = oldLen;
      linkage.params[rotary.theta] = oldThetaOffset;
    }
    return;
  }

  // if it's the end of a slider, then update the len
  const slider = linkage.links.find(l => l.type === 'slider' && l.p2 === pRef);
  if (slider != null) {
    const oldLen = linkage.params[slider.len];
    try {
      linkage.params[slider.len] = distance(p, computedPoints[slider.p0]);
      computePoints(linkage, theta);
    } catch (e) {
      linkage.params[slider.len] = oldLen;
    }
    return;
  }

  // otherwise, it's a hinge point, so we need to recompute the hinge params
  const oldParams = {};
  for (const hinge of linkage.links.filter(l => l.type === 'hinge')) {
    if (hinge.p0 !== pRef && hinge.p1 !== pRef && hinge.p2 !== pRef) {
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
    // revert all param changes if updating the linkage fails
    for (const [key, value] of Object.entries(oldParams)) {
      linkage.params[key] = value;
    }
  }
}

export function getFocusID({p0, p1, xy}) {
  if (p0 != null && p1 != null) {
    const ps = [p0, p1];
    ps.sort();
    return `param-len-${ps[0]}-${ps[1]}`;
  } else {
    return `param-ground-${p0}-${xy}`;
  }
}

function getPointsFromLinkID(linkID) {
  // {p0, p1}
  return linkID.match(/^param-len-(?<p0>[^-]+)-(?<p1>[^-]+)$/).groups;
}

export function setLinkLength(linkage, theta, computedPoints, linkID, len) {
  const {p0, p1} = getPointsFromLinkID(linkID);
  // figure out which link these belong to
  for (const link of linkage.links) {
    switch (link.type) {
      case 'rotary':
        if (linkID === getFocusID({p0: link.p0, p1: link.p1})) {
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
      case 'slider':
        if (linkID === getFocusID({p0: link.p0, p1: link.p2})) {
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
        if (linkID === getFocusID({p0: link.p0, p1: link.p2})) {
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
        } else if (linkID === getFocusID({p0: link.p1, p1: link.p2})) {
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

function getPointRefFromLinkID(linkID) {
  // {p0, xy}
  return linkID.match(/^param-ground-(?<p0>[^-]+)-(?<xy>[xy])$/).groups;
}

export function setGroundPoint(linkage, theta, focusID, newValue) {
  const {p0, xy} = getPointRefFromLinkID(focusID);
  const p = linkage.params[p0];
  const oldP = {...p};
  if (xy == 'x') {
    p.x = newValue;
  } else {
    p.y = newValue;
  }
  try {
    computePoints(linkage, theta);
  } catch (e) {
    linkage.params[p0] = oldP;
  }
}

// Group link segments into plates
// Each plate contains a set of points that are locked together
// (fixed relative to each other in the same coordinate system)
// Includes the segments and triangles from the original linkage to make it easier
// to draw them and compute intersections/pass-thrus later.
//
// Returns Array<plate>
// Where plate is
// {
//     points: Set<string>,
//     segments: Array<[string, string]>,
//     triangles: Array<[string, string, string]>,
// }
function getPlates(linkage) {
  const isGround = p => linkage.params[p] != null;

  const plates = [
    {
      points: new Set(),
      segments: [],
      triangles: [],
      sliders: [],
    },
  ]; // initialize with an empty ground plate

  // Add points and segments to a plate, creating a new plate if necessary
  const updatePlates = (plateIndex, points, isSlider = false) => {
    if (plateIndex === plates.length) {
      plates.push({
        points: new Set(),
        segments: [],
        triangles: [],
        sliders: [],
      });
    }
    const plate = plates[plateIndex];
    if (points.length === 1) {
      plate.points.add(points[0]);
    } else if (points.length === 2) {
      plate.points.add(points[0]).add(points[1]);
      plate.segments.push(points);
    } else if (points.length === 3) {
      points.forEach(p => plate.points.add(p));
      if (isSlider) {
        plate.segments.push([points[0], points[2]]);
        plate.sliders.push(points);
      } else {
        plate.segments.push([points[0], points[1]]);
        plate.segments.push([points[1], points[2]]);
        plate.triangles.push(points);
      }
    }
  };

  const getPlateIndex = ({p0, p1}) =>
    plates.findIndex(plate => {
      if (plate.sliders.some(ps => ps[1] === p0 || ps[1] === p1)) {
        return false;
      }
      return plate.points.has(p0) && plate.points.has(p1);
    });

  // Construct plates from each link, merging plates that are connected
  for (const link of linkage.links) {
    switch (link.type) {
      case 'rotary':
        if (isGround(link.p0)) {
          updatePlates(0, [link.p0]);
        }
        updatePlates(plates.length, [link.p0, link.p1]);
        break;
      case 'hinge': {
        const existingPlate = getPlateIndex(link);
        if (existingPlate != -1) {
          updatePlates(existingPlate, [link.p0, link.p2, link.p1]);
        } else {
          updatePlates(plates.length, [link.p0, link.p2]);
          updatePlates(plates.length, [link.p2, link.p1]);
          if (isGround(link.p0)) {
            updatePlates(0, [link.p0]);
          }
          if (isGround(link.p1)) {
            updatePlates(0, [link.p1]);
          }
        }
        break;
      }
      case 'slider': {
        const existingPlate = getPlateIndex(link);
        if (existingPlate != -1) {
          updatePlates(existingPlate, [link.p0, link.p1, link.p2], true);
        } else {
          updatePlates(plates.length, [link.p0, link.p1, link.p2], true);
          if (isGround(link.p0)) {
            updatePlates(0, [link.p0]);
          }
          if (isGround(link.p1)) {
            updatePlates(0, [link.p1]);
          }
        }
        break;
      }
    }
  }

  // Add segments between each point on the ground plate
  const groundPoints = Array.from(plates[0].points);
  for (let i = 0; i < groundPoints.length - 1; i++) {
    updatePlates(0, [groundPoints[i], groundPoints[i + 1]]);
  }

  return plates;
}

// Determine which plates are connected to which other plates.
// Two plates are connected if they share a connection point.
// Returns {
//     plateConnections: Map<plate, Set<plate>>,
//     pointConnections: Map<point, Set<plate>>,
// }
function getConnectedPlates(plates) {
  const plateConnections = new Map(plates.map(plate => [plate, new Set()]));
  const pointConnections = new Map(); // Map<point, Set<plate>>

  for (let i = 0; i < plates.length; i++) {
    const plate0 = plates[i];
    for (let j = i + 1; j < plates.length; j++) {
      const plate1 = plates[j];
      for (const p0 of plate0.points) {
        if (plate1.points.has(p0)) {
          plateConnections.get(plate0).add(plate1);
          plateConnections.get(plate1).add(plate0);
          const p0Plates = pointConnections.get(p0) ?? new Set();
          pointConnections.set(p0, p0Plates.add(plate0).add(plate1));

          // two plates can only be connected at one point
          break;
        }
      }
    }
  }
  return {plateConnections, pointConnections};
}

// Determine which plates intersect at each other, using trace data that was
// pre-computed for each timestep.
// Two plates intersect if any two segments of the plates intersect.
// Returns Map<plate, Set<plate>>
function getPlateIntersections(plates, pointsList, plateConnections) {
  const intersections = new Map(plates.map(plate => [plate, new Set()]));

  for (const computedPoints of pointsList) {
    for (let i = 0; i < plates.length; i++) {
      const plate0 = plates[i];
      for (let j = i + 1; j < plates.length; j++) {
        const plate1 = plates[j];
        if (
          !plateConnections.get(plate0).has(plate1) &&
          platesIntersect(plate0.segments, plate1.segments, computedPoints)
        ) {
          intersections.get(plate0).add(plate1);
          intersections.get(plate1).add(plate0);
        }
      }
    }
  }

  return intersections;
}

// Compute the connection points that each plate passes over
// We must take this into account when placing plates into planes,
// to avoid sandwiching a plate between two other plates
// Returns Map<plate, Set<p>>
export function computePassThrus(
  plates,
  pointConnections,
  pointsList,
  margin = 0.15,
) {
  const platesToCheck = new Map();
  for (const plate of plates) {
    const pointsToCheck = new Set();
    for (const [p, connectedPlates] of pointConnections.entries()) {
      if (connectedPlates.has(plate)) {
        // if the plate is connected to the point,
        // then it can't pass thru the connection,
        // so it doesn't need to be checked
        continue;
      }
      pointsToCheck.add(p);
    }
    platesToCheck.set(plate, pointsToCheck);
  }

  const passThrus = new Map(plates.map(plate => [plate, []]));
  for (const computedPoints of pointsList) {
    for (const [plate, pointsToCheck] of platesToCheck.entries()) {
      for (const p of pointsToCheck) {
        for (const segment of plate.segments) {
          const {distance} = distanceFromPointToLink(
            computedPoints,
            p,
            segment,
          );
          if (distance < margin) {
            passThrus.get(plate).push(pointConnections.get(p));

            // don't check this plate,point combo any more
            pointsToCheck.delete(p);
            break;
          }
        }
      }
    }
  }
  return passThrus;
}

// Group links into plates, then layer plates into planes
// Minimize the number of planes while taking into account plates that
// intersect, connect, or pass through each other's connection points.
//
// Returns {planes: Array<Array<plate>>}
export function computePlanes(linkage, pointsList) {
  const plates = getPlates(linkage);
  const {plateConnections, pointConnections} = getConnectedPlates(plates);
  const intersections = getPlateIntersections(
    plates,
    pointsList,
    plateConnections,
  );
  const passThrus = computePassThrus(plates, pointConnections, pointsList);

  const plateToPlane = layerPlates(
    plates,
    plateConnections,
    intersections,
    passThrus,
  )[0];
  if (plateToPlane == null) {
    console.error('no layering solution found');
    return null;
  }

  const planes = [];
  for (const [plate, plane] of plateToPlane.entries()) {
    if (planes[plane] == null) {
      planes[plane] = [];
    }
    planes[plane].push(plate);
  }

  return {planes};
}
