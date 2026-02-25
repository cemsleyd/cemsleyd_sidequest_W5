/*
Meditative Camera Scroll — p5.js (single-file)

Update:
- Added FAR farmhouses + silos on the horizon (mid/far distance).
  They are subtle silhouettes with tiny window glows.
- Kept: coins, score, moon parallax, cows, grass, trees, overlays.
- Removed: any layer toggle ability (only H and R).

Controls:
- Move camera: Arrow keys / WASD
- Click coins: +1 score
- Reset: R
- Toggle UI: H
*/

let cam, world;
let showHUD = true;
let score = 0;

let grainLayer;

function setup() {
  createCanvas(900, 520);
  pixelDensity(1);

  world = new World();
  cam = new CameraRig();

  textFont("Georgia");

  grainLayer = createGraphics(width, height);
  makeStaticGrain(grainLayer, 18);
}

function draw() {
  background(6, 8, 12);

  world.update();
  cam.update(world);

  // ---------- World space ----------
  push();
  cam.apply();

  world.drawFar();
  world.drawMid(); // includes horizon buildings + cows + cow coins
  world.drawNear(); // trees + tree coins + grass
  world.drawFloaters();

  pop();

  // ---------- Screen space ----------
  world.drawMoonParallax(cam.pos.x);

  world.drawBreathOverlay();
  world.drawVignette();
  world.drawGrain();

  if (showHUD) drawHUD();
}

function mousePressed() {
  const wx = mouseX + cam.pos.x;
  const wy = mouseY + cam.pos.y;

  if (world.tryCollectCoinAt(wx, wy)) {
    score += 1;
  }
}

// -------------------- Input --------------------
function keyPressed() {
  if (key === "h" || key === "H") showHUD = !showHUD;

  if (key === "r" || key === "R") {
    score = 0;
    world = new World();
    cam = new CameraRig();
    grainLayer = createGraphics(width, height);
    makeStaticGrain(grainLayer, 18);
  }
}

// -------------------- HUD --------------------
function drawHUD() {
  const pad = 16;
  noStroke();
  fill(0, 90);
  rect(pad, pad, 610, 112, 14);

  fill(230, 220);
  textSize(14);
  textAlign(LEFT, TOP);
  text(
    "Night farm (manual camera)\nWASD / Arrows: move camera  •  Click coins: +1\nH: hide text  •  R: reset",
    pad + 12,
    pad + 10,
  );

  const pillW = 120;
  const pillH = 30;
  const px = pad + 610 - pillW - 12;
  const py = pad + 12;
  fill(255, 20);
  rect(px, py, pillW, pillH, 999);
  fill(240, 230);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(`Score: ${score}`, px + pillW / 2, py + pillH / 2);
}

// -------------------- Static Grain Builder --------------------
function makeStaticGrain(pg, intensity = 18) {
  pg.pixelDensity(1);
  pg.loadPixels();

  for (let y = 0; y < pg.height; y++) {
    for (let x = 0; x < pg.width; x++) {
      const idx = 4 * (y * pg.width + x);

      const n = noise(x * 0.08, y * 0.08);
      const g = (n - 0.5) * 2 * intensity;

      pg.pixels[idx + 0] = 128 + g;
      pg.pixels[idx + 1] = 128 + g;
      pg.pixels[idx + 2] = 128 + g;
      pg.pixels[idx + 3] = 35;
    }
  }

  pg.updatePixels();
}

// ==================== Camera ====================
class CameraRig {
  constructor() {
    this.pos = createVector(0, 0);
    this.vel = createVector(0, 0);
  }

  update(worldRef) {
    let ix = 0;
    let iy = 0;

    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) ix -= 1; // A
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) ix += 1; // D
    if (keyIsDown(UP_ARROW) || keyIsDown(87)) iy -= 1; // W
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) iy += 1; // S

    const mag = Math.hypot(ix, iy);
    if (mag > 0) {
      ix /= mag;
      iy /= mag;
    }

    const accel = 0.58;
    const dampingWhenIdle = 0.82;
    const dampingWhenMoving = 0.92;
    const maxV = 3.0;

    this.vel.x += ix * accel;
    this.vel.y += iy * accel;

    this.vel.x = constrain(this.vel.x, -maxV, maxV);
    this.vel.y = constrain(this.vel.y, -maxV, maxV);

    if (mag === 0) this.vel.mult(dampingWhenIdle);
    else this.vel.mult(dampingWhenMoving);

    this.pos.add(this.vel);

    const b = worldRef.softBounds;
    this.pos.x = constrain(this.pos.x, b.minX, b.maxX);
    this.pos.y = constrain(this.pos.y, b.minY, b.maxY);
  }

  apply() {
    translate(-this.pos.x, -this.pos.y);
  }
}

