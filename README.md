# Street Kings

Night-city arcade racer. Dodge the pack, burn nitro, and put your name on the street.

This is a browser-playable v1 MVP: a short endless run on a wet neon highway. No install beyond a local web server (or opening the file).

## Play locally

The game is static HTML, CSS, and JavaScript. There are no build steps and no npm dependencies.

### Option A — open the file

Double-click `index.html`, or from the repo root:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

### Option B — local server (recommended)

From the repo root:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in a modern browser (Chrome, Firefox, Safari, or Edge).

Any other static file server works the same way (`npx serve .`, VS Code Live Server, etc.).

## Controls

| Action | Desktop | Mobile / touch |
| --- | --- | --- |
| Steer left / right | `A` `D` or `←` `→` | On-screen arrows, or tap the left / right third of the screen |
| Nitro boost | Hold `W`, `↑`, or `Shift` | Hold **NITRO** (or the middle third of the screen) |
| Start / restart | **Play** / **Run it back**, or `Enter` / `Space` | Same buttons |
| Mute | `M` or the ♪ button | ♪ button |

Sound is generated in the browser (engine rumble, UI beeps, crash). It starts after you hit Play, once the page is allowed to use audio.

## How to play

1. Hit **Play** on the title screen.
2. Stay on the highway and dodge oncoming traffic. Your car is the pale cyan ride with the crown stripe.
3. Speed climbs the longer you survive. Near-misses are worth **+50**.
4. Nitro is a short burst — dump it to thread a gap, then let it refill.
5. Crash = game over. Distance and score are shown; a new best is stored in `localStorage` on this browser.

## Project layout

```
index.html          # page shell, HUD, menus
src/styles.css      # night-city UI
src/game.js         # race loop, traffic, rendering
src/audio.js        # optional Web Audio SFX
src/main.js         # boot
src/favicon.svg     # tiny crown mark
```

Graphics are drawn procedurally on a `<canvas>` (road, skyline, rain, cars). No large binary assets.

## Stack

Vanilla HTML5 Canvas + CSS + JavaScript. Chosen so the MVP stays small, readable, and runnable with zero toolchain.

## Browser support

Recent Chromium, Firefox, and Safari. Desktop keyboard is the intended feel; touch controls are there for phones and tablets.
