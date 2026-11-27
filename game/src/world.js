// The game's rules and state, with no drawing and no browser in it: the
// turkey's run, the farmer chasing from behind, the hazards and pickups of
// three zones (farmyard, cornfield, kitchen), the hide-in-a-haystack trick,
// score, lives and the escape at 600 metres. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after
// createWorld returns.
import {
  DASH, ESCAPE_DISTANCE, FARMER, FIELD, LIVES, PX_PER_METRE, SCORE,
  SPAWN, SPEED, TURKEY, ZONES,
} from './config.js';

export const KIND_FENCE = 0;
export const KIND_HAYBALE = 1;
export const KIND_PUMPKIN = 2;
export const KIND_OVEN = 3;
export const KIND_PAN = 4;
export const KIND_KNIFE = 5;
export const KIND_HAYSTACK = 6;
export const KIND_CORN = 7;
export const KIND_FEATHER = 8;

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_HIDE = 4;
export const EVENT_OVER = 8;
export const EVENT_ESCAPED = 16;
export const EVENT_ZONE = 32;
export const EVENT_FEATHER = 64;
export const EVENT_SPOTTED = 128;

/** How many things can exist at once; the pool is allocated once, at boot. */
const POOL_SIZE = 48;

const DIMS = {
  [KIND_FENCE]: { w: 30, h: 66 },
  [KIND_HAYBALE]: { w: 74, h: 58 },
  [KIND_PUMPKIN]: { w: 46, h: 40 },
  [KIND_OVEN]: { w: 80, h: 96 },
  [KIND_PAN]: { w: 56, h: 470 },
  [KIND_KNIFE]: { w: 46, h: 16 },
  [KIND_HAYSTACK]: { w: 120, h: 76 },
  [KIND_CORN]: { w: 26, h: 26 },
  [KIND_FEATHER]: { w: 30, h: 30 },
};

