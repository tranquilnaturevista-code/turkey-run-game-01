// Keyboard and pointer input for a runner. Jump and dash are one-shot
// presses, queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. Slide is a held key:
// hold Down (or S) to duck under a flying knife or a hanging pan.
export const ACTION_JUMP = 1;
export const ACTION_DASH = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const SLIDE = new Set(['ArrowDown', 'KeyS']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyX']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let slide = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP | ACTION_CONFIRM;
    } else if (SLIDE.has(event.code)) {
      slide = true;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (SLIDE.has(event.code)) slide = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    slide = false;
  });
  // A click or tap is a jump on the run, and a start/restart on the panels.
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_JUMP | ACTION_CONFIRM;
  });

  return {
    /** True while the slide key is held down. */
    sliding() {
      return slide;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
