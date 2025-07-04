function createsSandwichWithPassThru(passThrus, plate, plane, plateToPlane) {
    // check if the plate is going into an existing sandwich
    for (const [plate2, platePassThrus] of passThrus.entries()) {
        if (plate2 === plate) {
            // check if the plate is being inserted into an existing sandwich
            for (const plates of platePassThrus) {
                const planes = [...plates].map(
                    p => plateToPlane.get(p)
                ).filter(p => p != null);
                const minPlane = Math.min(...planes);
                const maxPlane = Math.max(...planes);
                if (minPlane < plane && plane < maxPlane) {
                    return true;
                }
            }
        } else {
            const plane2 = plateToPlane.get(plate2);
            if (plane2 == null) {
                // the inside plate must be assigned to a plane
                // in order to enclose a sandwich
                continue;
            }
            for (const plates of platePassThrus) {
                if (!plates.has(plate)) {
                    // the checked plate isn't part of this connection point
                    continue;
                }
                const planes = [...plates].map(p => 
                    p === plate ? plane : plateToPlane.get(p)
                ).filter(p => p != null);
                const minPlane = Math.min(...planes);
                const maxPlane = Math.max(...planes);
                if (minPlane < plane2 && plane2 < maxPlane) {
                    return true;
                }
            }
        }
    }
    return false;
}

function scoreSolution(plateToPlane) {
    const scores = plateToPlane.values();
    return Math.max(...scores) - Math.min(...scores) + 1;
}

let calls = 0;
function layerPlatesAux(
    plates,
    connections,
    intersections,
    passThrus,
    plateIndex,
    plateToPlane,
    planeToPlates,
    solutions,
    minScoreParam,
) {
    calls += 1;
    if (plateIndex >= plates.length) {
        solutions.push(plateToPlane);
        return scoreSolution(plateToPlane);
    }

    const plate = plates[plateIndex];
    const plateConnections = connections.get(plate);
    const plateIntersections = intersections.get(plate);
    let minScore = minScoreParam;

    for (let plane = 0; plane < plates.length; plane++) {
        const newPlateToPlane = new Map(plateToPlane).set(plate, plane);
        if (scoreSolution(newPlateToPlane) >= minScore) {
            // This solution is worse than the best solution found so far
            continue;
        } else if ((planeToPlates.get(plane) ?? []).some(otherPlate => 
            plateConnections.has(otherPlate) || plateIntersections.has(otherPlate)
        )) {
            // The plate connects or interects with an existing plate in this plane
            continue;
        } else if (createsSandwichWithPassThru(passThrus, plate, plane, plateToPlane)) {
            // Adding the plate to this plane would create a sandwich
            continue;
        }

        minScore = layerPlatesAux(
            plates,
            connections,
            intersections,
            passThrus,
            plateIndex + 1,
            newPlateToPlane,
            new Map(planeToPlates).set(plane, (planeToPlates.get(plane) || []).concat([plate])),
            solutions,
            minScore,
        );
    }

    return minScore;
}

function isShiftOrMirror(solution1, solution2) {
    const planes = Array.from(solution1.keys());
    const ps1 = planes.map(plane => solution1.get(plane));
    const ps1Min = Math.min(...ps1);
    const ps2 = planes.map(plane => solution2.get(plane));
    const ps2Min = Math.min(...ps2);
    const ps2Max = Math.max(...ps2);
    return (
        // Check if one solution is a shift of the other
        ps1.every((p1, i) => (p1 - ps1Min) === (ps2[i] - ps2Min)) ||
        // Check if one solution is a mirror of the other
        ps1.every((p1, i) => (p1 - ps1Min) === (ps2Max - ps2[i]))
    );
}

export function layerPlates(
    plates,
    connections,
    intersections,
    passThrus,
) {
    calls = 0;
    const solutions = [];
    const minScore = layerPlatesAux(
        plates,
        connections,
        intersections,
        passThrus,
        0, // initial plate index
        new Map(), // plateToPlane
        new Map(), // planeToPlates
        solutions,
        plates.length + 1, // min score = every plate on its own plane
    );

    const solutionToScore = new Map(solutions.map(solution => [solution, scoreSolution(solution)]));
    const bestSolutions = Array.from(solutionToScore.entries())
        .filter(([_, score]) => score === minScore)
        .map(([solution]) => solution);

    // Remove solutions that are just shifts/mirrors of other solutions
    const filteredSolutions = [bestSolutions[0]];
    for (let i = 1; i < bestSolutions.length; i++) {
        const solution = bestSolutions[i];
        let disqualified = false;
        for (let j = 0; j < i; j++) {
            const otherSolution = bestSolutions[j];
            if (isShiftOrMirror(solution, otherSolution)) {
                disqualified = true;
                break;
            }
        }
        if (!disqualified) {
            filteredSolutions.push(solution);
        }
    }

    return filteredSolutions;
}