// ==================== World ====================
class World {
  constructor() {
    this.seed = floor(random(1e9));
    noiseSeed(this.seed);
    randomSeed(this.seed);

    this.softBounds = {
      minX: -900,
      maxX: 6800,
      minY: -650,
      maxY: 650,
    };

    this.breathT = random(1000);

    this.floaters = [];
    for (let i = 0; i < 220; i++) this.floaters.push(this.makeFloater());

    this.stars = [];
    for (let i = 0; i < 420; i++) {
      this.stars.push({
        x: random(this.softBounds.minX, this.softBounds.maxX),
        y: random(this.softBounds.minY, this.softBounds.maxY),
        s: random(0.5, 2.2),
        a: random(70, 170),
      });
    }

    this.cows = this.makeCows(14);
    this.grass = this.makeGrass(160);

    this.trees = this.makeTrees(42);

    // NEW: distant buildings (farmhouses + silos)
    this.buildings = this.makeBuildings(18);

    this.moonR = 46;
    this.moonSeed = floor(random(1e9));

    this.coins = this.makeCoins();
  }

  makeFloater() {
    return {
      x: random(this.softBounds.minX, this.softBounds.maxX),
      y: random(-260, 260),
      r: random(1.2, 3.8),
      phase: random(TWO_PI),
      drift: random(0.2, 0.55),
      glow: random(40, 120),
    };
  }

