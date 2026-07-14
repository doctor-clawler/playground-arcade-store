import {
  OUTFITS,
  OUTFIT_COLORS,
  SKIN_COLORS,
  WHITE,
  createInitialState,
  eraseCurrentSelection,
  exitWithoutSaving,
  normalizeCharacter,
  saveAndExit,
  selectOutfit,
  setActiveTab,
  setOutfitColor,
  setSkinColor,
  startCustomizing,
} from "./logic.mjs";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const statusNode = document.querySelector("#game-status");
const STORAGE_KEY = "character-grow-game.saved-character.v1";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const COLORS = {
  ink: "#2f2d35",
  paper: "#f8f4ed",
  paperDeep: "#f1e9de",
  panel: "#fffdf9",
  accent: "#f06452",
  accentDark: "#c94c3d",
  mint: "#cce7dc",
  sky: "#dbe8f2",
  yellow: "#f3d987",
  line: "#c9beb0",
  muted: "#756f77",
};

// Shared anatomical anchors keep the mannequin and every garment aligned.
const BODY_ANCHORS = Object.freeze({
  neckHalf: 27,
  neckTopY: 120,
  neckBaseY: 160,
  shoulderX: 70,
  shoulderY: 168,
  armShoulderX: 86,
  armShoulderY: 180,
  chestX: 96,
  chestY: 210,
  armOuterX: 125,
  armOuterY: 252,
  armpitX: 76,
  armpitY: 259,
  wristOuterX: 136,
  wristOuterY: 362,
  wristInnerX: 92,
  wristInnerY: 373,
  hipX: 72,
  hipY: 333,
  crotchY: 340,
  footY: 540,
});

