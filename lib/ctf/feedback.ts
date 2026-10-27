'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tiny sound + haptics layer for the interactive labs.
 *
 * - Sound uses the Web Audio API (short synthesized blips), so there are no
 *   audio files to ship and nothing to load.
 * - Haptics uses navigator.vibrate (Android Chrome; a no-op on iOS Safari).
 *
 * Defaults: haptics ON, sound OFF — comfortable for reading on a train.
 * Preferences persist in localStorage. All access is guarded so SSR and
 * blocked storage never throw.
 */

export type Cue = 'tap' | 'step' | 'success' | 'error';

const SOUND_KEY = 'secdigest_lab_sound';
const HAPTICS_KEY = 'secdigest_lab_haptics';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // ignore
  }
  return fallback;
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore
  }
}

// --- Web Audio (lazily created on first sound, after a user gesture) --------

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short synthesized note. Chained for multi-tone cues. */
function blip(freq: number, startOffset: number, duration: number, type: OscillatorType, gain: number) {
  const ac = audioCtx();
  if (!ac) return;
  try {
    const t = ac.currentTime + startOffset;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch {
    // ignore audio failures
  }
}

const SOUND_SPECS: Record<Cue, () => void> = {
  tap: () => blip(420, 0, 0.06, 'sine', 0.05),
  step: () => blip(660, 0, 0.09, 'triangle', 0.06),
  success: () => {
    // rising three-note arpeggio
    blip(523, 0, 0.12, 'sine', 0.07);
    blip(659, 0.1, 0.12, 'sine', 0.07);
    blip(784, 0.2, 0.2, 'sine', 0.08);
  },
  error: () => blip(180, 0, 0.16, 'sawtooth', 0.05),
};

const VIBE_SPECS: Record<Cue, number | number[]> = {
  tap: 8,
  step: 14,
  success: [12, 40, 24],
  error: [30, 30, 30],
};

// --- preference store (shared across hook instances) -----------------------

interface Prefs {
  sound: boolean;
  haptics: boolean;
}

let prefs: Prefs | null = null;
const prefListeners = new Set<() => void>();

function getPrefs(): Prefs {
  if (!prefs) {
    prefs = {
      sound: readBool(SOUND_KEY, false),
      haptics: readBool(HAPTICS_KEY, true),
    };
  }
  return prefs;
}

function setPref(patch: Partial<Prefs>) {
  prefs = { ...getPrefs(), ...patch };
  if (patch.sound !== undefined) writeBool(SOUND_KEY, patch.sound);
  if (patch.haptics !== undefined) writeBool(HAPTICS_KEY, patch.haptics);
  prefListeners.forEach((fn) => fn());
}

/** Fire a cue, honoring the current preferences. Safe to call anywhere. */
export function playCue(cue: Cue) {
  const p = getPrefs();
  if (p.sound) {
    try {
      SOUND_SPECS[cue]();
    } catch {
      // ignore
    }
  }
  // Browsers block (and log) vibrate() before the first real tap on the page.
  const activated = typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (p.haptics && activated && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(VIBE_SPECS[cue]);
    } catch {
      // ignore
    }
  }
}

/**
 * React hook exposing current prefs, setters, and a `cue` fire function.
 * `vibrateSupported` lets the UI hide the haptics toggle where it does nothing.
 */
export function useFeedback() {
  const [state, setState] = useState<Prefs>({ sound: false, haptics: true });

  useEffect(() => {
    setState(getPrefs());
    const fn = () => setState({ ...getPrefs() });
    prefListeners.add(fn);
    return () => {
      prefListeners.delete(fn);
    };
  }, []);

  const setSound = useCallback((v: boolean) => {
    setPref({ sound: v });
    if (v) {
      // warm up the audio context during this gesture and confirm audibly
      playCue('tap');
    }
  }, []);

  const setHaptics = useCallback((v: boolean) => {
    setPref({ haptics: v });
    if (v) playCue('tap');
  }, []);

  const cue = useCallback((c: Cue) => playCue(c), []);

  const vibrateSupported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  return {
    sound: state.sound,
    haptics: state.haptics,
    setSound,
    setHaptics,
    cue,
    vibrateSupported,
  };
}