  makeCows(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const x = random(this.softBounds.minX + 200, this.softBounds.maxX - 200);
      const y = this.sampleGroundY(x);
      const s = random(0.85, 1.5);
      arr.push({
        x,
        y,
        s,
        flip: random() < 0.5 ? -1 : 1,
        idle: random(TWO_PI),
        buddyOffset: random() < 0.35 ? random(-90, 90) : 0,
      });
    }
    for (let c of arr) {
      if (c.buddyOffset !== 0) {
        c.x += c.buddyOffset;
        c.y = this.sampleGroundY(c.x);
      }
    }
    return arr;
  }

  makeGrass(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const x = random(this.softBounds.minX, this.softBounds.maxX);
      const y = this.sampleGroundY(x);
      const s = random(0.6, 1.35);
      const clump = floor(random(2, 6));
      arr.push({
        x,
        y,
        s,
        clump,
        phase: random(TWO_PI),
        tint: random(0.75, 1.05),
      });
    }
    return arr;
  }

  makeTrees(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const x = i * 160 + 40 + sin(i * 0.9) * 20;
      const y = this.sampleGroundY(x);
      arr.push({ x, y, phase: random(TWO_PI) });
    }
    for (let i = 0; i < 30; i++) {
      const x = random(this.softBounds.minX + 200, this.softBounds.maxX - 200);
      const y = this.sampleGroundY(x);
      if (random() < 0.45) arr.push({ x, y, phase: random(TWO_PI) });
    }
    return arr;
  }

  // NEW: farmhouses + silos “far away”
  makeBuildings(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const x = random(this.softBounds.minX + 120, this.softBounds.maxX - 120);
      // Put them near the horizon band (not on the main ground)
      const baseY = 150 + noise(x * 0.0009, 33.3) * 60;

      const type = random() < 0.55 ? "house" : "silo";
      const s = random(0.65, 1.25);

      arr.push({
        x,
        y: baseY,
        type,
        s,
        // tiny “window warmth”
        glow: random(0.25, 1.0),
        // slight variety in roof/silo height
        v: random(),
      });
    }
    return arr;
  }

  makeCoins() {
    const coins = [];

    for (let i = 0; i < this.cows.length; i++) {
      if (random() < 0.55)
        coins.push({ kind: "cow", idx: i, r: 10, collected: false });
    }

    for (let i = 0; i < this.trees.length; i++) {
      if (random() < 0.35)
        coins.push({ kind: "tree", idx: i, r: 10, collected: false });
    }

    return coins;
  }

  update() {
    this.breathT += 0.01;

    for (let p of this.floaters) {
      const w = noise(p.x * 0.0012, p.y * 0.0012, frameCount * 0.002) - 0.5;
      p.x += w * 0.5;
      p.y += sin(frameCount * 0.004 + p.phase) * 0.22 - p.drift;

      if (p.y < -520) {
        p.y = random(120, 420);
        p.x = random(this.softBounds.minX, this.softBounds.maxX);
      }
    }
  }

  // ---------- Coin logic ----------
  getCoinPos(coin) {
    if (coin.kind === "cow") {
      const c = this.cows[coin.idx];
      if (!c) return null;

      const bob = sin(frameCount * 0.015 + c.idle) * 1.2;
      const xLocal = 18;
      const yLocal = -38;

      return {
        x: c.x + xLocal * c.flip * c.s,
        y: c.y + bob + yLocal * c.s,
      };
    }

    if (coin.kind === "tree") {
      const t = this.trees[coin.idx];
      if (!t) return null;

      const sway = sin(frameCount * 0.01 + t.phase) * 2.5;
      return { x: t.x + sway * 0.6, y: t.y - 82 };
    }

    return null;
  }

  tryCollectCoinAt(wx, wy) {
    for (let coin of this.coins) {
      if (coin.collected) continue;
      const p = this.getCoinPos(coin);
      if (!p) continue;

      if (dist(wx, wy, p.x, p.y) <= coin.r + 6) {
        coin.collected = true;
        return true;
      }
    }
    return false;
  }

  drawCoinAt(x, y, r) {
    push();

    noStroke();
    fill(255, 225, 120, 28);
    circle(x, y, r * 3.0);

    fill(245, 206, 90, 235);
    circle(x, y, r * 2);

    noFill();
    stroke(120, 85, 30, 180);
    strokeWeight(2);
    circle(x, y, r * 2);

    stroke(255, 245, 200, 140);
    strokeWeight(2);
    line(x - r * 0.3, y - r * 0.6, x + r * 0.2, y - r * 0.9);

    stroke(90, 60, 20, 160);
    strokeWeight(2);
    line(x - r * 0.9, y + r * 0.5, x - r * 0.2, y + r * 0.15);

    pop();
  }

  drawCoinsForKind(kind) {
    for (let coin of this.coins) {
      if (coin.collected) continue;
      if (coin.kind !== kind) continue;
      const p = this.getCoinPos(coin);
      if (!p) continue;
      this.drawCoinAt(p.x, p.y, coin.r);
    }
  }

  // ---------- Layers ----------
  drawFar() {
    push();
    noStroke();

    for (let st of this.stars) {
      fill(210, 220, 245, st.a);
      circle(st.x, st.y, st.s);
    }

    for (let x = this.softBounds.minX; x < this.softBounds.maxX; x += 40) {
      const gate = noise(x * 0.0016, this.seed * 0.00002);
      if (gate < 0.42) continue;

      const n = noise(x * 0.0007, this.seed * 0.00001);
      const y = -260 + n * 90 + sin(x * 0.0016 + this.breathT * 0.25) * 10;

      let a = 6 + n * 14;
      a = constrain(a, 0, 18);

      fill(110, 160, 190, a);

      const w = 70 + n * 35;
      const h = 36 + n * 18;
      ellipse(x, y, w, h);
    }

    pop();
  }

  drawMid() {
    push();

    const horizonY = 80;
    const groundBase = 260;

    // sky gradient
    noStroke();
    for (let y = -400; y < groundBase; y += 2) {
      const t = map(y, -400, groundBase, 0, 1);
      fill(10 + t * 18, 14 + t * 18, 22 + t * 24, 255);
      rect(
        this.softBounds.minX,
        y,
        this.softBounds.maxX - this.softBounds.minX,
        2,
      );
    }

    // distant hills
    fill(12, 16, 22, 220);
    beginShape();
    vertex(this.softBounds.minX, groundBase);
    for (let x = this.softBounds.minX; x <= this.softBounds.maxX; x += 18) {
      const n = noise(x * 0.0009, 10.0);
      const yy = horizonY + n * 140;
      vertex(x, yy);
    }
    vertex(this.softBounds.maxX, groundBase);
    endShape(CLOSE);

    // NEW: distant farm buildings on the horizon band
    this.drawBuildings();

    // main ground
    fill(8, 10, 14, 255);
    beginShape();
    vertex(this.softBounds.minX, height + 900);
    for (let x = this.softBounds.minX; x <= this.softBounds.maxX; x += 16) {
      const n1 = noise(x * 0.0013, 100.0);
      const n2 = noise(x * 0.0035, 200.0);
      const yy = 240 + n1 * 210 + n2 * 45;
      vertex(x, yy);
    }
    vertex(this.softBounds.maxX, height + 900);
    endShape(CLOSE);

    // water line
    const waterY = 300;
    for (let x = this.softBounds.minX; x < this.softBounds.maxX; x += 10) {
      const ripple =
        sin(x * 0.02 + this.breathT * 1.2) * 2 +
        (noise(x * 0.01, this.breathT * 0.2) - 0.5) * 3;
      const a = 12 + noise(x * 0.003, 400) * 18;
      stroke(180, 210, 230, a);
      line(x, waterY + ripple, x + 8, waterY + ripple + 0.4);
    }

    // tiny posts
    noStroke();
    for (let i = 0; i < 26; i++) {
      const px = i * 280 + 90 + sin(i * 2.1) * 35;
      const py = this.sampleGroundY(px) - 8;
      const tall = 18 + noise(i * 10.1) * 55;

      fill(18, 22, 30, 220);
      rect(px - 2, py - tall, 4, tall, 2);

      fill(200, 220, 240, 40);
      circle(px, py - tall - 6, 18);
    }

    // cows + coins
    this.drawCows();
    this.drawCoinsForKind("cow");

    pop();
  }

  // NEW: building renderer (simple silhouettes + faint windows)
  drawBuildings() {
    push();

    for (let b of this.buildings) {
      const s = b.s;

      if (b.type === "house") {
        // silhouette
        noStroke();
        fill(10, 12, 16, 240);
        const w = 52 * s;
        const h = 26 * s;
        const x = b.x;
        const y = b.y;

        rect(x - w / 2, y - h, w, h, 3);

        // roof
        fill(8, 10, 14, 245);
        beginShape();
        vertex(x - w / 2, y - h);
        vertex(x, y - h - (18 + b.v * 10) * s);
        vertex(x + w / 2, y - h);
        endShape(CLOSE);

        // chimney
        fill(8, 10, 14, 240);
        rect(x + w * 0.18, y - h - 16 * s, 6 * s, 14 * s, 2);

        // tiny window glow
        if (b.glow > 0.55) {
          fill(245, 220, 160, 40 + b.glow * 35);
          rect(x - 10 * s, y - h + 8 * s, 8 * s, 8 * s, 2);
          rect(x + 2 * s, y - h + 10 * s, 7 * s, 7 * s, 2);
        }
      } else {
        // silo
        noStroke();
        fill(9, 11, 15, 245);
        const w = 18 * s;
        const h = (44 + b.v * 22) * s;
        const x = b.x;
        const y = b.y;

        rect(x - w / 2, y - h, w, h, 7);

        // cap
        fill(7, 9, 13, 245);
        arc(x, y - h, w, w, PI, TWO_PI);

        // tiny highlight
        fill(200, 220, 240, 10 + b.glow * 10);
        rect(x - w * 0.15, y - h + 6 * s, w * 0.18, h - 12 * s, 6);
      }
    }

    pop();
  }

  drawNear() {
    push();
    this.drawGrass();
    this.drawTrees();
    this.drawCoinsForKind("tree");
    pop();
  }

  drawTrees() {
    for (let t of this.trees) {
      const sway = sin(frameCount * 0.01 + t.phase) * 2.5;

      stroke(12, 14, 18, 210);
      strokeWeight(3);
      line(t.x, t.y - 8, t.x + sway, t.y - 70);

      noStroke();
      fill(10, 12, 16, 240);
      ellipse(t.x + sway, t.y - 82, 36, 24);
      ellipse(t.x + sway + 16, t.y - 76, 22, 16);
      ellipse(t.x + sway - 14, t.y - 74, 20, 14);
    }
  }

  drawCows() {
    push();
    for (let i = 0; i < this.cows.length; i++) {
      const c = this.cows[i];
      const bob = sin(frameCount * 0.015 + c.idle) * 1.2;

      push();
      translate(c.x, c.y + bob);
      scale(c.flip * c.s, c.s);

      noStroke();
      fill(20, 24, 32, 235);
      ellipse(0, -18, 56, 30);
      ellipse(34, -26, 20, 16);

      fill(24, 28, 38, 235);
      ellipse(42, -24, 10, 8);

      fill(16, 18, 24, 240);
      rect(-18, -6, 6, 18, 2);
      rect(-6, -6, 6, 18, 2);
      rect(8, -6, 6, 18, 2);
      rect(20, -6, 6, 18, 2);

      stroke(18, 20, 26, 220);
      strokeWeight(2);
      noFill();
      const wag = sin(frameCount * 0.02 + c.idle) * 4;
      beginShape();
      vertex(-28, -22);
      quadraticVertex(-40, -16 + wag, -36, -6);
      endShape();

      noStroke();
      fill(28, 34, 46, 120);
      ellipse(-6, -20, 16, 10);

      pop();
    }
    pop();
  }

  drawGrass() {
    push();
    strokeWeight(2);

    for (let i = 0; i < this.grass.length; i++) {
      const g = this.grass[i];
      const sway = sin(frameCount * 0.02 + g.phase) * 3;

      stroke(22 * g.tint, 28 * g.tint, 34 * g.tint, 170);

      const baseY = g.y - 6;
      const baseX = g.x;

      for (let b = 0; b < g.clump; b++) {
        const ox = (b - (g.clump - 1) / 2) * (4 * g.s);
        const hh = (10 + (b % 3) * 6) * g.s;
        const bend = sway + ox * 0.2;
        line(baseX + ox, baseY, baseX + ox + bend, baseY - hh);
      }
    }

    pop();
  }

  drawFloaters() {
    push();
    noStroke();
    for (let p of this.floaters) {
      const tw = sin(frameCount * 0.02 + p.phase) * 0.4 + 0.6;
      fill(190, 210, 230, p.glow * tw);
      circle(p.x, p.y, p.r * (0.8 + tw));
    }
    pop();
  }

  // ---------- Moon ----------
  drawMoonParallax(camX) {
    push();

    const r = this.moonR;
    const my = 78;
    const baseX = 86;
    const parallax = 0.18;

    let mx = baseX - camX * parallax;

    const wrapW = width + r * 4;
    mx = (((mx % wrapW) + wrapW) % wrapW) - r * 2;

    noStroke();
    fill(210, 220, 240, 16);
    circle(mx, my, r * 2.35);

    fill(215, 225, 240, 235);
    circle(mx, my, r * 2);

    stroke(40, 50, 70, 85);
    strokeWeight(2);
    noFill();

    const saved = this.moonSeed;
    for (let k = 0; k < 3; k++) {
      beginShape();
      for (let a = 0; a <= TWO_PI + 0.001; a += 0.22) {
        const nx = noise(saved * 0.00001 + k * 10.0, a * 0.6);
        const wob = (nx - 0.5) * 6;
        const rr = r + wob + k * 1.2;
        vertex(mx + cos(a) * rr, my + sin(a) * rr);
      }
      endShape();
    }

    stroke(70, 85, 110, 70);
    strokeWeight(1.5);
    fill(200, 210, 230, 120);
    this.crater(mx - 14, my - 6, 10, 7);
    this.crater(mx + 12, my + 10, 14, 10);
    this.crater(mx + 6, my - 18, 8, 6);

    stroke(90, 105, 130, 55);
    strokeWeight(1);
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const x1 = mx - r + t * (r * 1.05);
      const y1 = my + r * 0.35 + t * 10;
      line(x1, y1, x1 + 14, y1 + 8);
    }

    pop();
  }

  crater(cx, cy, w, h) {
    push();
    translate(cx, cy);
    noFill();
    for (let k = 0; k < 2; k++) {
      beginShape();
      for (let a = 0; a <= TWO_PI + 0.001; a += 0.35) {
        const wob =
          (noise(this.moonSeed * 0.00002 + k * 20.0, a * 0.8) - 0.5) * 2.2;
        const rx = w * 0.5 + wob;
        const ry = h * 0.5 + wob * 0.7;
        vertex(cos(a) * rx, sin(a) * ry);
      }
      endShape();
    }
    pop();
  }

  // ---------- Screen overlays ----------
  drawBreathOverlay() {
    const breath = sin(this.breathT * 0.35) * 0.5 + 0.5;
    const alpha = 22 + breath * 26;

    noStroke();
    fill(90, 140, 170, alpha);
    rect(0, 0, width, height);
  }

  drawVignette() {
    push();
    noFill();
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const a = 18 * t;
      stroke(0, 0, 0, a);
      const m = t * 70;
      rect(m, m, width - 2 * m, height - 2 * m, 28);
    }
    pop();
  }

  drawGrain() {
    push();
    blendMode(BLEND);
    tint(255, 18);
    image(grainLayer, 0, 0);
    noTint();
    pop();
  }

  // ---------- Helpers ----------
  sampleGroundY(x) {
    const n1 = noise(x * 0.0013, 100.0);
    const n2 = noise(x * 0.0035, 200.0);
    return 240 + n1 * 210 + n2 * 45;
  }
}