function loadSavedCharacter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeCharacter(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const state = createInitialState(loadSavedCharacter());
let hitAreas = [];
let portrait = false;
let lastFrame = performance.now();

function configureCanvas() {
  const nextPortrait = window.innerWidth <= 700 || window.innerHeight > window.innerWidth * 1.15;
  portrait = nextPortrait;
  canvas.width = portrait ? 720 : 1080;
  canvas.height = portrait ? 1080 : 720;
  render();
}

function getLayout() {
  if (portrait) {
    return {
      exit: { x: 20, y: 20, w: 180, h: 88 },
      save: { x: 386, y: 20, w: 310, h: 88 },
      character: { x: 290, y: 128, scale: 0.86 },
      panel: { x: 24, y: 626, w: 672, h: 430 },
      tabs: { x: 590, y: 170, w: 106, h: 106, gap: 22 },
    };
  }

  return {
    exit: { x: 30, y: 26, w: 154, h: 56 },
    save: { x: 798, y: 26, w: 252, h: 56 },
    character: { x: 338, y: 126, scale: 0.98 },
    panel: { x: 614, y: 108, w: 334, h: 576 },
    tabs: { x: 968, y: 158, w: 82, h: 82, gap: 20 },
  };
}

function addHitArea(id, rect, label) {
  hitAreas.push({ id, label, ...rect });
}

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function hitAt(point) {
  for (let index = hitAreas.length - 1; index >= 0; index -= 1) {
    if (inRect(point, hitAreas[index])) return hitAreas[index];
  }
  return null;
}

function setStatus(message) {
  statusNode.textContent = message;
}

function roundedRect(rect, radius) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fbf8f2");
  gradient.addColorStop(1, COLORS.paperDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = COLORS.sky;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.12, canvas.height * 0.18, portrait ? 96 : 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.89, canvas.height * 0.82, portrait ? 118 : 86, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLORS.ink;
  for (let y = 20; y < canvas.height; y += 34) {
    for (let x = 22 + ((y / 34) % 2) * 9; x < canvas.width; x += 38) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStartScreen() {
  const button = portrait
    ? { x: 170, y: 464, w: 380, h: 150 }
    : { x: 400, y: 294, w: 280, h: 120 };
  const hovered = state.hoverId === "start";
  const pressed = state.pressedId === "start";
  const pulse = prefersReducedMotion.matches ? 0 : Math.sin(state.time / 700) * 3;
  const scale = pressed ? 0.97 : hovered ? 1.025 : 1;

  ctx.save();
  ctx.translate(button.x + button.w / 2, button.y + button.h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(button.x + button.w / 2), -(button.y + button.h / 2));
  ctx.shadowColor = "rgba(126, 65, 47, 0.24)";
  ctx.shadowBlur = hovered ? 30 : 22 + pulse;
  ctx.shadowOffsetY = hovered ? 15 : 12;
  roundedRect(button, portrait ? 52 : 42);
  ctx.fillStyle = hovered ? "#f36e5d" : COLORS.accent;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = portrait ? 6 : 4;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  const iconX = button.x + button.w * 0.32;
  const centerY = button.y + button.h / 2;
  const iconSize = portrait ? 28 : 23;
  ctx.beginPath();
  ctx.moveTo(iconX - iconSize * 0.45, centerY - iconSize);
  ctx.lineTo(iconX + iconSize, centerY);
  ctx.lineTo(iconX - iconSize * 0.45, centerY + iconSize);
  ctx.closePath();
  ctx.fillStyle = "#fffaf4";
  ctx.fill();

  ctx.fillStyle = "#fffaf4";
  ctx.font = `800 ${portrait ? 48 : 38}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("시작", button.x + button.w * 0.62, centerY + 1);
  ctx.restore();

  addHitArea("start", button, "시작");
}

function drawTopButton(rect, label, id, kind) {
  const hovered = state.hoverId === id;
  const pressed = state.pressedId === id;
  const primary = kind === "primary";

  ctx.save();
  ctx.translate(0, pressed ? 2 : 0);
  roundedRect(rect, rect.h / 2);
  ctx.fillStyle = primary ? (hovered ? "#f36e5d" : COLORS.accent) : hovered ? "#ffffff" : "rgba(255,255,255,0.72)";
  ctx.fill();
  ctx.lineWidth = portrait ? 3.5 : 2.5;
  ctx.strokeStyle = primary ? COLORS.ink : "#b7aa9b";
  ctx.stroke();

  ctx.strokeStyle = primary ? "#fffaf4" : COLORS.ink;
  ctx.fillStyle = primary ? "#fffaf4" : COLORS.ink;
  ctx.lineWidth = portrait ? 4 : 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const iconX = rect.x + (portrait ? 34 : 28);
  const centerY = rect.y + rect.h / 2;
  if (kind === "exit") {
    ctx.beginPath();
    ctx.moveTo(iconX + 8, centerY - 10);
    ctx.lineTo(iconX - 2, centerY);
    ctx.lineTo(iconX + 8, centerY + 10);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(iconX - 9, centerY);
    ctx.lineTo(iconX - 1, centerY + 8);
    ctx.lineTo(iconX + 11, centerY - 9);
    ctx.stroke();
  }

  ctx.font = `750 ${portrait ? 26 : 20}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w / 2 + (portrait ? 12 : 10), centerY + 1);
  ctx.restore();
  addHitArea(id, rect, label);
}

function drawPersonIcon(cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.19, size * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.29, cy + size * 0.31);
  ctx.quadraticCurveTo(cx - size * 0.22, cy + size * 0.02, cx, cy + size * 0.02);
  ctx.quadraticCurveTo(cx + size * 0.22, cy + size * 0.02, cx + size * 0.29, cy + size * 0.31);
  ctx.stroke();
  ctx.restore();
}

function drawClothesIcon(cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.075);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, cy - size * 0.28);
  ctx.lineTo(cx - size * 0.38, cy - size * 0.12);
  ctx.lineTo(cx - size * 0.27, cy + size * 0.1);
  ctx.lineTo(cx - size * 0.14, cy + size * 0.03);
  ctx.lineTo(cx - size * 0.14, cy + size * 0.32);
  ctx.lineTo(cx + size * 0.14, cy + size * 0.32);
  ctx.lineTo(cx + size * 0.14, cy + size * 0.03);
  ctx.lineTo(cx + size * 0.27, cy + size * 0.1);
  ctx.lineTo(cx + size * 0.38, cy - size * 0.12);
  ctx.lineTo(cx + size * 0.12, cy - size * 0.28);
  ctx.quadraticCurveTo(cx, cy - size * 0.14, cx - size * 0.12, cy - size * 0.28);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawTab(rect, id, type, active) {
  const hovered = state.hoverId === id;
  const pressed = state.pressedId === id;
  ctx.save();
  ctx.translate(0, pressed ? 2 : 0);
  ctx.shadowColor = active ? "rgba(47,45,53,0.2)" : "rgba(80,60,40,0.08)";
  ctx.shadowBlur = active ? 18 : 8;
  ctx.shadowOffsetY = active ? 8 : 4;
  roundedRect(rect, portrait ? 30 : 24);
  ctx.fillStyle = active ? COLORS.ink : hovered ? "#fffdf9" : "#eee7dc";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = portrait ? 4 : 3;
  ctx.strokeStyle = active ? COLORS.ink : "#c4b8aa";
  ctx.stroke();
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const iconColor = active ? "#fffaf4" : COLORS.ink;
  if (type === "skin") drawPersonIcon(cx, cy, rect.w * 0.52, iconColor);
  else drawClothesIcon(cx, cy, rect.w * 0.54, iconColor);
  ctx.restore();
  addHitArea(id, rect, type === "skin" ? "피부색" : "옷 꾸미기");
}