/*
// Plate tests 

const toMap = (obj) => new Map(Object.entries(obj));

console.log('four bar', layerPlates(
    ['a', 'b', 'c', 'd'],
    toMap({
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
    }),
    toMap({
        'a': new Set(['c']),
        'b': new Set([]),
        'c': new Set(['a']),
        'd': new Set([]),
    }),
    toMap({
        'a': [new Set(['b', 'c'])],
        'c': [new Set(['a', 'b'])],
    }),
), calls);

console.log('four bar clock', layerPlates(
    ['a', 'b', 'c', 'd'],
    toMap({
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
    }),
    toMap({
        'a': new Set([]),
        'b': new Set(['d']),
        'c': new Set([]),
        'd': new Set(['b']),
    }),
    toMap({
        'b': [new Set(['a', 'd'])],
        'd': [new Set(['a', 'b'])],
    }),
), calls);

// Behavior changes -- { a: 0, b: 2, c: 3, d: 1 } instead of { a: 0, b: 1, c: 2, d: 3 }
// http://localhost:9000/?linkage=%7B%22n%22%3A73%2C%22params%22%3A%7B%22p0%22%3A%7B%22x%22%3A0%2C%22y%22%3A0%7D%2C%22len2%22%3A2.2613024020661197%2C%22theta2%22%3A-6.07218056072103%2C%22p3%22%3A%7B%22x%22%3A3.61093195969008%2C%22y%22%3A-0.6871473486976306%7D%2C%22pt4%22%3A%7B%22x%22%3A3.645666742623418%2C%22y%22%3A2.8975503523373205%7D%2C%22l2t5%22%3A5.881687140963603%2C%22pt67%22%3A%7B%22x%22%3A4.500431900962691%2C%22y%22%3A-0.061550722921838275%7D%2C%22l2t68%22%3A2.2613024020661197%2C%22pt70%22%3A%7B%22x%22%3A2.150773768256578%2C%22y%22%3A-0.5470000394664968%7D%2C%22l2t71%22%3A4.500852784383739%7D%2C%22links%22%3A%5B%7B%22type%22%3A%22rotary%22%2C%22p0%22%3A%22p0%22%2C%22p1%22%3A%22p1%22%2C%22len%22%3A%22len2%22%2C%22theta%22%3A%22theta2%22%7D%2C%7B%22type%22%3A%22hinge%22%2C%22p0%22%3A%22p1%22%2C%22p1%22%3A%22p3%22%2C%22pt%22%3A%22pt4%22%2C%22l2t%22%3A%22l2t5%22%2C%22p2%22%3A%22p6%22%7D%2C%7B%22type%22%3A%22hinge%22%2C%22p0%22%3A%22p0%22%2C%22p1%22%3A%22p1%22%2C%22pt%22%3A%22pt67%22%2C%22l2t%22%3A%22l2t68%22%2C%22p2%22%3A%22p69%22%7D%2C%7B%22type%22%3A%22hinge%22%2C%22p0%22%3A%22p0%22%2C%22p1%22%3A%22p69%22%2C%22pt%22%3A%22pt70%22%2C%22l2t%22%3A%22l2t71%22%2C%22p2%22%3A%22p72%22%7D%5D%7D
console.log('hard four bar', layerPlates(
    ['a', 'b', 'c', 'd'],
    toMap({
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
    }),
    toMap({
        'a': new Set(['c']),
        'b': new Set(['d']),
        'c': new Set(['a']),
        'd': new Set(['b']),
    }),
    toMap({
        'a': [new Set(['b', 'c'])],
        'b': [new Set(['a', 'd'])],  
        'c': [new Set(['a', 'b'])],
    }),
), calls);

console.log('impossible four bar', layerPlates(
    ['a', 'b', 'c', 'd'],
    toMap({
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
    }),
    toMap({
        'a': new Set(['c']),
        'b': new Set(['d']),
        'c': new Set(['a']),
        'd': new Set(['b']),
    }),
    toMap({
        'a': [new Set(['b', 'c'])],
        'b': [new Set(['a', 'd'])],  
        'c': [new Set(['a', 'b'])],
        'd': [new Set(['a', 'b'])],
    }),
), calls);

console.log('klann', layerPlates(
    ['a', 'b', 'c', 'd', 'e', 'f'],
    {
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
        'e': new Set(['a', 'f']),
        'f': new Set(['c', 'e']),
    },
    {
        'a': new Set(['c']),
        'b': new Set([]),
        'c': new Set(['a']),
        'd': new Set([]),
        'e': new Set([]),
        'f': new Set([]),
    },
), calls);

console.log('klann flat', layerPlates(
    ['a', 'b', 'c', 'd', 'e', 'f'],
    {
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
        'e': new Set(['a', 'f']),
        'f': new Set(['c', 'e']),
    },
    {
        'a': new Set(['c']),
        'b': new Set([]),
        'c': new Set(['a', 'e']),
        'd': new Set(['e']),
        'e': new Set(['c', 'd']),
        'f': new Set([]),
    },
), calls);

console.log('klann sharp', layerPlates(
    ['a', 'b', 'c', 'd', 'e', 'f'],
    {
        'a': new Set(['b', 'd']),
        'b': new Set(['a', 'c']),
        'c': new Set(['b', 'd']),
        'd': new Set(['a', 'c']),
        'e': new Set(['a', 'f']),
        'f': new Set(['c', 'e']),
    },
    {
        'a': new Set(['c', 'f']),
        'b': new Set([]),
        'c': new Set(['a']),
        'd': new Set(['f']),
        'e': new Set([]),
        'f': new Set(['a', 'd']),
    },
), calls);
*/