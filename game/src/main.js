// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, caught and escaped.
//
// ?seed=N fixes the hazard pattern. ?shot=start|play|kitchen|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CORN, EVENT_ESCAPED, EVENT_FEATHER, EVENT_HIDE, EVENT_HIT,
  EVENT_OVER, EVENT_SPOTTED, EVENT_ZONE, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE,
  createInput,
} from './input.js';
import { createSound } from './sound.js';
import {
  SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.gobble();
    announce('Running! Jump the fences, duck the knives, reach the forest 600 metres away.');
  }

  function finishGame(escaped) {
    screen = escaped ? SCREEN_ESCAPED : SCREEN_OVER;
    if (world.state.score > best) {
      best = Math.floor(world.state.score);
      saveBest(best);
    }
    if (escaped) {
      sound.win();
      announce(`Escaped! Score ${Math.floor(world.state.score)}. Best ${best}.`);
    } else {
      announce(`Caught at ${Math.floor(world.state.distance)} metres. Score ${Math.floor(world.state.score)}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_ESCAPED)) {
      startGame();
      return 0;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Running!');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { jump: false, slide: false, dash: false }, true);
      return;
    }
    const events = world.step(STEP, {
      jump: Boolean(actions & ACTION_JUMP),
      slide: input.sliding(),
      dash: Boolean(actions & ACTION_DASH),
    }, false);
    if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.lives === 1 ? 'Hit! 1 life left — the farmer is close!' : `Hit! ${world.state.lives} lives left.`);
    }
    if (events & EVENT_CORN) sound.pickup();
    if (events & EVENT_FEATHER) sound.feather();
    if (events & EVENT_HIDE) {
      sound.hide();
      announce('Hidden in the hay — the farmer lost you!');
    }
    if (events & EVENT_SPOTTED) {
      sound.alarm();
      announce("The farmer spotted you — run!");
    }
    if (events & EVENT_ZONE) {
      sound.zone();
      announce('New ground: watch for new dangers.');
    }
    if (events & EVENT_ESCAPED) finishGame(true);
    else if (events & EVENT_OVER) finishGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, sound.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting the farmer catch the turkey unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Gobble Run. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
