/*
type Point = {x: number, y: number};

type State = 
  | {type: 'init'}
  | {type: 'p', p0: string}
  | {type: 'pg', p0: string, p1: Point}
  | {type: 'g', p0: Point}
  | {type: 'gg', p0: Point, p1: Point}
  | {type: 'gp', p0: Point, p1: string}
  | {type: 'pp', p0: string, p1: string};

type Action = 
    | {type: 'p', p0: string}
    | {type: 'g', p0: Point}
    | {type: 'pp', p0: string, p1: string};

type m = string; // param ref
type cp = string; // computed point ref
type Linkage = {
    n: number, // number of refs created
    params: {[string]: number | Point},
    links: Array<
        | {type: 'rotary', p0: m, len: m, p1: cp}
        | {type: 'hinge', p0: cp, p1: cp, p2: cp, pt: cp, l2t: m}
    >,
};

declare var linkage: Linkage;
declare var distance: (Point, Point) => number;
*/

import {distance, calcHingeParams} from './geometry.js';
import {addHinge, addRotary, removePoint} from './linkage.js';

// p2 is hinge point, p0,p1 are reference points
//function addPPG(linkage: Linkage, computedPoints: {[string]: Point}, p0: string, p1: string, p2: Point) {
function addPPG(linkage, computedPoints, p0Ref, p1Ref, p2) {
    const p1 = computedPoints[p1Ref];
    return addHinge(linkage, computedPoints, p0Ref, p1Ref, p1, p2);
}

// p2 is hinge point, p1 is ground
//function addPGG(linkage: Linkage, computedPoints: {[string]: Point}, p0: string, p1: Point, p2: Point) {
function addPGG(linkage, computedPoints, p0Ref, p1, p2) {
    const p1Ref = `p${linkage.n++}`;
    linkage.params[p1Ref] = p1;
    return addHinge(linkage, computedPoints, p0Ref, p1Ref, p1, p2);
}

//function updateState(state: State, action: Action, linkage: Linkage, computedPoints: {[string]: Point}, ): State {
export function updateState(state, action, linkage, computedPoints) {
    console.log(state, action); 
    switch (state.type) {
        case 'init':
            if (action.type === 'd') {
                if (typeof action.p0 === 'string') {
                    return removePoint(linkage, action.p0);
                } else {
                    return state;
                }
            }
            return action;
        case 'p':
            switch (action.type) {
                case 'p': return { type: 'pp', p0: state.p0, p1: action.p0};
                case 'g': return {type: 'pg', p0: state.p0, p1: action.p0};
                default: return state;
            }
        case 'r':
            switch (action.type) {
                case 'g': return addRotary(linkage, action.p0);
                default: return state;
            }
        case 'g':
            switch (action.type) {
                case 'p': return {type: 'gp', p0: state.p0, p1: action.p0};
                case 'g': return {type: 'gg', p0: state.p0, p1: action.p0};
                case 'pp': return addPPG(linkage, computedPoints, action.p0, action.p1, state.p0);
                default: return state;
            }
        case 'pg':
            switch (action.type) {
                case 'p': return addPPG(linkage, computedPoints, state.p0, action.p0, state.p1);
                case 'g': return addPGG(linkage, computedPoints, state.p0, action.p0, state.p1);
                default: return state;
            }
        case 'gp':
            return action.type === 'g' ? addPGG(linkage, computedPoints, state.p1, state.p0, action.p0) : state;
        case 'gg':
            return action.type === 'p' ? addPGG(linkage, computedPoints, action.p0, state.p0, state.p1) : state;
        case 'pp':
            return action.type === 'g' ? addPPG(linkage, computedPoints, state.p0, state.p1, action.p0) : state;
    }
}