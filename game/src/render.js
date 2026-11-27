// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the
// margin filled with the backdrop colour. Flat shapes and gradients paint
// the turkey, the chasing farmer, the farmyard, the cornfield and the
// kitchen; canvas text paints the HUD and the panels. Text that holds a
// number is rebuilt only when the number changes, so a frame allocates
// almost nothing.
import { ESCAPE_DISTANCE, FIELD, FONT, LIVES, PALETTE, TURKEY } from './config.js';
import {
  KIND_CORN, KIND_FENCE, KIND_FEATHER, KIND_HAYBALE, KIND_HAYSTACK,
  KIND_KNIFE, KIND_OVEN, KIND_PAN, KIND_PUMPKIN,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ESCAPED = 'escaped';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const HEART = { size: 22, gap: 8 };
const ZONE_NAMES = ['Farmyard', 'Cornfield', 'Kitchen'];

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const distanceLabel = cachedLabel('');
  const comboLabel = cachedLabel('Combo x');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function zonePalette(zone) {
    return zone === 0 ? PALETTE.farmyard : zone === 1 ? PALETTE.cornfield : PALETTE.kitchen;
  }

  function drawSky(state, pal) {
    if (state.zone === 2) {
      // The kitchen is indoors: a warm tiled wall with a window onto the yard.
      context.fillStyle = pal.skyBottom;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.fillStyle = 'rgba(255, 246, 230, 0.10)';
      for (let x = 0; x < FIELD.width; x += 64) context.fillRect(x, 0, 2, FIELD.groundY);
      for (let y = 0; y < FIELD.groundY; y += 64) context.fillRect(0, y, FIELD.width, 2);
      const winX = 880;
      const winY = 90;
      const winW = 300;
      const winH = 220;
      const skyGrad = context.createLinearGradient(0, winY, 0, winY + winH);
      skyGrad.addColorStop(0, '#ffd9a0');
      skyGrad.addColorStop(1, '#ff9e6d');
      context.fillStyle = skyGrad;
      context.fillRect(winX, winY, winW, winH);
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(winX + 220, winY + 50, 30, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 246, 230, 0.9)';
      context.beginPath();
      context.ellipse(winX + 80, winY + 80, 52, 16, 0, 0, Math.PI * 2);
      context.ellipse(winX + 150, winY + 150, 60, 18, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#2e2118';
      context.lineWidth = 10;
      context.strokeRect(winX, winY, winW, winH);
      context.beginPath();
      context.moveTo(winX + winW / 2, winY);
      context.lineTo(winX + winW / 2, winY + winH);
      context.moveTo(winX, winY + winH / 2);
      context.lineTo(winX + winW, winY + winH / 2);
      context.stroke();
      return;
    }
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, pal.skyTop);
    gradient.addColorStop(1, pal.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The sun rides high and never scrolls.
    context.fillStyle = pal.sun;
    context.beginPath();
    context.arc(1120, 96, 46, 0, Math.PI * 2);
    context.fill();
    // Clouds drift at a tenth of the world's speed.
    context.fillStyle = 'rgba(255, 246, 230, 0.85)';
    for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 430 - state.scroll * 0.1) % 1400 + 1400) % 1400 - 60;
      const cy = 70 + i * 42;
      context.beginPath();
      context.ellipse(cx, cy, 64, 20, 0, 0, Math.PI * 2);
      context.ellipse(cx + 44, cy + 8, 46, 16, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHills(state, pal) {
    // No hills indoors: the kitchen wall is the whole backdrop.
    if (state.zone === 2) return;
    context.fillStyle = pal.hillFar;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    for (let x = 0; x <= FIELD.width; x += 80) {
      const hill = Math.sin((x + state.scroll * 0.25) * 0.006) * 46;
      context.lineTo(x, FIELD.groundY - 90 - hill);
    }
    context.lineTo(FIELD.width, FIELD.groundY);
    context.closePath();
    context.fill();
    // The red barn sits on the far hill and scrolls past slowly.
    const barnX = ((560 - state.scroll * 0.25) % 1600 + 1600) % 1600 - 160;
    context.fillStyle = pal.barn;
    context.fillRect(barnX, FIELD.groundY - 190, 150, 100);
    context.fillStyle = pal.barnRoof;
    context.beginPath();
    context.moveTo(barnX - 12, FIELD.groundY - 190);
    context.lineTo(barnX + 75, FIELD.groundY - 240);
    context.lineTo(barnX + 162, FIELD.groundY - 190);
    context.closePath();
    context.fill();
    context.fillStyle = '#fff6e6';
    context.fillRect(barnX + 58, FIELD.groundY - 160, 34, 70);
    context.fillStyle = pal.hillNear;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    for (let x = 0; x <= FIELD.width; x += 80) {
      const hill = Math.sin((x + state.scroll * 0.5) * 0.008 + 2) * 30;
      context.lineTo(x, FIELD.groundY - 34 - hill);
    }
    context.lineTo(FIELD.width, FIELD.groundY);
    context.closePath();
    context.fill();
  }

  function drawGround(state, pal) {
    context.fillStyle = pal.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = pal.groundTop;
    context.fillRect(0, FIELD.groundY, FIELD.width, 10);
    if (state.zone === 2) {
      // A kitchen floor: a dark skirting board instead of a fence.
      context.fillStyle = '#2e2118';
      context.fillRect(0, FIELD.groundY - 14, FIELD.width, 14);
      return;
    }
    // Fence posts and corn stalks scroll past at full speed.
    for (let x = -((state.scroll % 120) + 120) % 120; x < FIELD.width; x += 120) {
      context.fillStyle = pal.fence;
      context.fillRect(x, FIELD.groundY - 44, 8, 44);
      context.fillRect(x, FIELD.groundY - 40, 120, 6);
      context.fillRect(x, FIELD.groundY - 24, 120, 6);
    }
    if (state.zone === 1) {
      context.fillStyle = pal.corn;
      for (let x = -((state.scroll % 90) + 90) % 90; x < FIELD.width; x += 90) {
        context.fillRect(x + 30, FIELD.groundY - 96, 5, 96);
        context.beginPath();
        context.ellipse(x + 32, FIELD.groundY - 108, 10, 26, 0.3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  /** A carving knife, point forward, flying at the turkey's chest. */
  function drawKnife(item) {
    context.fillStyle = PALETTE.knifeHandle;
    context.fillRect(item.x, item.y + 2, 14, 12);
    context.fillStyle = PALETTE.knifeBlade;
    context.beginPath();
    context.moveTo(item.x + 14, item.y);
    context.lineTo(item.x + item.w, item.y + item.h / 2);
    context.lineTo(item.x + 14, item.y + item.h);
    context.closePath();
    context.fill();
  }

  function drawOven(item) {
    context.fillStyle = PALETTE.ovenBody;
    context.fillRect(item.x, item.y, item.w, item.h);
    context.fillStyle = '#23262c';
    context.fillRect(item.x + 10, item.y + 14, item.w - 20, item.h - 50);
    // Fire licks out of the open oven door.
    const flicker = Math.sin(item.x * 0.05 + performance.now() / 90) * 4;
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = PALETTE.ovenFire[i];
      context.beginPath();
      context.moveTo(item.x + 18 + i * 24, item.y + item.h - 34);
      context.quadraticCurveTo(item.x + 30 + i * 24, item.y + item.h - 70 - flicker, item.x + 42 + i * 24, item.y + item.h - 34);
      context.closePath();
      context.fill();
    }
    context.fillStyle = PALETTE.ovenGlow;
    context.fillRect(item.x + 8, item.y + 4, item.w - 16, 6);
  }

  function drawPan(item) {
    context.strokeStyle = '#2b2118';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(item.x + item.w / 2, 0);
    context.lineTo(item.x + item.w / 2, item.y);
    context.stroke();
    context.fillStyle = '#3a3f47';
    context.beginPath();
    context.arc(item.x + item.w / 2, item.y + 18, item.w / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#23262c';
    context.beginPath();
    context.arc(item.x + item.w / 2, item.y + 18, item.w / 2 - 8, 0, Math.PI * 2);
    context.fill();
  }

  function drawHaystack(item, front) {
    const cx = item.x + item.w / 2;
    const base = item.y + item.h;
    context.fillStyle = front ? PALETTE.hay : PALETTE.hayDark;
    context.beginPath();
    context.moveTo(item.x, base);
    context.quadraticCurveTo(cx, item.y - 14, item.x + item.w, base);
    context.closePath();
    context.fill();
    if (!front) {
      context.strokeStyle = PALETTE.hay;
      context.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        context.beginPath();
        context.moveTo(item.x + 18 + i * 24, base - 8);
        context.quadraticCurveTo(item.x + 26 + i * 24, base - 44, item.x + 34 + i * 24, base - 52);
        context.stroke();
      }
    }
  }

  function drawFence(item) {
    context.fillStyle = PALETTE.farmyard.fence;
    context.fillRect(item.x, item.y, 8, item.h);
    context.fillRect(item.x + item.w - 8, item.y, 8, item.h);
    context.fillRect(item.x, item.y + 10, item.w, 8);
    context.fillRect(item.x, item.y + 34, item.w, 8);
  }

  function drawHayBale(item) {
    context.fillStyle = PALETTE.hay;
    context.beginPath();
    context.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.hayDark;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2 - 8, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPumpkin(item) {
    context.fillStyle = PALETTE.pumpkin;
    context.beginPath();
    context.ellipse(item.x + item.w / 2, item.y + item.h / 2 + 4, item.w / 2, item.h / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.pumpkinStem;
    context.fillRect(item.x + item.w / 2 - 4, item.y - 6, 8, 12);
    context.fillStyle = '#2b1a10';
    context.fillRect(item.x + 10, item.y + 12, 6, 6);
    context.fillRect(item.x + item.w - 16, item.y + 12, 6, 6);
  }

  function drawCorn(item) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    context.fillStyle = PALETTE.cornHusk;
    context.beginPath();
    context.moveTo(cx - 12, cy + 12);
    context.lineTo(cx - 4, cy - 12);
    context.lineTo(cx + 4, cy + 12);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.cornCob;
    context.beginPath();
    context.ellipse(cx, cy, 8, 12, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawFeather(item) {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const bob = Math.sin(performance.now() / 300 + item.x * 0.01) * 4;
    context.fillStyle = PALETTE.feather;
    context.beginPath();
    context.ellipse(cx, cy + bob, 7, 14, 0.4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#b8860b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx - 4, cy + bob + 12);
    context.lineTo(cx + 4, cy + bob - 12);
    context.stroke();
  }

  /** The turkey: a brown body under a fan of autumn tail feathers, running hard. */
  function drawTurkey(state) {
    const turkey = state.turkey;
    const cx = TURKEY.x + TURKEY.width / 2;
    const base = FIELD.groundY - turkey.y;
    const run = Math.sin(turkey.runPhase) * 5;
    const slide = turkey.sliding;
    const bodyH = slide ? TURKEY.slideHeight : TURKEY.height;
    const bodyY = base - bodyH;
    // Blink while invulnerable after a hit.
    if (turkey.invulnerable > 0 && Math.floor(turkey.invulnerable * 10) % 2 === 0) return;
    // Tail fan: full and fanned while running, flattened low while sliding.
    const fanScale = slide ? 0.5 : 1;
    const fanY = base - bodyH * (slide ? 0.3 : 0.5);
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = PALETTE.turkeyTail[i];
      context.beginPath();
      context.arc(cx - 18, fanY, TURKEY.width * (0.55 - i * 0.11) * fanScale, Math.PI * 0.7, Math.PI * 1.9);
      context.fill();
    }
    // Body.
    context.fillStyle = PALETTE.turkeyBody;
    context.beginPath();
    context.ellipse(cx, base - bodyH * 0.45, TURKEY.width * 0.36, bodyH * 0.5, slide ? -0.35 : -0.08, 0, Math.PI * 2);
    context.fill();
    // Wing.
    context.fillStyle = PALETTE.turkeyDark;
    context.beginPath();
    context.ellipse(cx - 4, base - bodyH * 0.5, 14, 9, slide ? -0.5 : -0.3 + run * 0.02, 0, Math.PI * 2);
    context.fill();
    if (!slide) {
      // Head, beak and wattle, bobbing with the run.
      const headY = base - bodyH - 12 + run * 0.4;
      context.fillStyle = PALETTE.turkeyHead;
      context.beginPath();
      context.arc(cx + 18, headY, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.turkeyBeak;
      context.beginPath();
      context.moveTo(cx + 27, headY - 2);
      context.lineTo(cx + 40, headY + 3);
      context.lineTo(cx + 27, headY + 7);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.turkeyWattle;
      context.beginPath();
      context.ellipse(cx + 24, headY + 10, 4, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b1a10';
      context.beginPath();
      context.arc(cx + 21, headY - 3, 2, 0, Math.PI * 2);
      context.fill();
      // Legs, mid-stride.
      context.strokeStyle = PALETTE.turkeyLeg;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(cx - 6, base - 6);
      context.lineTo(cx - 6 + run, base);
      context.moveTo(cx + 8, base - 6);
      context.lineTo(cx + 8 - run, base);
      context.stroke();
    } else {
      // Ducked low: head stretched forward and up, tail tucked behind.
      context.fillStyle = PALETTE.turkeyHead;
      context.beginPath();
      context.arc(cx + 30, base - 26, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.turkeyBeak;
      context.beginPath();
      context.moveTo(cx + 39, base - 29);
      context.lineTo(cx + 52, base - 24);
      context.lineTo(cx + 39, base - 20);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.turkeyWattle;
      context.beginPath();
      context.ellipse(cx + 36, base - 16, 4, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b1a10';
      context.beginPath();
      context.arc(cx + 33, base - 29, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  /** The farmer, chasing from behind: overalls, straw hat, reaching arm. */
  function drawFarmer(state) {
    const farmer = state.farmer;
    const x = TURKEY.x - farmer.gap - 30;
    if (x + 90 < 0) return;
    const base = FIELD.groundY;
    const run = Math.sin(state.turkey.runPhase * 1.15) * 6;
    const searching = farmer.searching > 0;
    // Legs.
    context.strokeStyle = PALETTE.farmerOveralls;
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(x + 30, base - 52);
    context.lineTo(x + 30 + run, base);
    context.moveTo(x + 44, base - 52);
    context.lineTo(x + 44 - run, base);
    context.stroke();
    // Body: overalls over a checked shirt.
    context.fillStyle = PALETTE.farmerShirt;
    context.fillRect(x + 18, base - 108, 40, 58);
    context.fillStyle = PALETTE.farmerOveralls;
    context.fillRect(x + 22, base - 96, 32, 48);
    // Reaching arm.
    context.strokeStyle = PALETTE.farmerShirt;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(x + 52, base - 96);
    context.lineTo(x + 78, base - 88 + run * 0.5);
    context.stroke();
    // Head and straw hat.
    context.fillStyle = PALETTE.farmerSkin;
    context.beginPath();
    context.arc(x + 38, base - 122, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerHat;
    context.beginPath();
    context.ellipse(x + 38, base - 132, 24, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(x + 24, base - 150, 28, 16);
    // Beard.
    context.fillStyle = '#e8e0d0';
    context.beginPath();
    context.ellipse(x + 44, base - 112, 9, 7, 0, 0, Math.PI * 2);
    context.fill();
    if (searching) {
      text('?', x + 38, base - 176, 34, PALETTE.text, 'center');
    }
  }

  function drawItems(state) {
    const items = state.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      if (item.kind === KIND_HAYSTACK) drawHaystack(item, false);
      else if (item.kind === KIND_FENCE) drawFence(item);
      else if (item.kind === KIND_HAYBALE) drawHayBale(item);
      else if (item.kind === KIND_PUMPKIN) drawPumpkin(item);
      else if (item.kind === KIND_OVEN) drawOven(item);
      else if (item.kind === KIND_PAN) drawPan(item);
      else if (item.kind === KIND_KNIFE) drawKnife(item);
      else if (item.kind === KIND_CORN) drawCorn(item);
      else if (item.kind === KIND_FEATHER) drawFeather(item);
    }
  }

  /** A haystack the turkey is inside gets a front tuft, so it reads as hiding. */
  function drawHayFront(state) {
    const box = {
      x: TURKEY.x, y: FIELD.groundY - TURKEY.height - state.turkey.y,
      w: TURKEY.width, h: TURKEY.height,
    };
    for (let index = 0; index < state.items.length; index += 1) {
      const item = state.items[index];
      if (!item.active || item.kind !== KIND_HAYSTACK) continue;
      if (item.x < box.x + box.w && item.x + item.w > box.x && state.turkey.onGround) {
        drawHaystack(item, true);
      }
    }
  }

  function drawHud(state, muted) {
    // A dark band behind the HUD so white text reads on any sky.
    context.fillStyle = 'rgba(24, 14, 8, 0.45)';
    context.fillRect(0, 0, FIELD.width, 134);
    const pal = zonePalette(state.zone);
    context.textBaseline = 'top';
    text(scoreLabel(Math.floor(state.score)), 24, 18, 30, PALETTE.text, 'left', 'top');
    const dist = Math.floor(state.distance);
    text(distanceLabel(`${dist}m / ${ESCAPE_DISTANCE}m`), 24, 56, 22, PALETTE.muted, 'left', 'top');
    // Escape progress bar under the distance.
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(24, 86, 220, 12);
    context.fillStyle = '#8fd694';
    context.fillRect(24, 86, 220 * Math.min(1, state.distance / ESCAPE_DISTANCE), 12);
    // Zone, centred.
    text(ZONE_NAMES[state.zone], FIELD.width / 2, 18, 28, PALETTE.text, 'center', 'top');
    // Hearts, top right.
    const firstHeart = FIELD.width - 24 - LIVES * (HEART.size + HEART.gap) + HEART.gap;
    for (let life = 0; life < LIVES; life += 1) {
      const hx = firstHeart + life * (HEART.size + HEART.gap);
      const hy = 22;
      context.fillStyle = life < state.lives ? PALETTE.heart : PALETTE.heartEmpty;
      context.beginPath();
      context.moveTo(hx + 11, hy + 20);
      context.bezierCurveTo(hx - 4, hy + 8, hx + 2, hy - 4, hx + 11, hy + 4);
      context.bezierCurveTo(hx + 20, hy - 4, hx + 26, hy + 8, hx + 11, hy + 20);
      context.fill();
    }
    // Farmer proximity: a bar that burns red as he closes in.
    const meterW = 220;
    const meterX = FIELD.width - 24 - meterW;
    const meterY = 62;
    text('FARMER', meterX - 8, meterY - 2, 18, state.farmer.gap < 130 ? PALETTE.warning : PALETTE.muted, 'right', 'top');
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(meterX, meterY, meterW, 12);
    const closeness = 1 - state.farmer.gap / 460;
    context.fillStyle = closeness > 0.75 ? PALETTE.warning : closeness > 0.45 ? '#f2a541' : '#8fd694';
    context.fillRect(meterX, meterY, meterW * closeness, 12);
    if (state.farmer.gap < 130) {
      context.fillStyle = 'rgba(24, 14, 8, 0.55)';
      const warn = "HE'S RIGHT BEHIND YOU!";
      context.font = `26px ${FONT}`;
      const warnW = context.measureText(warn).width;
      context.fillRect(FIELD.width / 2 - warnW / 2 - 14, 94, warnW + 28, 38);
      text(warn, FIELD.width / 2, 100, 26, PALETTE.warning, 'center', 'top');
    }
    // Combo and dash.
    if (state.combo >= 3) {
      text(comboLabel(state.combo), FIELD.width / 2, 56, 24, '#f6d365', 'center', 'top');
    }
    if (state.turkey.dashCooldown > 0) {
      text('Dash…', 24, 108, 18, PALETTE.muted, 'left', 'top');
    } else {
      text('Dash ready — Shift', 24, 108, 18, '#8fd694', 'left', 'top');
    }
    if (muted) text('Muted (M)', FIELD.width - 24, 108, 18, PALETTE.muted, 'right', 'top');
    // Zone banner.
    if (state.zoneBanner > 0) {
      const alpha = Math.min(1, state.zoneBanner);
      context.globalAlpha = alpha;
      text(ZONE_NAMES[state.zone], FIELD.width / 2, 220, 64, PALETTE.text, 'center', 'top');
      text(state.zone === 2 ? 'Dodge the ovens — the kitchen is the last stretch!' : 'Keep running!', FIELD.width / 2, 300, 26, PALETTE.muted, 'center', 'top');
      context.globalAlpha = 1;
    }
    // Popups.
    for (let i = 0; i < state.popups.length; i += 1) {
      const pop = state.popups[i];
      context.globalAlpha = Math.min(1, pop.ttl);
      text(pop.text, pop.x, pop.y, 24, pop.color, 'center', 'top');
      context.globalAlpha = 1;
    }
    void pal;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20, 12, 8, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 4;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.cornCob, 'center');
  }

  /** Paint one frame: the field, the farmer, the turkey, then the HUD or a panel. */
  function draw(state, screen, best, muted) {
    const pal = zonePalette(state.zone);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state, pal);
    drawHills(state, pal);
    drawGround(state, pal);
    drawItems(state);
    drawFarmer(state);
    drawTurkey(state);
    drawHayFront(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'GOBBLE RUN',
        ['The Great Turkey Escape', '', 'Thanksgiving is coming — and you are the dinner.', 'Outrun the farmer from the farmyard to the kitchen,', 'jump the fences, duck the carving knives, hide in the hay,', 'and reach the forest 600m away to escape.', '', 'Jump: Space / ↑ / click    Duck: ↓    Dash: Shift    Pause: P', bestLabel(best)],
        'Press Space or click to start',
      );
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The farmer waits for no turkey — but he will wait for you.'], 'Press P to keep running');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'CAUGHT FOR DINNER!',
        ['', `The farmer got you at ${Math.floor(state.distance)}m.`, finalLabel(Math.floor(state.score)), bestLabel(best)],
        'Press Space or click to run again',
        PALETTE.warning,
      );
    } else if (screen === SCREEN_ESCAPED) {
      drawPanel(
        'ESCAPED!',
        ['', `You made it ${ESCAPE_DISTANCE}m to the forest — free at last!`, finalLabel(Math.floor(state.score)), bestLabel(best)],
        'Press Space or click to run again',
        '#8fd694',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
