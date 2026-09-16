(function (global) {
  "use strict";

  const STORAGE_SCORE = "streetKingsHighScore";
  const LANES = 4;
  const TRAFFIC_PALETTE = ["#ff3355", "#ff7a1a", "#c44dff", "#3dff8a", "#4d7cff", "#ff4dd2", "#ffe14d"];
  const FLAVOR = [
    "The pack ate you alive.",
    "Neon don't wait.",
    "You blinked. The street didn't.",
    "Kings fall. Streets don't.",
    "That gap was never yours.",
  ];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }

  function loadBest() {
    try {
      return Number(global.localStorage.getItem(STORAGE_SCORE) || 0) || 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest(score) {
    try {
      global.localStorage.setItem(STORAGE_SCORE, String(score));
    } catch (err) {
      /* ignore */
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  class StreetKings {
    constructor(dom, audio) {
      this.dom = dom;
      this.audio = audio;
      this.canvas = dom.canvas;
      this.ctx = this.canvas.getContext("2d");
      this.state = "title";
      this.viewW = 0;
      this.viewH = 0;
      this.lastTime = 0;
      this.raf = 0;
      this.keys = { left: false, right: false, boost: false };
      this.best = loadBest();
      this.shake = 0;
      this.toastTimer = 0;
      this.stars = [];
      this.rain = [];
      this.leftCity = null;
      this.rightCity = null;
      this.resetRun(true);
    }

    init() {
      this.resize();
      this.buildDecor();
      this.bind();
      this.syncMuteButton();
      this.updateTitleBest();
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.loop.bind(this));
    }

    bind() {
      const onResize = () => {
        this.resize();
        this.buildDecor();
      };
      global.addEventListener("resize", onResize);
      global.addEventListener("orientationchange", onResize);

      global.addEventListener("keydown", (event) => this.onKey(event, true));
      global.addEventListener("keyup", (event) => this.onKey(event, false));

      this.dom.play.addEventListener("click", () => this.start());
      this.dom.retry.addEventListener("click", () => this.start());
      this.dom.mute.addEventListener("click", () => {
        const muted = this.audio.toggleMute();
        this.syncMuteButton();
        if (!muted) this.audio.ui();
      });

      this.bindHold(this.dom.left, "left");
      this.bindHold(this.dom.right, "right");
      this.bindHold(this.dom.nitro, "boost");

      this.canvas.addEventListener(
        "pointerdown",
        (event) => {
          if (this.state !== "playing") return;
          if (event.pointerType === "mouse") return;
          const x = event.clientX;
          if (x < this.viewW * 0.33) this.keys.left = true;
          else if (x > this.viewW * 0.66) this.keys.right = true;
          else this.keys.boost = true;
        },
        { passive: true }
      );
      const clearTouch = () => {
        this.keys.left = false;
        this.keys.right = false;
        this.keys.boost = false;
        this.dom.left.classList.remove("is-held");
        this.dom.right.classList.remove("is-held");
        this.dom.nitro.classList.remove("is-held");
      };
      global.addEventListener("pointerup", clearTouch);
      global.addEventListener("pointercancel", clearTouch);
    }

    bindHold(button, key) {
      const set = (down) => {
        this.keys[key] = down;
        button.classList.toggle("is-held", down);
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.setPointerCapture(event.pointerId);
        set(true);
      });
      button.addEventListener("pointerup", (event) => {
        event.preventDefault();
        set(false);
      });
      button.addEventListener("pointercancel", () => set(false));
      button.addEventListener("lostpointercapture", () => set(false));
    }

    onKey(event, down) {
      const code = event.code;
      const key = event.key;
      let handled = false;
      if (code === "ArrowLeft" || key === "a" || key === "A") {
        this.keys.left = down;
        handled = true;
      } else if (code === "ArrowRight" || key === "d" || key === "D") {
        this.keys.right = down;
        handled = true;
      } else if (code === "ArrowUp" || code === "ShiftLeft" || code === "ShiftRight" || key === "w" || key === "W") {
        this.keys.boost = down;
        handled = true;
      } else if (down && (code === "Enter" || code === "Space")) {
        handled = true;
        if (this.state === "title" || this.state === "gameover") this.start();
      } else if (down && (key === "m" || key === "M")) {
        this.audio.toggleMute();
        this.syncMuteButton();
        handled = true;
      }
      if (handled) event.preventDefault();
    }

    syncMuteButton() {
      this.dom.mute.classList.toggle("is-muted", this.audio.muted);
      this.dom.mute.textContent = this.audio.muted ? "×" : "♪";
      this.dom.mute.title = this.audio.muted ? "Unmute" : "Mute";
    }

    resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const w = global.innerWidth;
      const h = global.innerHeight;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.viewW = w;
      this.viewH = h;
      this.roadWidth = clamp(Math.min(420, w * 0.7), 240, 460);
      this.roadX = (w - this.roadWidth) / 2;
      this.laneW = this.roadWidth / LANES;
      if (this.player) {
        this.player.x = clamp(this.player.x, this.roadX + 28, this.roadX + this.roadWidth - 28);
        this.player.y = h * 0.78;
      }
    }

    buildDecor() {
      this.stars = Array.from({ length: 90 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: rand(0.4, 1.6),
        tw: rand(0, Math.PI * 2),
      }));
      this.rain = Array.from({ length: 110 }, () => ({
        x: Math.random() * this.viewW,
        y: Math.random() * this.viewH,
        len: rand(10, 22),
        spd: rand(520, 860),
      }));
      this.leftCity = this.makeSkyline("left");
      this.rightCity = this.makeSkyline("right");
    }

    makeSkyline(side) {
      const blocks = [];
      let y = 0;
      while (y < 2600) {
        const h = rand(70, 260);
        const w = rand(26, 78);
        const windows = [];
        const cols = Math.max(2, Math.floor(w / 10));
        const rows = Math.max(3, Math.floor(h / 16));
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            if (Math.random() > 0.62) {
              windows.push({
                c,
                r,
                lit: Math.random() > 0.18,
                color: Math.random() > 0.7 ? "#ffd08a" : "#9ad7ff",
              });
            }
          }
        }
        blocks.push({
          y,
          h,
          w,
          shade: rand(0.08, 0.2),
          neon: Math.random() > 0.72,
          neonColor: Math.random() > 0.5 ? "#3cf0ff" : "#ff2d95",
          windows,
          cols,
          rows,
          side,
        });
        y += h + rand(8, 22);
      }
      return { blocks, height: y };
    }

    resetRun(idle) {
      this.elapsed = 0;
      this.distance = 0;
      this.score = 0;
      this.baseSpeed = 280;
      this.playerSpeed = 280;
      this.spawnTimer = 0.6;
      this.nitro = 1;
      this.boosting = false;
      this.shake = 0;
      this.crashTimer = 0;
      this.goFlash = idle ? 0 : 0.9;
      this.particles = [];
      this.traffic = [];
      this.lamps = [];
      this.player = {
        x: this.viewW / 2 || 200,
        y: (this.viewH || 600) * 0.78,
        w: 44,
        h: 76,
        vx: 0,
      };
    }

    async start() {
      if (this.state === "playing" || this.state === "crashing") return;
      await this.audio.unlock();
      this.audio.ui();
      this.resetRun(false);
      this.state = "playing";
      this.dom.overlay.classList.add("hidden");
      this.dom.titleScreen.classList.add("hidden");
      this.dom.gameoverScreen.classList.add("hidden");
      this.dom.hud.classList.remove("hidden");
      this.dom.toast.classList.add("hidden");
      this.dom.record.classList.add("hidden");
      this.showTouchIfNeeded();
      this.audio.go();
      this.audio.startEngine();
      this.showToast("GO");
      this.updateHud();
    }

    showTouchIfNeeded() {
      const coarse = global.matchMedia && global.matchMedia("(pointer: coarse)").matches;
      const fine = global.matchMedia && global.matchMedia("(pointer: fine)").matches;
      this.dom.touch.classList.toggle("hidden", Boolean(fine) || !coarse);
    }

    crash() {
      if (this.state !== "playing") return;
      this.state = "crashing";
      this.crashTimer = 0.75;
      this.shake = 18;
      this.audio.stopEngine();
      this.audio.crash();
      this.burst(this.player.x, this.player.y, "#ffb347", 42);
      this.burst(this.player.x, this.player.y, "#3cf0ff", 18);
    }

    finishCrash() {
      const isRecord = this.score > this.best;
      if (isRecord) {
        this.best = this.score;
        saveBest(this.best);
      }
      this.state = "gameover";
      this.dom.hud.classList.add("hidden");
      this.dom.toast.classList.add("hidden");
      this.dom.goScore.textContent = String(this.score);
      this.dom.goDistance.textContent = Math.floor(this.distance) + " m";
      this.dom.goBest.textContent = String(this.best);
      this.dom.goFlavor.textContent = pick(FLAVOR);
      this.dom.record.classList.toggle("hidden", !isRecord);
      this.dom.gameoverScreen.classList.remove("hidden");
      this.dom.titleScreen.classList.add("hidden");
      this.dom.overlay.classList.remove("hidden");
      this.dom.touch.classList.add("hidden");
      this.updateTitleBest();
    }

    updateTitleBest() {
      this.dom.titleBest.textContent = this.best ? "Night record  " + this.best : "No record yet — first blood's yours.";
      this.dom.hudBest.textContent = String(this.best);
    }

    loop(now) {
      const raw = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = clamp(raw, 0, 0.05);
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
      const cruise = this.state === "title" || this.state === "gameover";
      const active = this.state === "playing";

      if (cruise) {
        this.playerSpeed = 160;
        this.distance += this.playerSpeed * dt * 0.35;
        this.updateRain(dt);
        this.updateParticles(dt);
        return;
      }

      if (active) {
        this.elapsed += dt;
        const difficulty = 1 - Math.exp(-this.elapsed / 42);
        this.baseSpeed = lerp(290, 760, difficulty);
        this.boosting = this.keys.boost && this.nitro > 0.04;
        if (this.boosting) {
          this.nitro = Math.max(0, this.nitro - dt * 0.42);
          this.playerSpeed = this.baseSpeed * 1.38;
        } else {
          this.nitro = Math.min(1, this.nitro + dt * 0.13);
          this.playerSpeed = this.baseSpeed;
        }
        this.distance += this.playerSpeed * dt * 0.42;
        this.score += Math.floor(this.playerSpeed * dt * 0.18);
        this.updatePlayer(dt);
        this.updateTraffic(dt, difficulty);
        this.checkCollisions();
        if (this.state === "playing") {
          this.audio.setRpm(clamp((this.playerSpeed - 280) / 500, 0, 1) + (this.boosting ? 0.2 : 0));
        }
      }

      if (this.state === "crashing") {
        this.crashTimer -= dt;
        this.updateTraffic(dt, 1);
        this.updateParticles(dt);
        this.updateRain(dt);
        this.shake *= Math.pow(0.04, dt);
        if (this.crashTimer <= 0) this.finishCrash();
        return;
      }

      this.updateParticles(dt);
      this.updateRain(dt);
      if (this.goFlash > 0) this.goFlash -= dt;
      if (this.toastTimer > 0) this.toastTimer -= dt;
      this.shake *= Math.pow(0.02, dt);
      this.updateHud();
    }

    updatePlayer(dt) {
      const accel = 2400;
      const maxV = 420;
      let ax = 0;
      if (this.keys.left) ax -= accel;
      if (this.keys.right) ax += accel;
      if (!this.keys.left && !this.keys.right) {
        this.player.vx *= Math.pow(0.0008, dt);
      } else {
        this.player.vx += ax * dt;
      }
      this.player.vx = clamp(this.player.vx, -maxV, maxV);
      this.player.x += this.player.vx * dt;
      const minX = this.roadX + this.player.w * 0.55;
      const maxX = this.roadX + this.roadWidth - this.player.w * 0.55;
      if (this.player.x < minX) {
        this.player.x = minX;
        this.player.vx = 0;
      } else if (this.player.x > maxX) {
        this.player.x = maxX;
        this.player.vx = 0;
      }
      this.player.y = this.viewH * 0.78;
      if (this.boosting && Math.random() < 0.6) {
        this.particles.push({
          x: this.player.x + rand(-10, 10),
          y: this.player.y + this.player.h * 0.45,
          vx: rand(-20, 20),
          vy: rand(80, 160),
          life: rand(0.2, 0.4),
          max: 0.4,
          size: rand(2, 4),
          color: Math.random() > 0.5 ? "#3cf0ff" : "#ff2d95",
        });
      }
    }

    laneCenter(lane) {
      return this.roadX + this.laneW * lane + this.laneW / 2;
    }

    updateTraffic(dt, difficulty) {
      const spawnEvery = lerp(1.15, 0.36, difficulty);
      if (this.state === "playing") {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnWave(difficulty);
          this.spawnTimer = spawnEvery * rand(0.75, 1.15);
        }
      }

      for (const car of this.traffic) {
        const rel = this.playerSpeed - car.speed;
        car.y += rel * dt;
        if (!car.passed && car.y > this.player.y + 8 && this.state === "playing") {
          car.passed = true;
          const gap = Math.abs(car.x - this.player.x) - (car.w + this.player.w) / 2;
          if (gap >= 0 && gap < 20) {
            this.score += 50;
            this.shake = Math.max(this.shake, 6);
            this.audio.nearMiss();
            this.showToast("NEAR MISS +50");
          }
        }
      }
      this.traffic = this.traffic.filter((car) => car.y < this.viewH + 140);
    }

    spawnWave(difficulty) {
      const occupied = new Set();
      for (const car of this.traffic) {
        if (car.y < 150) occupied.add(car.lane);
      }
      const free = [];
      for (let i = 0; i < LANES; i += 1) {
        if (!occupied.has(i)) free.push(i);
      }
      if (free.length === 0) return;
      const count = Math.min(Math.max(1, free.length - 1), Math.random() < 0.28 + difficulty * 0.25 ? 2 : 1);
      for (let n = 0; n < count; n += 1) {
        if (!free.length) break;
        const idx = (Math.random() * free.length) | 0;
        const lane = free.splice(idx, 1)[0];
        this.traffic.push(this.makeTraffic(lane));
      }
    }

    makeTraffic(lane) {
      return {
        lane,
        x: this.laneCenter(lane) + rand(-6, 6),
        y: -rand(90, 160),
        w: rand(40, 48),
        h: rand(70, 82),
        speed: this.playerSpeed * rand(0.32, 0.62),
        color: pick(TRAFFIC_PALETTE),
        passed: false,
      };
    }

    hitbox(entity) {
      return {
        x: entity.x - entity.w * 0.36,
        y: entity.y - entity.h * 0.38,
        w: entity.w * 0.72,
        h: entity.h * 0.76,
      };
    }

    checkCollisions() {
      const a = this.hitbox(this.player);
      for (const car of this.traffic) {
        const b = this.hitbox(car);
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          this.crash();
          return;
        }
      }
    }

    burst(x, y, color, n) {
      for (let i = 0; i < n; i += 1) {
        const ang = rand(0, Math.PI * 2);
        const mag = rand(40, 280);
        this.particles.push({
          x,
          y,
          vx: Math.cos(ang) * mag,
          vy: Math.sin(ang) * mag,
          life: rand(0.35, 0.8),
          max: 0.8,
          size: rand(2, 5),
          color,
        });
      }
    }

    updateParticles(dt) {
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }

    updateRain(dt) {
      const wind = 70;
      for (const drop of this.rain) {
        drop.y += drop.spd * dt;
        drop.x += wind * dt;
        if (drop.y > this.viewH) {
          drop.y = -drop.len;
          drop.x = Math.random() * this.viewW;
        }
        if (drop.x > this.viewW) drop.x -= this.viewW;
      }
    }

    showToast(text) {
      this.dom.toast.textContent = text;
      this.dom.toast.classList.remove("hidden", "pop");
      void this.dom.toast.offsetWidth;
      this.dom.toast.classList.add("pop");
      this.toastTimer = 0.7;
      global.setTimeout(() => {
        if (this.toastTimer <= 0) this.dom.toast.classList.add("hidden");
      }, 720);
    }

    updateHud() {
      this.dom.hudScore.textContent = String(this.score);
      this.dom.hudDistance.textContent = Math.floor(this.distance) + " m";
      this.dom.hudSpeed.textContent = String(Math.round(this.playerSpeed * 0.28));
      this.dom.hudNitro.style.width = Math.round(this.nitro * 100) + "%";
      this.dom.hudBest.textContent = String(this.best);
    }

    draw() {
      const ctx = this.ctx;
      const sx = this.shake ? rand(-this.shake, this.shake) : 0;
      const sy = this.shake ? rand(-this.shake, this.shake) : 0;
      ctx.save();
      ctx.translate(sx, sy);
      this.drawSky(ctx);
      this.drawCity(ctx, this.leftCity, true);
      this.drawCity(ctx, this.rightCity, false);
      this.drawRoad(ctx);
      for (const car of this.traffic) this.drawCar(ctx, car, false);
      if (this.state !== "crashing" || this.crashTimer > 0.25) {
        this.drawCar(ctx, this.player, true);
      }
      this.drawRain(ctx);
      this.drawParticles(ctx);
      ctx.restore();
    }

    drawSky(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
      g.addColorStop(0, "#07010f");
      g.addColorStop(0.45, "#140826");
      g.addColorStop(1, "#1c0a22");
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, this.viewW + 40, this.viewH + 40);

      for (const star of this.stars) {
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(this.distance * 0.01 + star.tw));
        ctx.fillStyle = "rgba(255,255,255," + tw + ")";
        ctx.beginPath();
        ctx.arc(star.x * this.viewW, star.y * this.viewH * 0.55, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const moonX = this.viewW * 0.82;
      const moonY = this.viewH * 0.12;
      ctx.fillStyle = "rgba(255, 214, 170, 0.12)";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6e2c4";
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCity(ctx, skyline, left) {
      if (!skyline) return;
      const scroll = this.distance % skyline.height;
      const maxW = Math.max(40, this.roadX - 10);
      for (const b of skyline.blocks) {
        for (const k of [-1, 0, 1]) {
          const y = b.y - scroll + k * skyline.height;
          if (y > this.viewH || y + b.h < -10) continue;
          const w = Math.min(b.w, maxW);
          const x = left ? this.roadX - 8 - w : this.roadX + this.roadWidth + 8;
          ctx.fillStyle = "rgb(" + Math.floor(18 + b.shade * 80) + "," + Math.floor(10 + b.shade * 40) + "," + Math.floor(28 + b.shade * 70) + ")";
          ctx.fillRect(x, y, w, b.h);
          if (b.neon) {
            ctx.fillStyle = b.neonColor;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x + 4, y + 8, w - 8, 3);
            ctx.globalAlpha = 1;
          }
          const cellW = w / (b.cols + 1);
          const cellH = b.h / (b.rows + 1);
          for (const win of b.windows) {
            if (!win.lit) continue;
            ctx.fillStyle = win.color;
            ctx.globalAlpha = 0.75;
            ctx.fillRect(x + cellW * (win.c + 0.45), y + cellH * (win.r + 0.4), Math.max(2, cellW * 0.45), Math.max(3, cellH * 0.4));
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    drawRoad(ctx) {
      const x = this.roadX;
      const w = this.roadWidth;
      const h = this.viewH;

      ctx.fillStyle = "#2a2034";
      ctx.fillRect(x - 18, 0, w + 36, h);

      const asphalt = ctx.createLinearGradient(x, 0, x + w, 0);
      asphalt.addColorStop(0, "#16141f");
      asphalt.addColorStop(0.5, "#1c1a27");
      asphalt.addColorStop(1, "#16141f");
      ctx.fillStyle = asphalt;
      ctx.fillRect(x, 0, w, h);

      ctx.fillStyle = "#3cf0ff";
      ctx.shadowColor = "#3cf0ff";
      ctx.shadowBlur = 12;
      ctx.fillRect(x - 3, 0, 4, h);
      ctx.fillStyle = "#ff2d95";
      ctx.shadowColor = "#ff2d95";
      ctx.fillRect(x + w - 1, 0, 4, h);
      ctx.shadowBlur = 0;

      const dashH = 28;
      const gap = 22;
      const period = dashH + gap;
      const offset = this.distance % period;
      ctx.strokeStyle = "rgba(240, 212, 90, 0.85)";
      ctx.lineWidth = 4;
      ctx.setLineDash([dashH, gap]);
      ctx.lineDashOffset = -offset;
      for (let i = 1; i < LANES; i += 1) {
        const lx = x + this.laneW * i;
        ctx.beginPath();
        ctx.moveTo(lx, -20);
        ctx.lineTo(lx, h + 20);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const lampPeriod = 220;
      const lampOff = this.distance % lampPeriod;
      for (let y = -lampOff; y < h + 40; y += lampPeriod) {
        this.drawLamp(ctx, x - 10, y, true);
        this.drawLamp(ctx, x + w + 10, y, false);
      }

      ctx.fillStyle = "rgba(60, 240, 255, 0.04)";
      ctx.fillRect(x, this.player.y - 40, w, 90);
    }

    drawLamp(ctx, x, y, left) {
      ctx.fillStyle = "#1a1424";
      ctx.fillRect(x - 2, y, 4, 46);
      ctx.fillStyle = "rgba(255, 214, 150, 0.12)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (left ? 36 : -36), y + 58);
      ctx.lineTo(x + (left ? -8 : 8), y + 58);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffe1a8";
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCar(ctx, car, isPlayer) {
      const x = car.x;
      const y = car.y;
      const w = car.w;
      const h = car.h;
      ctx.save();
      ctx.translate(x, y);

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = isPlayer ? "#3cf0ff" : car.color;
      ctx.beginPath();
      ctx.ellipse(0, h * 0.2, w * 0.55, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.shadowColor = isPlayer ? "#3cf0ff" : car.color;
      ctx.shadowBlur = isPlayer ? 22 : 14;
      ctx.fillStyle = isPlayer ? "#d9f7ff" : car.color;
      roundRect(ctx, -w / 2, -h / 2, w, h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isPlayer ? "#1a5d72" : "rgba(10, 8, 20, 0.45)";
      roundRect(ctx, -w * 0.32, -h * 0.32, w * 0.64, h * 0.28, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(10, 8, 20, 0.35)";
      roundRect(ctx, -w * 0.32, h * 0.02, w * 0.64, h * 0.16, 3);
      ctx.fill();

      if (isPlayer) {
        ctx.fillStyle = "#ff2d95";
        ctx.fillRect(-4, -h * 0.12, 8, h * 0.4);
        ctx.fillStyle = "#3cf0ff";
        ctx.beginPath();
        ctx.moveTo(-10, -h * 0.08);
        ctx.lineTo(0, -h * 0.2);
        ctx.lineTo(10, -h * 0.08);
        ctx.lineTo(6, -h * 0.02);
        ctx.lineTo(-6, -h * 0.02);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = "#fff6c8";
      ctx.shadowColor = "#fff6c8";
      ctx.shadowBlur = 12;
      ctx.fillRect(-w * 0.34, -h / 2 + 4, 8, 6);
      ctx.fillRect(w * 0.34 - 8, -h / 2 + 4, 8, 6);

      ctx.shadowColor = "#ff2d55";
      ctx.fillStyle = "#ff2d55";
      ctx.fillRect(-w * 0.34, h / 2 - 10, 9, 6);
      ctx.fillRect(w * 0.34 - 9, h / 2 - 10, 9, 6);
      ctx.shadowBlur = 0;

      if (isPlayer && this.boosting) {
        ctx.fillStyle = "rgba(60, 240, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(-w * 0.18, h / 2 - 2);
        ctx.lineTo(0, h / 2 + 28);
        ctx.lineTo(w * 0.18, h / 2 - 2);
        ctx.fill();
      }

      ctx.restore();
    }

    drawRain(ctx) {
      ctx.strokeStyle = "rgba(190, 210, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const drop of this.rain) {
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + 5, drop.y + drop.len);
      }
      ctx.stroke();
    }

    drawParticles(ctx) {
      for (const p of this.particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  }

  global.StreetKings = StreetKings;
})(window);
