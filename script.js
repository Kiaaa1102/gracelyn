const canvas = document.querySelector("#heartCanvas");
const stage = document.querySelector("#heart-stage");
const button = document.querySelector("#heartButton");
const nameElement = document.querySelector(".heart-name");
const context = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const phrase = "I LOVE YOU";

let particles = [];
let scattered = false;
let bounds = { width: 0, height: 0, scale: 1, top: 0 };
let resizeTimer;

const random = (min, max) => Math.random() * (max - min) + min;
const easeOut = (value) => 1 - Math.pow(1 - value, 3);

function heartPoint(t) {
  return {
    x: 16 * Math.pow(Math.sin(t), 3),
    y:
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t),
  };
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > y) !== (b.y > y);
    if (crosses && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function overlaps(first, second) {
  const firstAxes = [
    { x: Math.cos(first.angle), y: Math.sin(first.angle) },
    { x: -Math.sin(first.angle), y: Math.cos(first.angle) },
  ];
  const secondAxes = [
    { x: Math.cos(second.angle), y: Math.sin(second.angle) },
    { x: -Math.sin(second.angle), y: Math.cos(second.angle) },
  ];

  for (const axis of [...firstAxes, ...secondAxes]) {
    const firstRadius =
      first.halfWidth * Math.abs(axis.x * firstAxes[0].x + axis.y * firstAxes[0].y) +
      first.halfHeight * Math.abs(axis.x * firstAxes[1].x + axis.y * firstAxes[1].y);
    const secondRadius =
      second.halfWidth * Math.abs(axis.x * secondAxes[0].x + axis.y * secondAxes[0].y) +
      second.halfHeight * Math.abs(axis.x * secondAxes[1].x + axis.y * secondAxes[1].y);
    const distance = Math.abs(
      (second.x - first.x) * axis.x + (second.y - first.y) * axis.y,
    );
    if (distance >= firstRadius + secondRadius + 1.2) return false;
  }
  return true;
}

function positionKey(x, y, cellSize) {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}

function nearbyParticles(x, y, cellSize, grid) {
  const nearby = [];
  const column = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dy = -2; dy <= 2; dy += 1) {
      const bucket = grid.get(`${column + dx},${row + dy}`);
      if (bucket) nearby.push(...bucket);
    }
  }
  return nearby;
}

function createParticles() {
  const { width, height, scale, top } = bounds;
  const polygon = [];
  for (let i = 0; i < 240; i += 1) {
    const point = heartPoint((i / 240) * Math.PI * 2);
    polygon.push({ x: width / 2 + point.x * scale, y: top + (10 - point.y) * scale });
  }

  const fontSize = width < 500 ? 6.2 : width < 760 ? 6.7 : 7.1;
  const cellSize = width < 500 ? 34 : 40;
  context.font = `600 ${fontSize}px "Plus Jakarta Sans", "Trebuchet MS", sans-serif`;
  const textWidth = context.measureText(phrase).width;
  const maxParticles = width < 500 ? 240 : width < 760 ? 310 : 450;
  const stageRect = stage.getBoundingClientRect();
  const nameRect = nameElement.getBoundingClientRect();
  const nameClear = {
    x: nameRect.left - stageRect.left + nameRect.width / 2,
    y: nameRect.top - stageRect.top + nameRect.height / 2,
    halfWidth: nameRect.width / 2 + 5,
    halfHeight: nameRect.height / 2 + 5,
    angle: 0,
  };
  const grid = new Map();
  const created = [];
  const attempts = maxParticles * 100;

  for (let attempt = 0; attempt < attempts && created.length < maxParticles; attempt += 1) {
    const x = random(width * 0.08, width * 0.92);
    const y = random(top, top + 27 * scale);
    if (!pointInPolygon(x, y, polygon)) continue;

    const sizeScale = random(0.91, 1.08);
    const particle = {
      x,
      y,
      homeX: x,
      homeY: y,
      angle: random(-0.105, 0.105),
      size: fontSize * sizeScale,
      halfWidth: (textWidth * sizeScale) / 2,
      halfHeight: fontSize * 0.55,
      alpha: random(0.66, 0.96),
      delay: reducedMotion ? 0 : random(0, 1.15),
      born: performance.now(),
      vx: 0,
      vy: 0,
      phase: random(0, Math.PI * 2),
    };

    if (overlaps(particle, nameClear)) continue;
    const nearby = nearbyParticles(x, y, cellSize, grid);
    if (nearby.some((other) => overlaps(particle, other))) continue;

    created.push(particle);
    const key = positionKey(x, y, cellSize);
    const bucket = grid.get(key) || [];
    bucket.push(particle);
    grid.set(key, bucket);
  }

  particles = created;
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const scale = Math.min((width * 0.84) / 32, (height * 0.74) / 26);
  bounds = { width, height, scale, top: height / 2 - 14 * scale };
  createParticles();
}

function animate(now) {
  const { width, height } = bounds;
  context.clearRect(0, 0, width, height);

  for (const particle of particles) {
    if (scattered) {
      particle.vx *= 0.993;
      particle.vy *= 0.993;
      particle.x += particle.vx;
      particle.y += particle.vy + Math.sin(now * 0.001 + particle.phase) * 0.12;
    } else {
      const spring = reducedMotion ? 0.16 : 0.075;
      particle.x += (particle.homeX - particle.x) * spring;
      particle.y += (particle.homeY - particle.y) * spring;
    }

    const reveal = Math.min(1, (now - particle.born) / 900 - particle.delay);
    const opacity = scattered ? 0.74 : Math.max(0, easeOut(reveal)) * particle.alpha;
    if (opacity <= 0) continue;

    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(
      particle.angle +
        (scattered ? Math.sin(now * 0.001 + particle.phase) * 0.045 : 0),
    );
    context.font = `600 ${particle.size}px "Plus Jakarta Sans", "Trebuchet MS", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = `rgba(255, 222, 230, ${opacity})`;
    context.shadowColor = "rgba(251, 113, 145, 0.3)";
    context.shadowBlur = 4;
    context.fillText(phrase, 0, 0);
    context.restore();
  }

  requestAnimationFrame(animate);
}

function toggleHeart() {
  scattered = !scattered;
  if (scattered) {
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    for (const particle of particles) {
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = random(2.2, 5.3) + Math.max(0, 1.8 - distance / 170);
      particle.vx = (dx / distance) * force + random(-1.35, 1.35);
      particle.vy = (dy / distance) * force + random(-1.35, 1.35);
    }
  }

  button.setAttribute("aria-pressed", String(scattered));
  button.setAttribute(
    "aria-label",
    scattered ? "Bring the heart back together" : "Scatter the heart",
  );
}

button.addEventListener("click", toggleHeart);
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeCanvas, 140);
});

document.fonts.ready.then(() => {
  resizeCanvas();
  requestAnimationFrame(animate);
});
