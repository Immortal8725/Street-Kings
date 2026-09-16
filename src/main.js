(function () {
  "use strict";

  const audio = new StreetKingsAudio();
  const game = new StreetKings(
    {
      canvas: document.getElementById("game"),
      overlay: document.getElementById("overlay"),
      titleScreen: document.getElementById("title-screen"),
      gameoverScreen: document.getElementById("gameover-screen"),
      hud: document.getElementById("hud"),
      hudScore: document.getElementById("hud-score"),
      hudDistance: document.getElementById("hud-distance"),
      hudSpeed: document.getElementById("hud-speed"),
      hudBest: document.getElementById("hud-best"),
      hudNitro: document.getElementById("hud-nitro"),
      toast: document.getElementById("toast"),
      touch: document.getElementById("touch"),
      left: document.getElementById("btn-left"),
      right: document.getElementById("btn-right"),
      nitro: document.getElementById("btn-nitro"),
      mute: document.getElementById("btn-mute"),
      play: document.getElementById("btn-play"),
      retry: document.getElementById("btn-retry"),
      titleBest: document.getElementById("title-best"),
      goScore: document.getElementById("go-score"),
      goDistance: document.getElementById("go-distance"),
      goBest: document.getElementById("go-best"),
      goFlavor: document.getElementById("go-flavor"),
      record: document.getElementById("go-record"),
    },
    audio
  );

  game.init();
})();
