/**
 * XplainAI Cyber-Tactical Web Audio SFX Synthesizer
 * Pure client-side procedural audio synthesis (0 external audio assets required).
 */

class HudAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("xplainai_sfx_muted");
      this.muted = saved === "true";
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("xplainai_sfx_muted", String(muted));
    }
    if (muted) {
      this.stopHum();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Crisp high-frequency tactical HUD click
   */
  public playClick(freq = 1200): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Double-beep sci-fi telemetry data chirp
   */
  public playChirp(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Beep 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(1800, now);
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.03);

    // Beep 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(2400, now + 0.04);
    gain2.gain.setValueAtTime(0.06, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.08);
  }

  /**
   * Upward frequency laser sweep on modal/drawer activation
   */
  public playSweep(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1650, now + 0.09);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Tactical warning or focus pulse alert
   */
  public playAlert(): void {
    if (this.muted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(640, now + 0.05);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Start low sub-bass reactor ambient hum
   */
  public startHum(): void {
    if (this.muted || this.humOsc) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.humOsc = ctx.createOscillator();
    this.humGain = ctx.createGain();

    this.humOsc.type = "sine";
    this.humOsc.frequency.setValueAtTime(55, ctx.currentTime);

    this.humGain.gain.setValueAtTime(0.015, ctx.currentTime);

    this.humOsc.connect(this.humGain);
    this.humGain.connect(ctx.destination);

    this.humOsc.start();
  }

  /**
   * Stop ambient hum
   */
  public stopHum(): void {
    if (this.humOsc) {
      try {
        this.humOsc.stop();
        this.humOsc.disconnect();
      } catch {
        // ignore
      }
      this.humOsc = null;
      this.humGain = null;
    }
  }
}

export const hudAudio = new HudAudioEngine();
