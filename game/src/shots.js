// The screenshot scenes behind ?shot=start|play|kitchen|end. Each one plays
// the real rules forward from a fresh world for a fixed stretch, steered by
// a simple autopilot (jump the fences and ovens, duck the knives and pans,
// dash when the farmer closes in), so the frame is what a real run looks
// like and the same seed always gives the same frame.
import { FIELD, STEP, TURKEY } from './config.js';
import {
  EVENT_ESCAPED, EVENT_OVER, KIND_CORN, KIND_FENCE, KIND_HAYBALE,
  KIND_KNIFE, KIND_OVEN, KIND_PAN, KIND_PUMPKIN,
} from './world.js';
import { SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const KITCHEN_DISTANCE = 430;
const END_LIMIT_SECONDS = 600;
const JUMP_KINDS = new Set([KIND_FENCE, KIND_HAYBALE, KIND_PUMPKIN, KIND_OVEN]);
const DUCK_KINDS = new Set([KIND_KNIFE, KIND_PAN]);
const CORN_KINDS = new Set([KIND_CORN]);

/** The obstacle sizes the autopilot plans against (as in world.js). */
const DIMS = {
  [KIND_FENCE]: { w: 30, h: 66 },
  [KIND_HAYBALE]: { w: 74, h: 58 },
  [KIND_PUMPKIN]: { w: 46, h: 40 },
  [KIND_OVEN]: { w: 80, h: 96 },
};

/** The turkey's jump: y(t) = v t - (g/2) t^2, with v and g from config.js. */
const JUMP_VELOCITY = 1020;
const HALF_GRAVITY = 1250;

/**
 * The times between which a jump is above `height`, or null if the jump
 * never gets that high: the roots of v t - (g/2) t^2 = height.
 */
function airtimeAbove(height) {
  const disc = JUMP_VELOCITY * JUMP_VELOCITY - 4 * HALF_GRAVITY * height;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  return { lo: (JUMP_VELOCITY - root) / (2 * HALF_GRAVITY), hi: (JUMP_VELOCITY + root) / (2 * HALF_GRAVITY) };
}

/** The nearest active item of one of `kinds` ahead of the turkey, or null. */
function nearestOf(state, kinds) {
  let nearest = null;
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index];
    if (!item.active || !kinds.has(item.kind) || item.x + item.w < TURKEY.x) continue;
    if (nearest === null || item.x < nearest.x) nearest = item;
  }
  return nearest;
}

/** The nearest active thing ahead of the turkey, or null. */
function nearestAhead(state) {
  let nearest = null;
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index];
    if (!item.active || item.x + item.w < TURKEY.x) continue;
    if (nearest === null || item.x < nearest.x) nearest = item;
  }
  return nearest;
}

/** How high above the ground an item sits, in pixels. */
function heightAboveGround(item) {
  return FIELD.groundY - item.h - item.y;
}

/**
 * The autopilot's control for one step. The good pilot times its jumps:
 * it jumps when the obstacle's whole pass under the turkey fits inside the
 * time the jump stays above the obstacle's height, ducks knives and pans
 * when nothing needs jumping, and dashes when the farmer closes in. The
 * careless pilot jumps late, never ducks and never dashes, so it gets
 * caught — as a hurried player is.
 */
function autopilot(state, reach, careless) {
  const turkey = state.turkey;
  const control = { jump: false, slide: false, dash: false };
  const front = TURKEY.x + TURKEY.width;

  if (careless) {
    const item = nearestAhead(state);
    if (item !== null && JUMP_KINDS.has(item.kind) && item.x - front < reach && turkey.onGround) {
      control.jump = true;
    }
    return control;
  }

  // Jump: the nearest fence, bale, pumpkin or oven, timed so the turkey is
  // above it for the whole time it passes underneath. Jump at the middle of
  // the safe window, not its edge: the window's edge leaves the turkey
  // landing on the obstacle's tail.
  const jumpable = nearestOf(state, JUMP_KINDS);
  let jumped = false;
  if (jumpable !== null && turkey.onGround) {
    const dims = DIMS[jumpable.kind];
    const window = airtimeAbove(dims.h);
    const arrive = (jumpable.x - front) / state.speed;
    const overlap = (TURKEY.width + dims.w) / state.speed;
    const middle = (window.lo + window.hi - overlap) / 2;
    if (window !== null && arrive >= window.lo - 0.03 && arrive <= middle) {
      control.jump = true;
      jumped = true;
    }
  }
  // Corn in a jump arc: jump through it to collect it all.
  if (!jumped && turkey.onGround) {
    const corn = nearestOf(state, CORN_KINDS);
    if (corn !== null && heightAboveGround(corn) > 30 && corn.x - front < 190) {
      control.jump = true;
      jumped = true;
    }
  }
  // Duck: a knife or a hanging pan in range, when nothing needs jumping.
  if (!jumped) {
    const duckable = nearestOf(state, DUCK_KINDS);
    if (duckable !== null && duckable.x - front < 380) {
      control.slide = true;
      return control;
    }
  }
  if (state.farmer.gap < 150 && turkey.dashCooldown <= 0 && turkey.onGround) {
    control.dash = true;
  }
  return control;
}

