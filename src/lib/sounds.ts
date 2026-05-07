/**
 * WebAudio helpers for timer feedback (call from a user gesture for best autoplay behavior).
 */

export function startWarmNoise(): () => void {
  const ctx = new AudioContext();
  const bufferSize = 4 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 820;
  lp.Q.value = 0.7;

  const warm = ctx.createBiquadFilter();
  warm.type = "peaking";
  warm.frequency.value = 420;
  warm.gain.value = 4;
  warm.Q.value = 0.6;

  const g = ctx.createGain();
  g.gain.value = 0.075;

  src.connect(lp).connect(warm).connect(g).connect(ctx.destination);
  src.start();

  return () => {
    try {
      src.stop();
    } catch {
      /* ignore */
    }
    void ctx.close();
  };
}

export async function playWarmCompleteChime(): Promise<void> {
  const ctx = new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;

  o.type = "triangle";
  o.frequency.setValueAtTime(196, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(392, ctx.currentTime + 0.12);
  o.frequency.exponentialRampToValueAtTime(294, ctx.currentTime + 0.32);

  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);

  o.connect(g).connect(filter).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.52);
  await new Promise((r) => setTimeout(r, 560));
  await ctx.close();
}