function drawPanelFrame(rect, progress) {
  const travel = portrait ? 34 : 44;
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * progress;
  ctx.translate((1 - progress) * travel, 0);
  ctx.shadowColor = "rgba(77, 57, 38, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundedRect(rect, portrait ? 34 : 30);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = portrait ? 3 : 2;
  ctx.strokeStyle = "#ded3c5";
  ctx.stroke();
  ctx.restore();
}

function drawSwatch(cx, cy, radius, color, selected, id, label, disabled = false) {
  const hovered = state.hoverId === id;
  ctx.save();
  ctx.globalAlpha = disabled ? 0.32 : 1;
  if (selected || hovered) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + (selected ? 9 : 6), 0, Math.PI * 2);
    ctx.strokeStyle = selected ? COLORS.ink : "#a99c8c";
    ctx.lineWidth = selected ? 4 : 3;
    ctx.stroke();
  }
  ctx.shadowColor = "rgba(52,42,34,0.12)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color === WHITE ? "#c4b8aa" : shadeColor(color, -0.25);
  ctx.stroke();
  ctx.restore();
  const hitPadding = portrait ? 18 : 11;
  addHitArea(
    id,
    {
      x: cx - radius - hitPadding,
      y: cy - radius - hitPadding,
      w: (radius + hitPadding) * 2,
      h: (radius + hitPadding) * 2,
    },
    label,
  );
}

function drawEraserIcon(cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#f3a4a0";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, size * 0.08);
  ctx.beginPath();
  ctx.roundRect(-size * 0.24, -size * 0.34, size * 0.48, size * 0.68, size * 0.09);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * 0.24, size * 0.05);
  ctx.lineTo(size * 0.24, size * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawEraserButton(rect, label) {
  const id = "erase";
  const hovered = state.hoverId === id;
  const pressed = state.pressedId === id;
  ctx.save();
  ctx.translate(0, pressed ? 2 : 0);
  roundedRect(rect, rect.h / 2);
  ctx.fillStyle = hovered ? "#f6ece8" : "#f1ebe3";
  ctx.fill();
  ctx.lineWidth = portrait ? 3 : 2;
  ctx.strokeStyle = "#c9bcad";
  ctx.stroke();
  const iconX = rect.x + rect.h * 0.5;
  const cy = rect.y + rect.h / 2;
  drawEraserIcon(iconX, cy, rect.h * 0.52, COLORS.ink);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${portrait ? 25 : 18}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.w * 0.62, cy + 1);
  ctx.restore();
  addHitArea(id, rect, label);
}