/** A fence, a hay bale or an oven: a jump over one of these reads at a glance. */
const COVER_KINDS = new Set([KIND_FENCE, KIND_HAYBALE, KIND_OVEN]);

/**
 * How cover-worthy the current frame is: the turkey mid-jump over a fence,
 * a bale or an oven, the farmer close enough to see, corn or a knife in
 * view, and no popup covering the turkey.
 */
function coverScore(state) {
  let score = 0;
  if (state.turkey.y > 50) score += 3;
  if (state.distance >= 60) score += 1;
  if (state.zone === 0) score += 1;
  const item = nearestAhead(state);
  if (item !== null && COVER_KINDS.has(item.kind)) {
    const distance = item.x - (TURKEY.x + TURKEY.width);
    if (distance >= 120 && distance <= 280) score += 3;
  }
  if (state.farmer.gap < 290) score += 2;
  if (state.farmer.gap < 200) score += 1;
  for (let index = 0; index < state.items.length; index += 1) {
    const it = state.items[index];
    if (!it.active || it.x < TURKEY.x || it.x > TURKEY.x + 700) continue;
    if (it.kind === KIND_CORN) score += 1;
    if (it.kind === KIND_KNIFE) score += 1;
    break;
  }
  if (state.popups.length > 0) score -= 2;
  return score;
}

/** A deep copy of the world's state, so the best frame can be kept. */
function snapshotState(state) {
  return structuredClone(state);
}

/** Put a snapshot back into the world's live state, in place. */
function restoreState(state, snap) {
  Object.assign(state.turkey, snap.turkey);
  Object.assign(state.farmer, snap.farmer);
  for (let index = 0; index < state.items.length; index += 1) {
    Object.assign(state.items[index], snap.items[index]);
  }
  state.popups.length = 0;
  for (const pop of snap.popups) state.popups.push({ ...pop });
  const scalars = ['scroll', 'distance', 'score', 'lives', 'combo', 'zone', 'zoneBanner', 'elapsed', 'speed', 'spawnAcc', 'nextGap', 'over', 'escaped', 'muted'];
  for (const key of scalars) state[key] = snap[key];
}

function simulate(world, seconds, reach, careless) {
  let events = 0;
  for (let index = 0; index < seconds / STEP; index += 1) {
    events = world.step(STEP, autopilot(world.state, reach, careless), false);
    if (events & (EVENT_OVER | EVENT_ESCAPED)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, kitchen or end; any other
 * name is start) and return the screen to draw over it and the best score
 * to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'kitchen' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { jump: false, slide: false, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Step forward for up to 75 seconds, keep the best frame seen (the
    // turkey mid-jump, the farmer in view, something to dodge), and show
    // that one. If the pilot gets caught first, restart it and try again.
    let bestScore = -1;
    let bestSnap = null;
    let restarts = 0;
    for (let index = 0; index < 75 / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, 260, false), false);
      if (events & EVENT_OVER) {
        if (restarts < 2) {
          world.reset();
          restarts += 1;
          continue;
        }
        break;
      }
      if (events & EVENT_ESCAPED) break;
      const score = coverScore(world.state);
      if (score > bestScore) {
        bestScore = score;
        bestSnap = snapshotState(world.state);
      }
    }
    if (bestSnap !== null) restoreState(world.state, bestSnap);
    return { screen: SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  if (name === 'kitchen') {
    let events = 0;
    for (let index = 0; index < 4000 && world.state.distance < KITCHEN_DISTANCE; index += 1) {
      events = world.step(STEP, autopilot(world.state, 260, false), false);
      if (events & (EVENT_OVER | EVENT_ESCAPED)) break;
    }
    if (world.state.over) {
      // The pilot never made it to the kitchen: show the run as far as it got.
      return { screen: SCREEN_OVER, best: Math.floor(world.state.score) };
    }
    // Keep the live frame at the kitchen door, then look for a flaming oven.
    const doorSnap = snapshotState(world.state);
    for (let index = 0; index < 6 / STEP && !(events & (EVENT_OVER | EVENT_ESCAPED)); index += 1) {
      const item = nearestAhead(world.state);
      if (item !== null && item.kind === KIND_OVEN
        && item.x > TURKEY.x + 300 && item.x < TURKEY.x + 900
        && world.state.turkey.onGround && !world.state.turkey.sliding) break;
      events = world.step(STEP, autopilot(world.state, 260, false), false);
    }
    // If the pilot got caught hunting for the oven, go back to the live frame.
    if (world.state.over) restoreState(world.state, doorSnap);
    return { screen: SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  // end: a careless pilot gets caught, as a hurried player is.
  const events = simulate(world, END_LIMIT_SECONDS, 90, true);
  const screen = events & EVENT_ESCAPED ? SCREEN_ESCAPED : SCREEN_OVER;
  return { screen, best: Math.floor(world.state.score) };
}