/** Pans hang from the ceiling: their box starts near the top of the field. */
const PAN_TOP = 110;
/** A thrown knife flies at the turkey's chest: jump it or duck under it. */
const KNIFE_Y = FIELD.groundY - 66;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(random) {
  const turkey = {
    y: 0, vy: 0, onGround: true, sliding: false,
    dashTimer: 0, dashCooldown: 0, invulnerable: 0, runPhase: 0,
  };
  const farmer = { gap: FARMER.startGap, searching: 0, throwTimer: 2.5, spotted: false };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({ active: false, kind: KIND_FENCE, x: 0, y: 0, w: 0, h: 0, vx: 0, passed: false, spent: false, hid: false });
  }
  const popups = [];
  const state = {
    turkey, farmer, items, popups,
    scroll: 0, distance: 0, score: 0, lives: LIVES, combo: 0,
    zone: 0, zoneBanner: 0, elapsed: 0, speed: SPEED.base,
    spawnAcc: 0, nextGap: 420, over: false, escaped: false, muted: false,
  };

  function reset() {
    turkey.y = 0;
    turkey.vy = 0;
    turkey.onGround = true;
    turkey.sliding = false;
    turkey.dashTimer = 0;
    turkey.dashCooldown = 0;
    turkey.invulnerable = 0;
    turkey.runPhase = 0;
    farmer.gap = FARMER.startGap;
    farmer.searching = 0;
    farmer.throwTimer = 2.5;
    farmer.spotted = false;
    for (const item of items) {
      item.active = false;
      item.spent = false;
      item.hid = false;
    }
    popups.length = 0;
    state.scroll = 0;
    state.distance = 0;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.zone = 0;
    state.zoneBanner = 0;
    state.elapsed = 0;
    state.speed = SPEED.base;
    state.spawnAcc = 0;
    state.nextGap = 420;
    state.over = false;
    state.escaped = false;
  }

  function freeItem() {
    for (let index = 0; index < items.length; index += 1) {
      if (!items[index].active) return items[index];
    }
    return null;
  }

  function place(kind, x, yOffset) {
    const item = freeItem();
    if (item === null) return null;
    const dims = DIMS[kind];
    item.active = true;
    item.kind = kind;
    item.w = dims.w;
    item.h = dims.h;
    item.x = x;
    item.y = kind === KIND_PAN ? PAN_TOP : FIELD.groundY - dims.h - (yOffset || 0);
    item.vx = kind === KIND_KNIFE ? 320 : 0;
    item.passed = false;
    item.spent = false;
    item.hid = false;
    return item;
  }

  function zoneIndex(distance) {
    for (let i = 0; i < ZONES.length; i += 1) {
      if (distance < ZONES[i].until) return i;
    }
    return ZONES.length - 1;
  }

  /** One hazard, one hiding haystack, or a line of corn to chase. */
  function spawnPattern() {
    const zone = state.zone;
    const roll = random();
    const x = FIELD.width + 60;
    if (roll < 0.24) {
      // A line of corn on the ground, worth chasing.
      for (let i = 0; i < 4; i += 1) place(KIND_CORN, x + i * 48, 0);
    } else if (roll < 0.34) {
      // Corn in a jump arc: jump through it to collect it all.
      const heights = [0, 55, 95, 55, 0];
      for (let i = 0; i < heights.length; i += 1) place(KIND_CORN, x + i * 52, heights[i]);
    } else if (roll < 0.42) {
      place(KIND_HAYSTACK, x, 0);
    } else if (roll < 0.48) {
      place(KIND_FEATHER, x, 150);
    } else if (zone === 2 && roll < 0.66) {
      place(KIND_OVEN, x, 0);
    } else if (zone === 2 && roll < 0.76) {
      place(KIND_PAN, x, 0);
    } else if (roll < 0.86) {
      place(KIND_FENCE, x, 0);
    } else if (roll < 0.94) {
      place(KIND_HAYBALE, x, 0);
    } else {
      place(KIND_PUMPKIN, x, 0);
    }
  }

  function turkeyBox() {
    const height = turkey.sliding ? TURKEY.slideHeight : TURKEY.height;
    return {
      x: TURKEY.x, y: FIELD.groundY - height - turkey.y,
      w: TURKEY.width, h: height,
    };
  }

  function popup(text, color) {
    popups.push({ text, color, ttl: 1.4, x: TURKEY.x + 40, y: FIELD.groundY - 130 - turkey.y });
    if (popups.length > 4) popups.shift();
  }

  /**
   * One fixed step. `control` is { jump, slide, dash } for this step.
   * With `harmless` set (the title screen's backdrop) things scroll but
   * nothing touches the turkey, the farmer never catches it and nothing
   * scores.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;

    const dashing = turkey.dashTimer > 0;
    state.speed = Math.min(SPEED.max, SPEED.base + SPEED.perSecond * state.elapsed)
      * (dashing ? DASH.multiplier : 1);

    // The turkey's own motion: jump, fall, slide, dash.
    if (control.dash && turkey.dashCooldown <= 0 && turkey.onGround) {
      turkey.dashTimer = DASH.time;
      turkey.dashCooldown = DASH.cooldown;
    }
    if (turkey.dashTimer > 0) turkey.dashTimer -= dt;
    if (turkey.dashCooldown > 0) turkey.dashCooldown -= dt;
    if (control.jump && turkey.onGround) {
      turkey.vy = TURKEY.jumpVelocity;
      turkey.onGround = false;
    }
    turkey.sliding = control.slide && turkey.onGround;
    if (!turkey.onGround) {
      turkey.vy -= TURKEY.gravity * dt;
      turkey.y += turkey.vy * dt;
      if (turkey.y <= 0) {
        turkey.y = 0;
        turkey.vy = 0;
        turkey.onGround = true;
      }
    }
    turkey.runPhase += dt * (state.speed / 40);
    if (turkey.invulnerable > 0) turkey.invulnerable = Math.max(0, turkey.invulnerable - dt);

    // The world scrolls; distance and score grow with it.
    state.scroll += state.speed * dt;
    const metres = state.scroll / PX_PER_METRE;
    if (!harmless) {
      state.distance = metres;
      state.score += (state.speed * dt / PX_PER_METRE) * SCORE.perMetre;
    }

    // Zones: the farmyard, the cornfield, then the kitchen.
    const zone = zoneIndex(state.distance);
    if (zone !== state.zone) {
      state.zone = zone;
      state.zoneBanner = 2.2;
      events |= EVENT_ZONE;
    }
    if (state.zoneBanner > 0) state.zoneBanner -= dt;

    // The farmer: he creeps closer unless the turkey outruns him, dashes,
    // grabs corn or hides in a haystack. While he searches, he stands still.
    if (farmer.searching > 0) {
      farmer.searching -= dt;
    } else if (!harmless) {
      farmer.gap += ((state.speed - SPEED.base) * 0.12 - FARMER.creep) * dt;
    }
    farmer.gap = Math.min(FARMER.maxGap, Math.max(0, farmer.gap));
    if (!harmless && farmer.gap <= 0) {
      state.over = true;
      return EVENT_OVER;
    }
    if (!harmless && !farmer.spotted && farmer.gap < 130) {
      farmer.spotted = true;
      events |= EVENT_SPOTTED;
    }
    if (farmer.spotted && farmer.gap > 200) farmer.spotted = false;

    // The farmer hurls a carving knife when the turkey is in range — but
    // never while the turkey is about to jump a fence or an oven: a knife
    // mid-jump would be impossible to dodge fairly.
    farmer.throwTimer -= dt;
    if (farmer.throwTimer <= 0) {
      farmer.throwTimer = state.zone === 2 ? FARMER.throwIntervalKitchen : FARMER.throwInterval;
      if (!harmless && farmer.gap < 430) {
        let jumpAhead = false;
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (!item.active) continue;
          const kind = item.kind;
          const jumpable = kind === KIND_FENCE || kind === KIND_HAYBALE || kind === KIND_PUMPKIN || kind === KIND_OVEN;
          if (jumpable && item.x > TURKEY.x && item.x - TURKEY.x < 520) {
            jumpAhead = true;
            break;
          }
        }
        if (!jumpAhead) {
          const knife = place(KIND_KNIFE, TURKEY.x - farmer.gap + 40, 0);
          if (knife !== null) knife.y = KNIFE_Y;
        } else {
          farmer.throwTimer = 0.8;
        }
      }
    }

    // New hazards and pickups arrive ahead of the turkey.
    state.spawnAcc += state.speed * dt;
    if (state.spawnAcc >= state.nextGap) {
      spawnPattern();
      state.spawnAcc = 0;
      state.nextGap = SPAWN.minGap + random() * SPAWN.jitter;
    }

    const box = turkeyBox();
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      item.x -= (state.speed + item.vx) * dt;
      if (item.x + item.w < -60) {
        item.active = false;
        continue;
      }
      if (harmless || item.spent) continue;
      if (!overlaps(item, box)) continue;
      if (item.kind === KIND_CORN) {
        item.active = false;
        state.score += SCORE.corn;
        state.combo += 1;
        farmer.gap = Math.min(FARMER.maxGap, farmer.gap + 3);
        events |= EVENT_CORN;
      } else if (item.kind === KIND_FEATHER) {
        item.active = false;
        state.score += SCORE.feather;
        farmer.gap = Math.min(FARMER.maxGap, farmer.gap + 8);
        popup('Golden feather! +25', '#f6d365');
        events |= EVENT_FEATHER;
      } else if (item.kind === KIND_HAYSTACK) {
        if (!item.hid && turkey.onGround) {
          item.hid = true;
          state.score += SCORE.hide;
          farmer.gap = Math.min(FARMER.maxGap, farmer.gap + 130);
          farmer.searching = FARMER.searchTime;
          popup('HIDDEN! +15', '#8fd694');
          events |= EVENT_HIDE;
        }
      } else if (turkey.invulnerable === 0 && turkey.dashTimer === 0) {
        item.spent = true;
        state.lives -= 1;
        state.combo = 0;
        turkey.invulnerable = TURKEY.invulnerable;
        farmer.gap = Math.max(0, farmer.gap - 55);
        popup('OUCH!', '#ff5a3c');
        events |= EVENT_HIT;
        if (state.lives === 0) {
          state.over = true;
          return events | EVENT_OVER;
        }
      }
    }

    // Popups float up and fade.
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].ttl -= dt;
      popups[i].y -= 26 * dt;
      if (popups[i].ttl <= 0) popups.splice(i, 1);
    }

    if (!harmless && state.distance >= ESCAPE_DISTANCE) {
      state.escaped = true;
      return events | EVENT_ESCAPED;
    }
    return events;
  }

  reset();
  return { state, reset, step, zoneIndex };
}
