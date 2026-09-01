import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
const names = ['wrappedAngleDelta', 'deadzoneDelta', 'motionPointerPosition'];
const context = vm.createContext({});

for (const name of names) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]+`));
  if (!match) throw new Error(`Could not find ${name} in src/index.template.html`);
  vm.runInContext(`${match[0]}; globalThis.${name} = ${name};`, context);
}

const position = context.motionPointerPosition;
const base = { yaw: 100, pitch: 20, wrapYaw: true };
const opts = [1, 0];
const eps = 1e-9;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const near = (a, b) => Math.abs(a - b) < eps;

// Empirical DeviceOrientation direction observed on the target phone after center calibration:
// aim right => yaw decreases; aim up => pitch increases.
const right = position({ yaw: 88, pitch: 20, wrapYaw: true }, base, ...opts);
const left  = position({ yaw: 112, pitch: 20, wrapYaw: true }, base, ...opts);
const up    = position({ yaw: 100, pitch: 28, wrapYaw: true }, base, ...opts);
const down  = position({ yaw: 100, pitch: 12, wrapYaw: true }, base, ...opts);

assert(right.x > 0.5 && near(right.y, 0.5), `right must increase x: ${JSON.stringify(right)}`);
assert(left.x < 0.5 && near(left.y, 0.5), `left must decrease x: ${JSON.stringify(left)}`);
assert(up.y < 0.5 && near(up.x, 0.5), `up must decrease y: ${JSON.stringify(up)}`);
assert(down.y > 0.5 && near(down.x, 0.5), `down must increase y: ${JSON.stringify(down)}`);

const wrappedBase = { yaw: 2, pitch: 20, wrapYaw: true };
const wrappedRight = position({ yaw: 350, pitch: 20, wrapYaw: true }, wrappedBase, ...opts);
assert(wrappedRight.x > 0.5, `yaw wrap-around must preserve right direction: ${JSON.stringify(wrappedRight)}`);

const deadzone = position({ yaw: 99.5, pitch: 20.5, wrapYaw: true }, base, 1, 1);
assert(near(deadzone.x, 0.5) && near(deadzone.y, 0.5), `dead-zone must hold center: ${JSON.stringify(deadzone)}`);

const clamp = position({ yaw: -200, pitch: 300, wrapYaw: false }, { yaw: 100, pitch: 20, wrapYaw: false }, 2, 0);
assert(clamp.x === 1 && clamp.y === 0, `coordinates must clamp to [0,1]: ${JSON.stringify(clamp)}`);

console.log('motion pointer direction regression: OK');
