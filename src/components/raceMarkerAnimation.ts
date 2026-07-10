import { useEffect, useState } from 'react';
import { CRITICAL_FRAME_MS, PING_PONG_FRAMES } from './raceMarkerAssets';

let listenerCount = 0;
let intervalId: number | null = null;
let frameIndex = 0;
const listeners = new Set<(frame: number) => void>();

function tick() {
  frameIndex = (frameIndex + 1) % PING_PONG_FRAMES.length;
  listeners.forEach((cb) => cb(frameIndex));
}

function start() {
  if (intervalId == null) {
    intervalId = window.setInterval(tick, CRITICAL_FRAME_MS);
  }
}

function stop() {
  if (intervalId != null && listenerCount === 0) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

export function useRaceMarkerFrame(): number {
  const [local, setLocal] = useState(frameIndex);

  useEffect(() => {
    listenerCount += 1;
    listeners.add(setLocal);
    start();
    return () => {
      listeners.delete(setLocal);
      listenerCount -= 1;
      stop();
    };
  }, []);

  return local;
}
