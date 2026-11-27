// Synthesised sound, no audio files: every effect is a few oscillators and
// a burst of filtered noise through the Web Audio API. The context is made
// on the first user gesture (browsers block sound before one) and every call
// is a no-op until then, so the screenshot scenes stay silent.
export function createSound() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      const length = Math.floor(context.sampleRate * 0.25);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, freq) {
    const ctx = ensure();
    if (ctx === null || muted || noiseBuffer === null) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call from a user gesture so the browser lets sound start. */
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** The turkey's gobble: two quick low honks. */
    gobble() {
      tone(220, 0.12, 'sawtooth', 0.12, 140);
      setTimeout(() => tone(180, 0.16, 'sawtooth', 0.12, 110), 110);
    },
    jump() {
      tone(280, 0.16, 'sine', 0.14, 620);
    },
    dash() {
      noise(0.22, 0.16, 1800);
      tone(500, 0.14, 'sine', 0.08, 900);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12);
      setTimeout(() => tone(1318, 0.12, 'sine', 0.1), 70);
    },
    feather() {
      tone(660, 0.1, 'triangle', 0.14);
      setTimeout(() => tone(990, 0.1, 'triangle', 0.14), 80);
      setTimeout(() => tone(1320, 0.16, 'triangle', 0.14), 160);
    },
    hit() {
      noise(0.25, 0.25, 500);
      tone(160, 0.25, 'square', 0.14, 60);
    },
    hide() {
      tone(523, 0.1, 'sine', 0.1);
      setTimeout(() => tone(784, 0.14, 'sine', 0.1), 90);
    },
    /** The farmer spots the turkey: a short alarm. */
    alarm() {
      tone(440, 0.12, 'square', 0.09, 440);
      setTimeout(() => tone(587, 0.12, 'square', 0.09, 587), 130);
    },
    zone() {
      tone(392, 0.12, 'triangle', 0.12);
      setTimeout(() => tone(523, 0.18, 'triangle', 0.12), 110);
    },
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.14), i * 130));
    },
    click() {
      tone(700, 0.05, 'sine', 0.08);
    },
  };
}
