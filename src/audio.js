(function (global) {
  "use strict";

  class StreetKingsAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.engineGain = null;
      this.engineOsc = null;
      this.engineOsc2 = null;
      this.filter = null;
      this.muted = false;
      this.engineOn = false;
      try {
        this.muted = global.localStorage.getItem("streetKingsMuted") === "1";
      } catch (err) {
        this.muted = false;
      }
    }

    async unlock() {
      try {
        if (!this.ctx) {
          const Ctx = global.AudioContext || global.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.32;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }
      } catch (err) {
        // Audio is optional; keep the race playable if it fails.
      }
    }

    setMuted(muted) {
      this.muted = muted;
      try {
        global.localStorage.setItem("streetKingsMuted", muted ? "1" : "0");
      } catch (err) {
        /* ignore quota / private mode */
      }
      if (this.master) {
        this.master.gain.value = muted ? 0 : 0.32;
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    ui() {
      this.beep(520, 0.07, "square", 0.08);
    }

    go() {
      this.beep(440, 0.09, "square", 0.1);
      global.setTimeout(() => this.beep(660, 0.12, "square", 0.1), 90);
    }

    nearMiss() {
      this.beep(880, 0.05, "triangle", 0.07);
      this.beep(1320, 0.08, "sine", 0.05);
    }

    beep(freq, duration, type, volume) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }

    startEngine() {
      if (!this.ctx || this.engineOn) return;
      const t = this.ctx.currentTime;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.filter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 48;
      this.engineOsc2.type = "square";
      this.engineOsc2.frequency.value = 24;
      this.filter.type = "lowpass";
      this.filter.frequency.value = 420;
      this.engineGain.gain.setValueAtTime(0.0001, t);
      this.engineGain.gain.exponentialRampToValueAtTime(0.09, t + 0.25);

      this.engineOsc.connect(this.filter);
      this.engineOsc2.connect(this.filter);
      this.filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      this.engineOn = true;
    }

    setRpm(norm) {
      if (!this.engineOn) return;
      const n = Math.max(0, Math.min(1, norm));
      this.engineOsc.frequency.value = 42 + n * 90;
      this.engineOsc2.frequency.value = 21 + n * 44;
      this.filter.frequency.value = 360 + n * 900;
      this.engineGain.gain.value = 0.06 + n * 0.07;
    }

    stopEngine() {
      if (!this.engineOn) return;
      const t = this.ctx.currentTime;
      try {
        this.engineGain.gain.cancelScheduledValues(t);
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
        this.engineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        this.engineOsc.stop(t + 0.2);
        this.engineOsc2.stop(t + 0.2);
      } catch (err) {
        /* already stopped */
      }
      this.engineOn = false;
      this.engineOsc = null;
      this.engineOsc2 = null;
    }

    crash() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const duration = 0.45;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);

      this.beep(140, 0.28, "sawtooth", 0.12);
    }
  }

  global.StreetKingsAudio = StreetKingsAudio;
})(window);