function drawSkinPanel(panel) {
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 ${portrait ? 30 : 25}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("피부색", panel.x + (portrait ? 34 : 28), panel.y + (portrait ? 42 : 40));

  if (portrait) {
    SKIN_COLORS.forEach((color, index) => {
      drawSwatch(
        panel.x + 58 + index * 104,
        panel.y + 132,
        32,
        color.value,
        state.draft.skinColor === color.value,
        `skin_color_${index}`,
        color.name,
      );
    });
    drawEraserButton({ x: panel.x + 390, y: panel.y + 294, w: 246, h: 88 }, "하얗게");
    return;
  }

  SKIN_COLORS.forEach((color, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    drawSwatch(
      panel.x + 74 + col * 94,
      panel.y + 114 + row * 96,
      28,
      color.value,
      state.draft.skinColor === color.value,
      `skin_color_${index}`,
      color.name,
    );
  });
  drawEraserButton({ x: panel.x + 28, y: panel.y + panel.h - 84, w: panel.w - 56, h: 58 }, "하얗게");
}

function drawMiniOutfit(id, cx, cy, size, selected) {
  const color = selected ? "#fffdf9" : WHITE;
  const stroke = selected ? "#fffdf9" : COLORS.ink;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2.5, size * 0.045);
  ctx.lineJoin = "round";

  if (id === "coat") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.22, -size * 0.35);
    ctx.lineTo(-size * 0.42, -size * 0.12);
    ctx.lineTo(-size * 0.3, size * 0.38);
    ctx.lineTo(0, size * 0.48);
    ctx.lineTo(size * 0.3, size * 0.38);
    ctx.lineTo(size * 0.42, -size * 0.12);
    ctx.lineTo(size * 0.22, -size * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.27);
    ctx.lineTo(0, size * 0.4);
    ctx.stroke();
  } else if (id === "windbreaker") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.22, -size * 0.28);
    ctx.quadraticCurveTo(-size * 0.47, -size * 0.22, -size * 0.43, size * 0.28);
    ctx.lineTo(-size * 0.16, size * 0.34);
    ctx.lineTo(size * 0.16, size * 0.34);
    ctx.lineTo(size * 0.43, size * 0.28);
    ctx.quadraticCurveTo(size * 0.47, -size * 0.22, size * 0.22, -size * 0.28);
    ctx.quadraticCurveTo(0, -size * 0.48, -size * 0.22, -size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.24);
    ctx.lineTo(0, size * 0.3);
    ctx.stroke();
  } else {
    const sleeve = id === "long" ? size * 0.42 : size * 0.2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.34);
    ctx.lineTo(-size * 0.46, -size * 0.14);
    ctx.lineTo(-size * 0.46 + sleeve * 0.24, sleeve);
    ctx.lineTo(-size * 0.2, size * 0.08);
    ctx.lineTo(-size * 0.16, size * 0.38);
    ctx.lineTo(size * 0.16, size * 0.38);
    ctx.lineTo(size * 0.2, size * 0.08);
    ctx.lineTo(size * 0.46 - sleeve * 0.24, sleeve);
    ctx.lineTo(size * 0.46, -size * 0.14);
    ctx.lineTo(size * 0.2, -size * 0.34);
    ctx.quadraticCurveTo(0, -size * 0.14, -size * 0.2, -size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawOutfitButton(rect, outfit) {
  const id = `outfit_${outfit.id}`;
  const selected = state.draft.outfit === outfit.id;
  const hovered = state.hoverId === id;
  const pressed = state.pressedId === id;
  ctx.save();
  ctx.translate(0, pressed ? 2 : 0);
  roundedRect(rect, portrait ? 24 : 20);
  ctx.fillStyle = selected ? COLORS.ink : hovered ? "#f8f2e9" : "#f1ebe3";
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = selected ? COLORS.ink : "#d1c5b7";
  ctx.stroke();
  drawMiniOutfit(outfit.id, rect.x + rect.w / 2, rect.y + rect.h * 0.41, portrait ? 54 : 46, selected);
  ctx.fillStyle = selected ? "#fffdf9" : COLORS.ink;
  ctx.font = `700 ${portrait ? 24 : 16}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(outfit.name, rect.x + rect.w / 2, rect.y + rect.h * 0.79);
  ctx.restore();
  addHitArea(id, rect, outfit.name);
}

function drawClothesPanel(panel) {
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 ${portrait ? 30 : 25}px "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("옷", panel.x + (portrait ? 34 : 28), panel.y + (portrait ? 36 : 36));

  if (portrait) {
    OUTFITS.forEach((outfit, index) => {
      drawOutfitButton({ x: panel.x + 28 + index * 157, y: panel.y + 64, w: 142, h: 112 }, outfit);
    });
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 24px "Apple SD Gothic Neo", sans-serif';
    ctx.fillText("색", panel.x + 34, panel.y + 218);
    OUTFIT_COLORS.forEach((color, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      drawSwatch(
        panel.x + 60 + col * 108,
        panel.y + 270 + row * 88,
        26,
        color.value,
        Boolean(state.draft.outfit) && state.draft.outfitColor === color.value,
        `outfit_color_${index}`,
        color.name,
        !state.draft.outfit,
      );
    });
    drawEraserButton({ x: panel.x + 454, y: panel.y + 314, w: 170, h: 88 }, "지우개");
    return;
  }

  OUTFITS.forEach((outfit, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawOutfitButton({ x: panel.x + 26 + col * 151, y: panel.y + 66 + row * 102, w: 136, h: 90 }, outfit);
  });
  ctx.fillStyle = COLORS.muted;
  ctx.font = '700 18px "Apple SD Gothic Neo", sans-serif';
  ctx.fillText("색", panel.x + 28, panel.y + 292);
  OUTFIT_COLORS.forEach((color, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    drawSwatch(
      panel.x + 57 + col * 72,
      panel.y + 342 + row * 66,
      21,
      color.value,
      Boolean(state.draft.outfit) && state.draft.outfitColor === color.value,
      `outfit_color_${index}`,
      color.name,
      !state.draft.outfit,
    );
  });
  drawEraserButton({ x: panel.x + 28, y: panel.y + panel.h - 68, w: panel.w - 56, h: 50 }, "지우개");
}

function shadeColor(hex, amount) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  const r = Math.max(0, Math.min(255, Math.round(((number >> 16) & 255) * (1 + amount))));
  const g = Math.max(0, Math.min(255, Math.round(((number >> 8) & 255) * (1 + amount))));
  const b = Math.max(0, Math.min(255, Math.round((number & 255) * (1 + amount))));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawBodyShape(skinColor) {
  const body = BODY_ANCHORS;
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Arms sit behind the body, ending around the upper quarter of the thigh.
  ctx.beginPath();
  ctx.moveTo(-body.armShoulderX, body.armShoulderY);
  ctx.quadraticCurveTo(-116, 194, -body.armOuterX, body.armOuterY);
  ctx.lineTo(-body.wristOuterX, body.wristOuterY);
  ctx.quadraticCurveTo(-139, 388, -120, 395);
  ctx.quadraticCurveTo(-99, 398, -92, 373);
  ctx.lineTo(-body.armpitX, body.armpitY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(body.armShoulderX, body.armShoulderY);
  ctx.quadraticCurveTo(116, 194, body.armOuterX, body.armOuterY);
  ctx.lineTo(body.wristOuterX, body.wristOuterY);
  ctx.quadraticCurveTo(139, 388, 120, 395);
  ctx.quadraticCurveTo(99, 398, 92, 373);
  ctx.lineTo(body.armpitX, body.armpitY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // The neck is behind the torso so its visible length stays compact.
  ctx.beginPath();
  ctx.roundRect(-body.neckHalf, body.neckTopY, body.neckHalf * 2, 60, 18);
  ctx.fill();
  ctx.stroke();

  // The crotch is raised so the legs are slightly longer than the torso.
  ctx.beginPath();
  ctx.moveTo(-body.shoulderX, body.shoulderY);
  ctx.quadraticCurveTo(-98, 176, -body.chestX, body.chestY);
  ctx.quadraticCurveTo(-91, 266, -body.hipX, body.hipY);
  ctx.lineTo(-72, 508);
  ctx.quadraticCurveTo(-72, body.footY, -42, body.footY);
  ctx.quadraticCurveTo(-10, body.footY, -10, 508);
  ctx.lineTo(-10, body.crotchY);
  ctx.quadraticCurveTo(0, 329, 10, body.crotchY);
  ctx.lineTo(10, 508);
  ctx.quadraticCurveTo(10, body.footY, 42, body.footY);
  ctx.quadraticCurveTo(72, body.footY, 72, 508);
  ctx.lineTo(body.hipX, body.hipY);
  ctx.quadraticCurveTo(91, 266, body.chestX, body.chestY);
  ctx.quadraticCurveTo(98, 176, body.shoulderX, body.shoulderY);
  ctx.lineTo(36, 160);
  ctx.lineTo(-36, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Head; intentionally no eyes or mouth.
  ctx.beginPath();
  ctx.arc(0, 72, 71, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function fillAndStrokeGarment(color) {
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawGarmentSleeves(color, sleeveType, ease = 0) {
  const body = BODY_ANCHORS;

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();

    if (sleeveType === "short") {
      ctx.moveTo(58, 158);
      ctx.lineTo(body.armShoulderX + 7 + ease, body.armShoulderY - 8);
      ctx.quadraticCurveTo(107 + ease, 180, body.armOuterX - 7 + ease, 228);
      ctx.lineTo(body.armpitX + 4, 244);
      ctx.lineTo(body.armpitX - 6, 215);
      ctx.quadraticCurveTo(68, 180, 58, 158);
    } else {
      ctx.moveTo(58, 158);
      ctx.lineTo(body.armShoulderX + 7 + ease, body.armShoulderY - 8);
      ctx.quadraticCurveTo(body.armOuterX - 3 + ease, 188, body.armOuterX + 5 + ease, body.armOuterY);
      ctx.lineTo(body.wristOuterX + 5 + ease, body.wristOuterY - 7);
      ctx.quadraticCurveTo(body.wristOuterX + 7 + ease, body.wristOuterY + 1, body.wristOuterX - 1 + ease, body.wristOuterY + 4);
      ctx.lineTo(body.wristInnerX + 10, body.wristInnerY - 1);
      ctx.quadraticCurveTo(body.wristInnerX + 4, body.wristInnerY - 2, body.wristInnerX + 2, body.wristInnerY - 10);
      ctx.lineTo(body.armpitX, body.armpitY);
      ctx.quadraticCurveTo(72, 198, 58, 158);
    }

    ctx.closePath();
    fillAndStrokeGarment(color);
    ctx.restore();
  }
}

function drawGarmentTorso(color, options) {
  const body = BODY_ANCHORS;
  const necklineHalf = body.neckHalf + 4;
  const shoulderX = body.shoulderX + 7 + options.ease;
  const chestX = body.chestX + 7 + options.ease;
  const hemX = options.hemX;

  ctx.beginPath();
  ctx.moveTo(-necklineHalf, options.neckY);
  ctx.lineTo(-shoulderX, 164);
  ctx.quadraticCurveTo(-chestX, 176, -chestX, body.chestY);
  ctx.quadraticCurveTo(-(chestX - 6), 260, -hemX, options.hemY);
  ctx.quadraticCurveTo(0, options.hemY + options.hemDip, hemX, options.hemY);
  ctx.quadraticCurveTo(chestX - 6, 260, chestX, body.chestY);
  ctx.quadraticCurveTo(chestX, 176, shoulderX, 164);
  ctx.lineTo(necklineHalf, options.neckY);

  if (options.neckline === "v") {
    ctx.lineTo(0, options.neckDepth);
  } else {
    ctx.quadraticCurveTo(0, options.neckDepth, -necklineHalf, options.neckY);
  }

  ctx.closePath();
  fillAndStrokeGarment(color);
}

function drawOutfit(outfit, color) {
  if (!outfit) return;
  const detail = color === WHITE ? "#b9ada0" : shadeColor(color, -0.28);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (outfit === "short") {
    drawGarmentSleeves(color, "short");
    drawGarmentTorso(color, { ease: 0, hemX: 74, hemY: 319, hemDip: 16, neckY: 156, neckDepth: 173, neckline: "crew" });
    return;
  }

  if (outfit === "long") {
    drawGarmentSleeves(color, "long");
    drawGarmentTorso(color, { ease: 0, hemX: 74, hemY: 319, hemDip: 16, neckY: 156, neckDepth: 173, neckline: "crew" });
    return;
  }

  if (outfit === "coat") {
    drawGarmentSleeves(color, "long", 4);
    drawGarmentTorso(color, { ease: 4, hemX: 80, hemY: 414, hemDip: 20, neckY: 154, neckDepth: 184, neckline: "v" });
    ctx.strokeStyle = detail;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 184);
    ctx.lineTo(0, 418);
    ctx.moveTo(-31, 154);
    ctx.lineTo(-8, 207);
    ctx.lineTo(0, 184);
    ctx.lineTo(8, 207);
    ctx.lineTo(31, 154);
    ctx.stroke();
    ctx.fillStyle = detail;
    for (const y of [244, 299, 354]) {
      ctx.beginPath();
      ctx.arc(18, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (outfit === "windbreaker") {
    drawGarmentSleeves(color, "long", 2);
    drawGarmentTorso(color, { ease: 2, hemX: 78, hemY: 320, hemDip: 14, neckY: 154, neckDepth: 174, neckline: "crew" });
    ctx.strokeStyle = detail;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 174);
    ctx.lineTo(0, 329);
    ctx.moveTo(-76, 305);
    ctx.quadraticCurveTo(0, 323, 76, 305);
    ctx.stroke();
  }
}

function drawCharacter(layout, entrance) {
  const idle = prefersReducedMotion.matches ? 0 : Math.sin(state.time / 850) * 3;
  const scale = layout.scale * (0.84 + entrance * 0.16);
  ctx.save();
  ctx.translate(layout.x, layout.y + idle + (1 - entrance) * 28);
  ctx.scale(scale, scale);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.ellipse(0, 552, 116, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawBodyShape(state.draft.skinColor);
  drawOutfit(state.draft.outfit, state.draft.outfitColor);
  ctx.restore();
}

function easeOutBack(value) {
  const x = Math.max(0, Math.min(1, value));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function drawCustomizeScreen() {
  const layout = getLayout();
  const elapsed = state.time - state.modeStartedAt;
  const entrance = prefersReducedMotion.matches ? 1 : easeOutBack(elapsed / 420);
  const panelProgress = prefersReducedMotion.matches ? 1 : Math.min(1, elapsed / 280);

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = COLORS.mint;
  ctx.beginPath();
  const ovalX = layout.character.x;
  const ovalY = layout.character.y + (portrait ? 248 : 240);
  ctx.ellipse(ovalX, ovalY, portrait ? 214 : 225, portrait ? 270 : 260, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawTopButton(layout.exit, "나가기", "exit", "exit");
  drawTopButton(layout.save, "저장하고 나가기", "save_exit", "primary");
  drawCharacter(layout.character, entrance);

  drawPanelFrame(layout.panel, panelProgress);
  if (state.activeTab === "skin") drawSkinPanel(layout.panel);
  else drawClothesPanel(layout.panel);

  const skinRect = { x: layout.tabs.x, y: layout.tabs.y, w: layout.tabs.w, h: layout.tabs.h };
  const clothesRect = {
    x: layout.tabs.x,
    y: layout.tabs.y + layout.tabs.h + layout.tabs.gap,
    w: layout.tabs.w,
    h: layout.tabs.h,
  };
  drawTab(skinRect, "tab_skin", "skin", state.activeTab === "skin");
  drawTab(clothesRect, "tab_clothes", "clothes", state.activeTab === "clothes");
}

function render() {
  hitAreas = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (state.mode === "start") drawStartScreen();
  else drawCustomizeScreen();
}

function activate(id) {
  if (!id) return;
  if (id === "start") {
    startCustomizing(state);
    setStatus("캐릭터 꾸미기를 시작했어요.");
  } else if (id === "exit") {
    exitWithoutSaving(state);
    setStatus("저장하지 않고 시작 화면으로 돌아왔어요.");
  } else if (id === "save_exit") {
    saveAndExit(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
    setStatus("캐릭터를 저장하고 시작 화면으로 돌아왔어요.");
  } else if (id === "tab_skin") {
    setActiveTab(state, "skin");
    setStatus("피부색 꾸미기 도구를 열었어요.");
  } else if (id === "tab_clothes") {
    setActiveTab(state, "clothes");
    setStatus("옷 꾸미기 도구를 열었어요.");
  } else if (id === "erase") {
    eraseCurrentSelection(state);
    setStatus(state.activeTab === "skin" ? "피부색을 하얗게 되돌렸어요." : "옷을 지웠어요.");
  } else if (id.startsWith("skin_color_")) {
    const index = Number(id.slice("skin_color_".length));
    const color = SKIN_COLORS[index];
    if (color) {
      setSkinColor(state, color.value);
      setStatus(`피부색을 ${color.name}(으)로 바꿨어요.`);
    }
  } else if (id.startsWith("outfit_color_")) {
    const index = Number(id.slice("outfit_color_".length));
    const color = OUTFIT_COLORS[index];
    if (color && state.draft.outfit) {
      setOutfitColor(state, color.value);
      setStatus(`옷 색을 ${color.name}(으)로 바꿨어요.`);
    } else if (!state.draft.outfit) {
      setStatus("먼저 입힐 옷을 골라 주세요.");
    }
  } else if (id.startsWith("outfit_")) {
    const outfitId = id.slice("outfit_".length);
    const outfit = OUTFITS.find((item) => item.id === outfitId);
    if (outfit) {
      selectOutfit(state, outfit.id);
      setStatus(`${outfit.name}을 하얀색으로 입혔어요.`);
    }
  }
  render();
}

canvas.addEventListener("pointermove", (event) => {
  const hit = hitAt(pointerPosition(event));
  const nextHover = hit?.id || null;
  if (nextHover !== state.hoverId) {
    state.hoverId = nextHover;
    canvas.style.cursor = hit ? "pointer" : "default";
    render();
  }
});

canvas.addEventListener("pointerleave", () => {
  state.hoverId = null;
  state.pressedId = null;
  canvas.style.cursor = "default";
  render();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const hit = hitAt(pointerPosition(event));
  state.pressedId = hit?.id || null;
  if (hit) canvas.setPointerCapture(event.pointerId);
  render();
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  const hit = hitAt(pointerPosition(event));
  const pressed = state.pressedId;
  state.pressedId = null;
  if (hit && hit.id === pressed) activate(hit.id);
  else render();
});

window.addEventListener("keydown", async (event) => {
  if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvas.requestFullscreen();
    return;
  }

  if (state.mode === "start" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    activate("start");
  } else if (state.mode === "customize" && event.key === "Escape") {
    activate("exit");
  } else if (state.mode === "customize" && event.key === "1") {
    activate("tab_skin");
  } else if (state.mode === "customize" && event.key === "2") {
    activate("tab_clothes");
  }
});

window.addEventListener("resize", configureCanvas);

function gameStateText() {
  const layout = getLayout();
  const outfitName = OUTFITS.find((outfit) => outfit.id === state.draft.outfit)?.name || null;
  return JSON.stringify({
    coordinate_system: `origin top-left; x right; y down; logical canvas ${canvas.width}x${canvas.height}`,
    mode: state.mode,
    orientation: portrait ? "portrait" : "landscape",
    character:
      state.mode === "customize"
        ? {
            skinColor: state.draft.skinColor,
            outfit: state.draft.outfit,
            outfitName,
            outfitColor: state.draft.outfitColor,
            eyes: false,
            mouth: false,
            anchor: { x: layout.character.x, y: layout.character.y },
          }
        : null,
    savedCharacterExists: Boolean(state.saved),
    activeTab: state.mode === "customize" ? state.activeTab : null,
    visibleControls: hitAreas.map(({ id, label, x, y, w, h }) => ({ id, label, rect: { x, y, w, h } })),
  });
}

window.render_game_to_text = gameStateText;
window.advanceTime = (milliseconds) => {
  state.time += Math.max(0, Number(milliseconds) || 0);
  render();
};

function frame(timestamp) {
  const delta = Math.min(40, Math.max(0, timestamp - lastFrame));
  lastFrame = timestamp;
  state.time += delta;
  render();
  requestAnimationFrame(frame);
}

configureCanvas();
requestAnimationFrame(frame);
