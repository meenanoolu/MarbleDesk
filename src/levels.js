import SOLUTIONS from './solutions.json' with { type: 'json' };

// Level data. Coordinates are in metres, local to the play frame (x: -0.2..0.2, y: 0..0.3).
// `solution` is one known-good placement (verified by test/solve.mjs) used for the Hint button.
const RAW = [
  {
    name: 'First Roll',
    hint: 'Pinch a ramp from the tray and place it under the marble.',
    start: { x: -0.15, y: 0.28 },
    goal: { x: 0.15, y: 0.02 },
    statics: [],
    inventory: { rampR: 3 },
  },
  {
    name: 'Turn Around',
    hint: 'Ramps point both ways. Use the left-facing one.',
    start: { x: 0.15, y: 0.28 },
    goal: { x: -0.15, y: 0.02 },
    statics: [
      { x: 0.0, y: 0.15, w: 0.12, h: 0.01 },
      { x: -0.08, y: 0.05, w: 0.012, h: 0.1 },
    ],
    inventory: { rampL: 2, bumper: 1 },
  },
  {
    name: 'The Wall',
    hint: 'Something has to lift the marble over the divider.',
    start: { x: -0.15, y: 0.28 },
    goal: { x: 0.15, y: 0.02 },
    statics: [{ x: 0.0, y: 0.09, w: 0.012, h: 0.18 }],
    inventory: { rampR: 2, bumper: 1, fan: 1 },
  },
  {
    name: 'Zig Zag',
    hint: 'Alternate ramp directions and let bumpers fix your aim.',
    start: { x: 0.0, y: 0.28 },
    goal: { x: -0.16, y: 0.02 },
    statics: [
      { x: -0.08, y: 0.2, w: 0.1, h: 0.01 },
      { x: 0.08, y: 0.1, w: 0.1, h: 0.01 },
      { x: -0.09, y: 0.06, w: 0.012, h: 0.12 },
    ],
    inventory: { rampL: 2, rampR: 1, bumper: 2 },
  },
  {
    name: 'Top Shelf',
    hint: 'The cup is up high. Fans push the marble upward.',
    start: { x: 0.16, y: 0.28 },
    goal: { x: -0.15, y: 0.16 },
    statics: [{ x: -0.15, y: 0.14, w: 0.1, h: 0.01 }],
    inventory: { rampL: 2, fan: 1, bumper: 1 },
  },
  {
    name: 'Sandbox',
    sandbox: true,
    hint: 'Build anything you like. Pinch Drop to test it.',
    start: { x: 0.0, y: 0.28 },
    goal: { x: 9, y: 9 },
    statics: [],
    inventory: { rampR: 6, rampL: 6, bumper: 6, fan: 4 },
  },
];

export const LEVELS = RAW.map((l, i) => ({ ...l, solution: SOLUTIONS[i] || [] }));
