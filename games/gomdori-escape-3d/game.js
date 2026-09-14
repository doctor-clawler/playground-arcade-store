(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const keys = new Set();
  const heldControls = new Set();
  const pointer = { x: 0, y: 0 };
  let buttons = [];
  let lastTime = 0;
  let virtualMode = false;

  const STORAGE_KEY = "gomdori-coins";

  const state = {
    mode: "menu",
    message: "",
    messageT: 0,
    coins: Number(localStorage.getItem(STORAGE_KEY) || "0"),
    comicPage: 0,
    stage: 0,
    cameraX: 0,
    player: { x: 190, y: 430, r: 16, speed: 150 },
    hammer: false,
    wallBroken: false,
    drawer1Open: false,
    codeFound: { a: false, b: false, c: false },
    codeInput: "",
    keypad: false,
    hidden: false,
    bear: { x: 1550, y: 430, r: 23, phase: 0, alert: false, stunned: false },
    stage3Key: false,
    kidFreed: false,
    knife: false,
    rescueTimer: 45,
    escapedPrison: false,
    finalKey: false,
    chestOpen: false,
    ending: "",
    finalReturn: false,
  };

  const comic = [
    {
      title: "길가에 남겨진 곰돌이",
      text: "한 아이가 낡은 인형을 길에 내려놓고 집으로 돌아갔습니다.",
      mood: "street",
    },
    {
      title: "빨갛게 변한 눈",
      text: "혼자 남은 곰돌이의 눈이 붉게 빛나기 시작했습니다.",
      mood: "eyes",
    },
    {
      title: "움직이기 시작한 인형",
      text: "작은 발소리가 골목 끝까지 이어졌습니다.",
      mood: "wake",
    },
    {
      title: "아이를 향해",
      text: "곰돌이는 아이가 사라진 집을 향해 달려갔습니다.",
      mood: "chase",
    },
  ];

  const rects = {
    stage1Drawer: { x: 690, y: 360, w: 104, h: 72 },
    stage1Crack: { x: 850, y: 160, w: 52, h: 220 },
    stage2Exit: { x: 850, y: 72, w: 100, h: 46 },
    prisonDoor: { x: 700, y: 306, w: 54, h: 94 },
    prisonExit: { x: 785, y: 388, w: 96, h: 74 },
    chest: { x: 775, y: 390, w: 90, h: 70 },
  };

  const world = {
    stage2W: 1800,
    roomW: 600,
    h: 600,
  };

  const bearPatrol = [
    { x: 1510, y: 420 },
    { x: 1180, y: 505 },
    { x: 900, y: 250 },
    { x: 705, y: 430 },
    { x: 900, y: 510 },
    { x: 1120, y: 260 },
    { x: 1320, y: 505 },
    { x: 1580, y: 430 },
  ];

  function resetGame() {
    state.mode = "tutorial";
    state.message = "";
    state.messageT = 0;
    state.comicPage = 0;
    state.finalReturn = false;
    resetStage1();
  }

  function resetStage1() {
    state.stage = 1;
    state.cameraX = 0;
    state.player.x = 190;
    state.player.y = 430;
    state.hammer = false;
    state.wallBroken = false;
    state.drawer1Open = false;
  }

  function startStairs() {
    state.mode = "stairs";
    state.stage = 1.5;
    state.cameraX = 0;
    state.player.x = 470;
    state.player.y = 540;
    say("벽을 뚫고 나왔습니다. 높은 계단을 올라가세요.");
  }

  function resetStage2() {
    state.mode = "stage2";
    state.stage = 2;
    state.cameraX = 0;
    state.player.x = 180;
    state.player.y = 470;
    state.codeFound = { a: false, b: false, c: false };
    state.codeInput = "";
    state.keypad = false;
    state.hidden = false;
    state.bear = { x: 1510, y: 420, r: 23, phase: 0, route: 0, suspicion: 0, alert: false, stunned: false };
    say("코드 3개를 찾고 2번방 출입문을 여세요.");
  }

  function resetStage3() {
    state.mode = "stage3";
    state.stage = 3;
    state.cameraX = 0;
    state.player.x = 170;
    state.player.y = 455;
    state.stage3Key = false;
    state.kidFreed = false;
    state.knife = false;
    state.rescueTimer = 7;
    state.escapedPrison = false;
    say("바닥의 열쇠를 찾아 아이를 구하세요.");
  }

  function startRewardRoom(ending) {
    state.mode = "reward";
    state.stage = 4;
    state.player.x = 140;
    state.player.y = 470;
    state.finalKey = true;
    state.chestOpen = false;
    state.ending = ending;
    say(ending === "spare" ? "곰돌이가 조용히 열쇠를 건네고 사라졌습니다." : "곰돌이를 멈추고 열쇠를 얻었습니다.");
  }

  function say(text, seconds = 3) {
    state.message = text;
    state.messageT = seconds;
  }

  function button(id, text, x, y, w, h, onClick, tone = "main") {
    buttons.push({ id, text, x, y, w, h, onClick, tone });
    drawButton(text, x, y, w, h, tone);
  }

  function drawButton(text, x, y, w, h, tone) {
    const primary = tone === "main";
    ctx.save();
    ctx.fillStyle = primary ? "#f1b64a" : "rgba(255,255,255,0.11)";
    ctx.strokeStyle = primary ? "#ffe0a1" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 8, true, true);
    ctx.fillStyle = primary ? "#241208" : "#f6eefb";
    ctx.font = "700 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  function worldToScreenX(x) {
    return x - state.cameraX;
  }

  function screenToWorldX(x) {
    return x + state.cameraX;
  }

  function pointInRect(px, py, r) {
    return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
  }

  function nearRect(p, r, pad = 36) {
    return p.x + p.r > r.x - pad && p.x - p.r < r.x + r.w + pad && p.y + p.r > r.y - pad && p.y - p.r < r.y + r.h + pad;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function drawTitle(text, y, size = 42) {
    ctx.save();
    ctx.fillStyle = "#fff8ed";
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(244,68,68,0.5)";
    ctx.shadowBlur = 18;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function drawWrapped(text, x, y, maxWidth, lineHeight, style = {}) {
    ctx.save();
    ctx.fillStyle = style.color || "#f8efff";
    ctx.font = style.font || "600 22px system-ui, sans-serif";
    ctx.textAlign = style.align || "left";
    ctx.textBaseline = "top";
    const chars = [...text];
    let line = "";
    let yy = y;
    for (const ch of chars) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineHeight;
      } else {
        line = next;
      }
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawBear(x, y, scale = 1, redEyes = true, sleepy = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = sleepy ? "#a98c70" : "#8b5b38";
    ctx.strokeStyle = "#4a2d22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-20, -42, 16, 0, Math.PI * 2);
    ctx.arc(20, -42, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -18, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b98a62";
    ctx.beginPath();
    ctx.ellipse(0, 4, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#22161a";
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = redEyes ? "#ff3434" : "#201815";
    ctx.lineWidth = redEyes ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(-15, -21);
    ctx.lineTo(-6, -18);
    ctx.moveTo(15, -21);
    ctx.lineTo(6, -18);
    ctx.stroke();
    ctx.fillStyle = sleepy ? "#8b735d" : "#765032";
    ctx.beginPath();
    ctx.ellipse(0, 35, 30, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a2d22";
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-26, 24);
    ctx.lineTo(-48, 50);
    ctx.moveTo(26, 24);
    ctx.lineTo(48, 50);
    ctx.moveTo(-13, 68);
    ctx.lineTo(-20, 100);
    ctx.moveTo(13, 68);
    ctx.lineTo(20, 100);
    ctx.stroke();
    ctx.restore();
  }

  function drawKid(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#f1c596";
    ctx.beginPath();
    ctx.arc(0, -32, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#30233d";
    ctx.beginPath();
    ctx.arc(0, -42, 18, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#5bb8d6";
    ctx.fillRect(-15, -15, 30, 48);
    ctx.fillStyle = "#f1c596";
    ctx.fillRect(-27, -11, 12, 32);
    ctx.fillRect(15, -11, 12, 32);
    ctx.fillStyle = "#25324d";
    ctx.fillRect(-14, 32, 10, 32);
    ctx.fillRect(4, 32, 10, 32);
    ctx.restore();
  }

  function drawPlayer() {
    const x = worldToScreenX(state.player.x);
    const y = state.player.y;
    ctx.save();
    ctx.globalAlpha = state.hidden ? 0.48 : 1;
    ctx.fillStyle = "#76d1b2";
    ctx.strokeStyle = "#184c44";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 12, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe6bd";
    ctx.beginPath();
    ctx.arc(x, y - 28, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#30233d";
    ctx.beginPath();
    ctx.arc(x, y - 35, 12, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#29544b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 2);
    ctx.lineTo(x - 18, y + 21);
    ctx.moveTo(x + 12, y + 2);
    ctx.lineTo(x + 18, y + 21);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoomFloor(color1, color2 = "#2a1e38") {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color2;
    for (let y = 95; y < H; y += 62) {
      ctx.fillRect(0, y, W, 5);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    for (let x = 70; x < W; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 90);
      ctx.lineTo(x + 44, H);
      ctx.stroke();
    }
  }

  function drawFurnitureRect(x, y, w, h, label, color = "#4a315e") {
    const sx = worldToScreenX(x);
    if (sx + w < -80 || sx > W + 80) return;
    const code = (label.match(/\d/) || [null])[0];
    const isOpen = label.includes("열린");
    ctx.save();
    ctx.fillStyle = shade(color, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;

    if (label.includes("책상")) {
      ctx.fillStyle = "#72516d";
      roundRect(sx + 8, y + 8, w - 16, h * 0.45, 8, true, true);
      ctx.fillStyle = "#442f4a";
      ctx.fillRect(sx + 20, y + h * 0.52, 10, h * 0.35);
      ctx.fillRect(sx + w - 30, y + h * 0.52, 10, h * 0.35);
      ctx.fillStyle = "#f0c86a";
      ctx.beginPath();
      ctx.arc(sx + w * 0.35, y + h * 0.28, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (label.includes("의자")) {
      ctx.fillStyle = "#76536f";
      roundRect(sx + w * 0.18, y + 6, w * 0.64, h * 0.36, 6, true, true);
      ctx.fillStyle = "#5b3e5a";
      roundRect(sx + w * 0.12, y + h * 0.42, w * 0.76, h * 0.36, 6, true, true);
      ctx.strokeStyle = "#2b2030";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx + w * 0.24, y + h * 0.76);
      ctx.lineTo(sx + w * 0.18, y + h * 0.95);
      ctx.moveTo(sx + w * 0.76, y + h * 0.76);
      ctx.lineTo(sx + w * 0.82, y + h * 0.95);
      ctx.stroke();
    } else if (label.includes("서랍")) {
      ctx.fillStyle = isOpen ? "#80644b" : "#5a385a";
      roundRect(sx, y, w, h, 7, true, true);
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(sx + 8, y + (h / 3) * i);
        ctx.lineTo(sx + w - 8, y + (h / 3) * i);
        ctx.stroke();
      }
      ctx.fillStyle = "#d7b36a";
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(sx + w / 2 - 10, y + h * (i + 0.5) / 3 - 3, 20, 6);
      }
      if (isOpen) {
        ctx.fillStyle = "#b2875d";
        roundRect(sx + w * 0.18, y + h * 0.34, w * 0.72, h * 0.24, 5, true, true);
        ctx.fillStyle = "#211720";
        ctx.fillRect(sx + w * 0.22, y + h * 0.38, w * 0.64, h * 0.06);
      }
    } else if (label.includes("인형")) {
      ctx.fillStyle = "#65416b";
      roundRect(sx, y, w, h, 7, true, true);
      ctx.fillStyle = "#c18a62";
      ctx.beginPath();
      ctx.arc(sx + w * 0.32, y + h * 0.24, w * 0.13, 0, Math.PI * 2);
      ctx.arc(sx + w * 0.68, y + h * 0.24, w * 0.13, 0, Math.PI * 2);
      ctx.arc(sx + w * 0.5, y + h * 0.35, w * 0.24, 0, Math.PI * 2);
      ctx.ellipse(sx + w * 0.5, y + h * 0.66, w * 0.28, h * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4b2e24";
      ctx.stroke();
      ctx.fillStyle = "#211720";
      ctx.beginPath();
      ctx.arc(sx + w * 0.42, y + h * 0.33, 3, 0, Math.PI * 2);
      ctx.arc(sx + w * 0.58, y + h * 0.33, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (label.includes("책장")) {
      ctx.fillStyle = "#3b2855";
      roundRect(sx, y, w, h, 7, true, true);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      for (let shelf = 1; shelf < 4; shelf += 1) {
        ctx.beginPath();
        ctx.moveTo(sx + 8, y + (h / 4) * shelf);
        ctx.lineTo(sx + w - 8, y + (h / 4) * shelf);
        ctx.stroke();
      }
      const bookColors = ["#d86c65", "#f0c86a", "#76d1b2", "#8fa7dc", "#c88bd9"];
      for (let shelf = 0; shelf < 4; shelf += 1) {
        const by = y + shelf * (h / 4) + 12;
        for (let i = 0; i < 5; i += 1) {
          const bw = Math.max(7, w / 11);
          ctx.fillStyle = bookColors[(shelf + i) % bookColors.length];
          ctx.fillRect(sx + 12 + i * (bw + 5), by, bw, Math.max(18, h / 4 - 22));
        }
      }
    } else if (label.includes("케비넷") || label.includes("캐비넷")) {
      ctx.fillStyle = "#384b62";
      roundRect(sx, y, w, h, 7, true, true);
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      ctx.beginPath();
      ctx.moveTo(sx + w / 2, y + 8);
      ctx.lineTo(sx + w / 2, y + h - 8);
      ctx.stroke();
      ctx.fillStyle = "#9fc2d0";
      ctx.fillRect(sx + w * 0.2, y + 16, w * 0.18, 4);
      ctx.fillRect(sx + w * 0.62, y + 16, w * 0.18, 4);
      ctx.fillStyle = "#d7b36a";
      ctx.fillRect(sx + w * 0.44, y + h * 0.48, 5, 22);
      ctx.fillRect(sx + w * 0.54, y + h * 0.48, 5, 22);
    } else if (label.includes("냉장고")) {
      ctx.fillStyle = "#78909b";
      roundRect(sx, y, w, h, 8, true, true);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.moveTo(sx + 8, y + h * 0.38);
      ctx.lineTo(sx + w - 8, y + h * 0.38);
      ctx.stroke();
      ctx.fillStyle = "#d8ecf0";
      ctx.fillRect(sx + w - 18, y + 22, 5, h * 0.22);
      ctx.fillRect(sx + w - 18, y + h * 0.48, 5, h * 0.3);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(sx + 12, y + 14, w * 0.34, h - 28);
    } else if (label.includes("기둥")) {
      ctx.fillStyle = "#62536d";
      roundRect(sx, y, w, h, 7, true, true);
      ctx.fillStyle = "#7e708a";
      ctx.fillRect(sx + 8, y + 10, w - 16, 12);
      ctx.fillRect(sx + 8, y + h - 22, w - 16, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(sx + (w / 4) * i, y + 25);
        ctx.lineTo(sx + (w / 4) * i, y + h - 25);
        ctx.stroke();
      }
    } else {
      roundRect(sx, y, w, h, 7, true, true);
    }

    if (code) drawCodeSticker(sx + w * 0.62, y + h * 0.18, code);
    ctx.restore();
  }

  function drawCodeSticker(x, y, code) {
    ctx.save();
    ctx.fillStyle = "#f5efff";
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1.5;
    roundRect(x, y, 30, 34, 3, true, true);
    ctx.fillStyle = "#25140e";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code, x + 15, y + 18);
    ctx.restore();
  }

  function shade(color) {
    return color;
  }

  function drawHUD(title, detail) {
    ctx.save();
    ctx.fillStyle = "rgba(18,14,25,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    roundRect(18, 16, 560, 66, 8, true, true);
    ctx.fillStyle = "#fff8ed";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, 38, 42);
    ctx.fillStyle = "#d8cfe3";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(detail, 38, 66);
    ctx.restore();
    if (state.messageT > 0 && state.message) {
      const msgY = inventoryItems().length ? 452 : 512;
      ctx.save();
      ctx.fillStyle = "rgba(255,248,237,0.94)";
      ctx.strokeStyle = "rgba(37,20,12,0.18)";
      ctx.lineWidth = 2;
      roundRect(210, msgY, 540, 48, 8, true, true);
      ctx.fillStyle = "#25140e";
      ctx.font = "800 17px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.message, 480, msgY + 25);
      ctx.restore();
    }
  }

  function inventoryItems() {
    const items = [];
    if (state.hammer) items.push({ kind: "hammer" });
    if (state.codeFound.a) items.push({ kind: "code", value: "3" });
    if (state.codeFound.b) items.push({ kind: "code", value: "7" });
    if (state.codeFound.c) items.push({ kind: "code", value: "8" });
    if (state.stage3Key) items.push({ kind: "key" });
    if (state.knife) items.push({ kind: "knife" });
    if (state.finalKey) items.push({ kind: "finalKey" });
    return items;
  }

  function drawInventory() {
    const modes = new Set(["stage1", "stairs", "stage2", "stage3", "hallway", "reward"]);
    if (!modes.has(state.mode)) return;
    const items = inventoryItems();
    if (!items.length) return;
    const slot = 44;
    const gap = 8;
    const pad = 12;
    const width = items.length * slot + Math.max(0, items.length - 1) * gap + pad * 2;
    const x = (W - width) / 2;
    const y = H - 66;
    ctx.save();
    ctx.fillStyle = "rgba(18,14,25,0.78)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    roundRect(x, y, width, 54, 8, true, true);
    items.forEach((item, i) => {
      const sx = x + pad + i * (slot + gap);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      roundRect(sx, y + 5, slot, slot, 7, true, true);
      drawInventoryIcon(item, sx, y + 5, slot);
    });
    ctx.restore();
  }

  function drawInventoryIcon(item, x, y, size) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    if (item.kind === "hammer") {
      ctx.rotate(-0.65);
      ctx.fillStyle = "#d7b36a";
      roundRect(-4, -16, 8, 30, 3, true, false);
      ctx.fillStyle = "#8f98a7";
      roundRect(-15, -20, 30, 10, 3, true, false);
    } else if (item.kind === "code") {
      ctx.fillStyle = "#f5efff";
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      roundRect(-14, -16, 28, 32, 3, true, true);
      ctx.fillStyle = "#25140e";
      ctx.font = "900 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.value, 0, 1);
    } else if (item.kind === "key" || item.kind === "finalKey") {
      ctx.strokeStyle = item.kind === "finalKey" ? "#f4b84f" : "#d7d1e2";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-9, 0, 7, 0, Math.PI * 2);
      ctx.moveTo(-2, 0);
      ctx.lineTo(16, 0);
      ctx.moveTo(9, 0);
      ctx.lineTo(9, 8);
      ctx.moveTo(15, 0);
      ctx.lineTo(15, 6);
      ctx.stroke();
    } else if (item.kind === "knife") {
      ctx.rotate(0.7);
      ctx.fillStyle = "#d9dde7";
      ctx.beginPath();
      ctx.moveTo(-4, -20);
      ctx.lineTo(8, -5);
      ctx.lineTo(1, 12);
      ctx.lineTo(-9, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6e4933";
      roundRect(-4, 9, 9, 14, 3, true, false);
    }
    ctx.restore();
  }

  function drawMenu() {
    buttons = [];
    ctx.fillStyle = "#15111d";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2b2137";
    ctx.fillRect(0, 360, W, 240);
    ctx.fillStyle = "#3b2c4f";
    for (let i = 0; i < 18; i += 1) {
      ctx.fillRect(i * 64 - 20, 382 + (i % 2) * 20, 46, 160);
    }
    if (!state.finalReturn) {
      drawBear(475, 286, 2.0, true);
      drawKid(210, 414, 1.12);
    }
    ctx.fillStyle = "#d8cfe3";
    ctx.font = "700 21px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("버려진 인형의 집에서 아이를 찾아 나가세요", W / 2, 108);
    ctx.fillStyle = "#f4b84f";
    ctx.font = "800 18px system-ui, sans-serif";
    ctx.fillText(`보유 코인 ${state.coins.toLocaleString()}개`, W / 2, 150);
    button("start", "시작", 377, 458, 206, 58, () => resetGame());
  }

  function drawTutorial() {
    buttons = [];
    const page = comic[state.comicPage];
    ctx.fillStyle = "#101019";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#20182b";
    ctx.fillRect(40, 78, 880, 382);
    ctx.strokeStyle = "#f4b84f";
    ctx.lineWidth = 3;
    roundRect(40, 78, 880, 382, 10, false, true);
    drawComicPanel(page);
    drawTitle(page.title, 504, 30);
    drawWrapped(page.text, 168, 535, 625, 30, { font: "700 23px system-ui, sans-serif", color: "#f8efff", align: "left" });
    button("skip", "건너뛰기", 788, 22, 132, 44, () => {
      state.mode = "briefing";
    }, "ghost");
    button("next", state.comicPage === comic.length - 1 ? "설명 보기" : "다음", 406, 470, 148, 48, () => {
      if (state.comicPage >= comic.length - 1) state.mode = "briefing";
      else state.comicPage += 1;
    });
  }

  function drawComicPanel(page) {
    const baseX = 82;
    const baseY = 110;
    const w = 796;
    const h = 310;
    const grad = ctx.createLinearGradient(baseX, baseY, baseX + w, baseY + h);
    grad.addColorStop(0, "#3a2b4d");
    grad.addColorStop(1, page.mood === "street" ? "#4d3550" : "#17111f");
    ctx.fillStyle = grad;
    ctx.fillRect(baseX, baseY, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(baseX, baseY + 224, w, 86);
    ctx.fillStyle = "#0f0d14";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(baseX + 70 + i * 150, baseY + 42, 42, 182);
    }

    if (page.mood === "street") {
      drawKid(baseX + 205, baseY + 218, 1.15);
      drawBear(baseX + 418, baseY + 242, 0.82, false);
      drawWrapped("미안해...", baseX + 250, baseY + 72, 150, 24, { font: "800 22px system-ui, sans-serif" });
    } else if (page.mood === "eyes") {
      drawBear(baseX + 408, baseY + 250, 1.8, true);
      ctx.fillStyle = "rgba(255,48,48,0.2)";
      ctx.beginPath();
      ctx.ellipse(baseX + 408, baseY + 203, 175, 38, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (page.mood === "wake") {
      drawBear(baseX + 380, baseY + 242, 1.35, true);
      ctx.strokeStyle = "#f4b84f";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(baseX + 500, baseY + 258);
      ctx.lineTo(baseX + 620, baseY + 230);
      ctx.lineTo(baseX + 710, baseY + 250);
      ctx.stroke();
      drawWrapped("툭... 툭...", baseX + 540, baseY + 120, 180, 24, { font: "800 24px system-ui, sans-serif" });
    } else {
      drawKid(baseX + 650, baseY + 232, 1.0);
      drawBear(baseX + 348, baseY + 246, 1.25, true);
      ctx.strokeStyle = "#ff5454";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(baseX + 438, baseY + 188);
      ctx.lineTo(baseX + 572, baseY + 166);
      ctx.stroke();
    }
  }

  function drawBriefing() {
    buttons = [];
    ctx.fillStyle = "#16111f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2e2340";
    ctx.fillRect(0, 0, W, 136);
    drawTitle("탈출 목표", 76, 50);
    const items = [
      "1  인형의 집에서 탈출하세요",
      "2  곰돌이를 피해 코드를 찾아 잠들게 만드세요",
      "3  아이를 구하고 곰돌이를 찾아가세요",
      "4  선택을 마치고 코인을 받아가세요",
    ];
    ctx.fillStyle = "#f8efff";
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.textAlign = "left";
    items.forEach((line, i) => ctx.fillText(line, 210, 214 + i * 58));
    ctx.fillStyle = "#b9adc7";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText("조사할 물건에 가까이 가서 E를 누르거나 직접 클릭하세요.", 210, 470);
    button("play", "1단계 시작", 378, 510, 204, 54, () => {
      state.mode = "stage1";
      resetStage1();
      say("서랍을 열어 망치를 찾으세요.");
    });
  }

  function drawStage1() {
    buttons = [];
    state.cameraX = 0;
    drawRoomFloor("#2f1647", "#241036");
    ctx.fillStyle = "#22102e";
    ctx.fillRect(0, 0, W, 96);
    drawFurnitureRect(105, 278, 170, 86, "책상", "#59406b");
    drawFurnitureRect(130, 386, 70, 74, "의자", "#6b4b66");
    drawFurnitureRect(685, 352, 120, 92, state.drawer1Open ? "열린 서랍" : "서랍", state.drawer1Open ? "#80644b" : "#5a385a");
    drawFurnitureRect(378, 306, 74, 96, "인형", "#65416b");
    drawFurnitureRect(520, 168, 112, 230, "책장", "#3b2855");
    ctx.fillStyle = "#17101d";
    ctx.fillRect(842, 126, 72, 294);
    ctx.strokeStyle = state.wallBroken ? "#f4b84f" : "#ffcf79";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(880, 155);
    ctx.lineTo(858, 214);
    ctx.lineTo(894, 280);
    ctx.lineTo(864, 356);
    ctx.stroke();
    if (state.wallBroken) {
      ctx.fillStyle = "#1b1423";
      ctx.fillRect(842, 210, 72, 142);
      ctx.fillStyle = "#f4b84f";
      ctx.font = "800 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("탈출구", 878, 285);
    }
    drawPlayer();
    drawHUD("1단계 · 인형의 집", state.hammer ? "망치 획득 · 금 간 벽을 조사하세요" : "서랍 안에 망치가 있습니다");
  }

  function drawStairs() {
    buttons = [];
    ctx.fillStyle = "#17111f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#282035";
    ctx.fillRect(300, 0, 360, H);
    for (let y = -20; y < H + 40; y += 48) {
      const offset = (state.player.y * 0.3 + y) % 48;
      ctx.fillStyle = y % 96 === 0 ? "#59466e" : "#463556";
      ctx.fillRect(320, offset + y, 320, 26);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.strokeRect(320, offset + y, 320, 26);
    }
    ctx.strokeStyle = "#f4b84f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(290, 0);
    ctx.lineTo(290, H);
    ctx.moveTo(670, 0);
    ctx.lineTo(670, H);
    ctx.stroke();
    drawPlayer();
    drawHUD("계단", "위쪽으로 계속 올라가세요");
  }

  function drawStage2() {
    buttons = [];
    state.cameraX = clamp(state.player.x - W / 2, 0, world.stage2W - W);
    ctx.fillStyle = "#1b1720";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i += 1) {
      const sx = worldToScreenX(i * world.roomW);
      ctx.fillStyle = i === 1 ? "#2d2637" : "#342042";
      ctx.fillRect(sx, 100, world.roomW, 500);
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      ctx.fillRect(sx + 10, 112, world.roomW - 20, 2);
      ctx.fillStyle = "#fff8ed";
      ctx.font = "900 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}번방`, sx + world.roomW / 2, 142);
    }
    for (let i = 1; i < 3; i += 1) {
      const x = worldToScreenX(i * world.roomW);
      ctx.fillStyle = "#100d15";
      ctx.fillRect(x - 8, 100, 16, 500);
      ctx.fillStyle = "#4f3d60";
      ctx.fillRect(x - 38, 318, 76, 96);
    }
    drawStage2Furniture();
    const doorX = worldToScreenX(rects.stage2Exit.x);
    ctx.fillStyle = "#b88c4d";
    roundRect(doorX, rects.stage2Exit.y, rects.stage2Exit.w, rects.stage2Exit.h, 7, true, true);
    ctx.fillStyle = "#241208";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("출입문", doorX + 50, 101);
    drawBear(worldToScreenX(state.bear.x), state.bear.y, 0.74, true, state.bear.stunned);
    drawPlayer();
    drawHUD("2단계 · 세 개의 방", `찾은 코드 ${foundCodeText()} · ${state.hidden ? "숨는 중" : "곰돌이를 피하세요"}`);
    if (state.keypad) drawKeypad();
  }

  function drawStage2Furniture() {
    const objs = [
      [72, 230, 104, 72, state.codeFound.a ? "서랍 3" : "서랍", "#5d3a5e"],
      [250, 202, 86, 190, "책장", "#403058"],
      [410, 392, 68, 92, "케비넷", "#384b62"],
      [708, 204, 98, 178, "책장", "#403058"],
      [812, 386, 76, 90, "의자", "#6b4b66"],
      [978, 210, 70, 210, "기둥", "#62536d"],
      [1250, 228, 94, 74, "인형", "#65416b"],
      [1360, 376, 78, 112, "케비넷", "#384b62"],
      [1495, 184, 68, 240, state.codeFound.c ? "기둥 8" : "기둥", "#62536d"],
      [1630, 240, 92, 135, "냉장고", "#6f8491"],
    ];
    for (const [x, y, w, h, label, color] of objs) drawFurnitureRect(x, y, w, h, label, color);
    const code2X = worldToScreenX(822);
    if (code2X > -40 && code2X < W + 40) {
      ctx.fillStyle = state.codeFound.b ? "#f4b84f" : "#d8cfe3";
      ctx.fillRect(code2X, 204, 18, 34);
      ctx.fillStyle = "#241208";
      ctx.font = "900 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("7", code2X + 9, 229);
    }
  }

  function foundCodeText() {
    return [
      state.codeFound.a ? "3" : "_",
      state.codeFound.b ? "7" : "_",
      state.codeFound.c ? "8" : "_",
    ].join(" ");
  }

  function drawKeypad() {
    ctx.save();
    ctx.fillStyle = "rgba(8,7,11,0.84)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff8ed";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("출입문 코드", W / 2, 160);
    ctx.fillStyle = "#f4b84f";
    ctx.font = "900 44px system-ui, sans-serif";
    ctx.fillText(state.codeInput.padEnd(3, "_"), W / 2, 220);
    const nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "지움", "0", "확인"];
    for (let i = 0; i < nums.length; i += 1) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 336 + col * 100;
      const y = 262 + row * 62;
      const txt = nums[i];
      button(`key-${txt}`, txt, x, y, 84, 48, () => keypadPress(txt), txt === "확인" ? "main" : "ghost");
    }
    button("close-keypad", "닫기", 410, 524, 140, 44, () => {
      state.keypad = false;
      state.codeInput = "";
    }, "ghost");
    ctx.restore();
  }

  function drawStage3() {
    buttons = [];
    ctx.fillStyle = "#262030";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#352843";
    ctx.fillRect(36, 96, 888, 464);
    ctx.fillStyle = "rgba(180,230,255,0.18)";
    ctx.fillRect(70, 116, 820, 78);
    ctx.strokeStyle = "rgba(220,250,255,0.55)";
    ctx.lineWidth = 2;
    for (let x = 70; x <= 890; x += 82) {
      ctx.beginPath();
      ctx.moveTo(x, 116);
      ctx.lineTo(x + 48, 194);
      ctx.stroke();
    }
    drawFurnitureRect(110, 230, 100, 70, "서랍", "#5d3a5e");
    drawFurnitureRect(244, 238, 92, 170, "책장", "#403058");
    drawFurnitureRect(390, 390, 70, 96, "케비넷", "#384b62");
    drawFurnitureRect(500, 220, 68, 220, "기둥", "#62536d");
    drawFurnitureRect(590, 394, 78, 90, "의자", "#6b4b66");
    ctx.fillStyle = "#1a1620";
    ctx.fillRect(660, 236, 130, 188);
    ctx.strokeStyle = "#d7d1e2";
    ctx.lineWidth = 4;
    ctx.strokeRect(660, 236, 130, 188);
    for (let x = 680; x < 780; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 236);
      ctx.lineTo(x, 424);
      ctx.stroke();
    }
    if (!state.kidFreed) drawKid(724, 382, 0.88);
    if (!state.stage3Key) {
      ctx.save();
      ctx.translate(418, 322);
      ctx.rotate(-0.5);
      ctx.fillStyle = "#f4b84f";
      ctx.fillRect(-18, -4, 40, 8);
      ctx.beginPath();
      ctx.arc(-22, 0, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "#f4b84f";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }
    if (state.kidFreed) {
      const pulse = 6 + Math.sin(performance.now() / 130) * 4;
      ctx.fillStyle = `rgba(255,50,50,${0.12 + pulse / 80})`;
      ctx.fillRect(70, 116, 820, 78);
      drawBear(480 + Math.sin(performance.now() / 170) * 15, 158, 0.7, true);
      ctx.strokeStyle = "#ff6262";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(456, 126);
      ctx.lineTo(502, 190);
      ctx.moveTo(520, 126);
      ctx.lineTo(472, 190);
      ctx.stroke();
    }
    ctx.fillStyle = "#946a42";
    roundRect(rects.prisonExit.x, rects.prisonExit.y, rects.prisonExit.w, rects.prisonExit.h, 8, true, true);
    ctx.fillStyle = "#fff8ed";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("문", rects.prisonExit.x + 48, rects.prisonExit.y + 42);
    drawPlayer();
    const detail = state.kidFreed
      ? `남은 시간 ${Math.max(0, Math.ceil(state.rescueTimer))}초 · 감옥 옆 문으로 나가세요`
      : state.stage3Key
        ? "감옥 문을 여세요"
        : "바닥 열쇠를 찾으세요";
    drawHUD("3단계 · 감옥", detail);
  }

  function drawHallwayWait() {
    buttons = [];
    ctx.fillStyle = "#eeeef2";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d9dde7";
    ctx.fillRect(0, 420, W, 180);
    ctx.fillStyle = "#25202f";
    ctx.font = "900 38px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#5c5669";
    ctx.font = "800 24px system-ui, sans-serif";
    drawPlayer();
    drawHUD("복도", "시간이 끝나면 선택해야 합니다");
  }

  function drawChoice() {
    buttons = [];
    ctx.fillStyle = "#15111d";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2b2137";
    ctx.fillRect(0, 346, W, 254);
    drawTitle("곰돌이가 앞을 막았습니다", 122, 34);
    ctx.fillStyle = "#d8cfe3";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("아이에게 받은 칼을 쓸지, 곰돌이를 위로할지 고르세요.", W / 2, 184);
    button("kill", "1 죽이기", 242, 466, 190, 60, () => startRewardRoom("stop"));
    button("spare", "2 살리기", 528, 466, 190, 60, () => startRewardRoom("spare"), "ghost");
  }

  function drawReward() {
    buttons = [];
    ctx.fillStyle = "#f0f0f3";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#dedfe7";
    ctx.fillRect(0, 424, W, 176);
    ctx.strokeStyle = "#c6c8d0";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 72, 900, 428);
    ctx.fillStyle = "#2c2530";
    ctx.font = "900 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("하얀 방", W / 2, 116);
    ctx.fillStyle = "#7e5a35";
    roundRect(rects.chest.x, rects.chest.y, rects.chest.w, rects.chest.h, 8, true, true);
    ctx.fillStyle = state.chestOpen ? "#f4b84f" : "#b88c4d";
    ctx.fillRect(rects.chest.x + 12, rects.chest.y + 18, rects.chest.w - 24, 16);
    ctx.fillStyle = "#2b1c12";
    ctx.font = "900 15px system-ui, sans-serif";
    ctx.fillText(state.chestOpen ? "5000" : "상자", rects.chest.x + 45, rects.chest.y + 47);
    drawPlayer();
    drawHUD("보상 방", state.chestOpen ? "코인을 받았습니다. 첫 화면으로 돌아갑니다." : "구석의 상자를 열어 코인을 받으세요");
  }

  function keypadPress(txt) {
    if (txt === "지움") {
      state.codeInput = state.codeInput.slice(0, -1);
      return;
    }
    if (txt === "확인") {
      if (state.codeInput === "378") {
        state.keypad = false;
        state.bear.stunned = true;
        say("문이 열리고 곰돌이가 잠들었습니다.", 2);
        setTimeout(resetStage3, 500);
      } else {
        say("코드가 틀렸습니다.");
        state.codeInput = "";
      }
      return;
    }
    if (/^\d$/.test(txt) && state.codeInput.length < 3) state.codeInput += txt;
  }

  function interact() {
    if (state.mode === "stage1") interactStage1();
    else if (state.mode === "stage2") interactStage2();
    else if (state.mode === "stage3") interactStage3();
    else if (state.mode === "reward") interactReward();
  }

  function interactStage1() {
    if (nearRect(state.player, rects.stage1Drawer)) {
      state.drawer1Open = true;
      if (!state.hammer) {
        state.hammer = true;
        say("망치를 찾았습니다.");
      } else say("서랍은 비어 있습니다.");
      return;
    }
    if (nearRect(state.player, rects.stage1Crack)) {
      if (!state.hammer) say("벽을 뚫으려면 망치가 필요합니다.");
      else if (!state.wallBroken) {
        state.wallBroken = true;
        say("벽이 무너졌습니다. 틈으로 나가세요.");
      } else startStairs();
    }
  }

  function interactStage2() {
    const p = state.player;
    if (state.keypad) return;
    if (p.x < 200 && p.y > 190 && p.y < 340) {
      state.codeFound.a = true;
      say("서랍 안 코드: 3");
      return;
    }
    if (p.x > 780 && p.x < 870 && p.y > 170 && p.y < 270) {
      state.codeFound.b = true;
      say("책장 옆 코드: 7");
      return;
    }
    if (p.x > 1450 && p.x < 1565 && p.y > 160 && p.y < 460) {
      state.codeFound.c = true;
      say("기둥에 붙은 코드: 8");
      return;
    }
    if ((p.x > 365 && p.x < 500 && p.y > 350 && p.y < 515) || (p.x > 1325 && p.x < 1460 && p.y > 350 && p.y < 515)) {
      state.hidden = !state.hidden;
      say(state.hidden ? "케비넷 안에 숨었습니다." : "케비넷 밖으로 나왔습니다.", 1.6);
      return;
    }
    if (isNearPillar()) {
      state.hidden = true;
      say("기둥 뒤에 숨었습니다.", 1.6);
      return;
    }
    if (nearRect(p, rects.stage2Exit, 42)) {
      state.keypad = true;
      state.codeInput = "";
      return;
    }
    say("조사할 곳에 더 가까이 가세요.", 1.5);
  }

  function interactStage3() {
    const p = state.player;
    if (!state.stage3Key && Math.hypot(p.x - 418, p.y - 322) < 58) {
      state.stage3Key = true;
      say("감옥 열쇠를 주웠습니다.");
      return;
    }
    if (!state.kidFreed && state.stage3Key && nearRect(p, rects.prisonDoor, 70)) {
      state.kidFreed = true;
      state.knife = true;
      state.rescueTimer = 7;
      say("아이가 인사하고 칼을 건넨 뒤 사라졌습니다.", 3.2);
      return;
    }
    if (state.kidFreed && nearRect(p, rects.prisonExit, 54)) {
      state.mode = "hallway";
      state.player.x = 455;
      state.player.y = 460;
      state.escapedPrison = true;
      return;
    }
    say("아직 할 일이 남아 있습니다.", 1.5);
  }

  function interactReward() {
    if (!state.chestOpen && nearRect(state.player, rects.chest, 64)) {
      state.chestOpen = true;
      state.coins += 5000;
      localStorage.setItem(STORAGE_KEY, String(state.coins));
      say("5000코인을 받았습니다.", 2);
      setTimeout(() => {
        state.finalReturn = true;
        state.mode = "menu";
      }, 1200);
    }
  }

  function handleClick(x, y) {
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const b = buttons[i];
      if (pointInRect(x, y, b)) {
        b.onClick();
        return;
      }
    }
    if (state.mode === "stage1" && pointInRect(x, y, rects.stage1Drawer)) {
      state.player.x = rects.stage1Drawer.x - 45;
      state.player.y = rects.stage1Drawer.y + 45;
      interactStage1();
      return;
    }
    if (state.mode === "stage1" && pointInRect(x, y, rects.stage1Crack)) {
      state.player.x = rects.stage1Crack.x - 45;
      state.player.y = rects.stage1Crack.y + 120;
      interactStage1();
      return;
    }
    if (state.mode === "stage2") {
      const wx = screenToWorldX(x);
      state.player.x = clamp(wx, 40, world.stage2W - 40);
      state.player.y = clamp(y, 145, 545);
      if (isNearPillar()) state.hidden = true;
      else if (!isNearCabinet()) state.hidden = false;
      interactStage2();
      return;
    }
    if (state.mode === "stage3" || state.mode === "reward") {
      state.player.x = clamp(x, 50, 900);
      state.player.y = clamp(y, 150, 535);
      interact();
    }
  }

  function update(dt) {
    if (state.messageT > 0) state.messageT = Math.max(0, state.messageT - dt);
    if (state.keypad) return;

    if (["stage1", "stairs", "stage2", "stage3", "hallway", "reward"].includes(state.mode)) {
      updatePlayer(dt);
    }
    if (state.mode === "stairs" && state.player.y < 54) resetStage2();
    if (state.mode === "stage2") updateBear(dt);
    if (state.mode === "stage3" && state.kidFreed) {
      state.rescueTimer = Math.max(0, state.rescueTimer - dt);
      if (state.rescueTimer <= 0 && !state.escapedPrison) {
        say("시간이 끝났습니다. 감옥 앞에서 다시 시작합니다.");
        resetStage3();
      }
    }
    if (state.mode === "hallway") {
      state.rescueTimer = Math.max(0, state.rescueTimer - dt);
      if (state.rescueTimer <= 0) state.mode = "choice";
    }
  }

  function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (hasInput("ArrowLeft") || hasInput("a")) dx -= 1;
    if (hasInput("ArrowRight") || hasInput("d")) dx += 1;
    if (hasInput("ArrowUp") || hasInput("w")) dy -= 1;
    if (hasInput("ArrowDown") || hasInput("s")) dy += 1;
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy) || 1;
    const speed = state.hidden ? 58 : state.player.speed;
    state.player.x += (dx / len) * speed * dt;
    state.player.y += (dy / len) * speed * dt;

    if (state.mode === "stage1") {
      state.player.x = clamp(state.player.x, 38, state.wallBroken ? 922 : 822);
      state.player.y = clamp(state.player.y, 120, 545);
      if (state.wallBroken && state.player.x > 905) startStairs();
    } else if (state.mode === "stairs") {
      state.player.x = clamp(state.player.x, 345, 615);
      state.player.y = clamp(state.player.y, 32, 562);
    } else if (state.mode === "stage2") {
      state.player.x = clamp(state.player.x, 42, world.stage2W - 42);
      state.player.y = clamp(state.player.y, 145, 545);
      if (isNearPillar()) state.hidden = true;
      else if (state.hidden && !isNearCabinet()) state.hidden = false;
    } else if (state.mode === "stage3") {
      state.player.x = clamp(state.player.x, 54, 900);
      state.player.y = clamp(state.player.y, 145, 538);
    } else if (state.mode === "hallway") {
      state.player.x = clamp(state.player.x, 100, 860);
      state.player.y = clamp(state.player.y, 390, 522);
    } else if (state.mode === "reward") {
      state.player.x = clamp(state.player.x, 52, 900);
      state.player.y = clamp(state.player.y, 150, 540);
    }
  }

  function hasInput(key) {
    return keys.has(key) || heldControls.has(key);
  }

  function isNearCabinet() {
    const p = state.player;
    return (p.x > 360 && p.x < 505 && p.y > 345 && p.y < 520) || (p.x > 1322 && p.x < 1466 && p.y > 342 && p.y < 520);
  }

  function isNearPillar() {
    const p = state.player;
    return (p.x > 930 && p.x < 1085 && p.y > 180 && p.y < 470) ||
      (p.x > 1455 && p.x < 1585 && p.y > 160 && p.y < 470);
  }

  function updateBear(dt) {
    if (state.bear.stunned) return;
    state.bear.phase += dt;
    const bear = state.bear;
    const p = state.player;
    if (typeof bear.route !== "number") bear.route = 0;
    if (typeof bear.suspicion !== "number") bear.suspicion = 0;
    const sameBand = Math.abs(p.y - bear.y) < 82 && Math.abs(p.x - bear.x) < 430;
    const closeEnough = dist(p, bear) < 155;
    const spotted = !state.hidden && (sameBand || closeEnough);
    if (spotted) {
      bear.suspicion = Math.min(1.3, bear.suspicion + dt);
    } else {
      bear.suspicion = Math.max(0, bear.suspicion - dt * 1.7);
    }
    bear.alert = bear.suspicion > 0.85;
    const confusedSlowdown = !bear.alert && bear.suspicion > 0 ? 0.42 : 1;
    const patrolPause = !bear.alert && Math.sin(bear.phase * 2.15) > 0.93 ? 0.22 : 1;
    const speed = (bear.alert ? 185 : 128) * confusedSlowdown * patrolPause;
    let targetX;
    let targetY;
    if (bear.alert) {
      targetX = p.x;
      targetY = p.y;
    } else {
      const target = bearPatrol[bear.route % bearPatrol.length];
      targetX = target.x;
      targetY = target.y;
      if (Math.hypot(targetX - bear.x, targetY - bear.y) < 38) {
        bear.route = (bear.route + 1) % bearPatrol.length;
      }
    }
    const dx = targetX - bear.x;
    const dy = targetY - bear.y;
    const d = Math.hypot(dx, dy) || 1;
    bear.x += (dx / d) * speed * dt;
    bear.y += (dy / d) * speed * dt;
    bear.x = clamp(bear.x, 620, 1760);
    bear.y = clamp(bear.y, 155, 545);
    if (!state.hidden && dist(p, bear) < 43) {
      say("곰돌이에게 들켰습니다. 1번방에서 다시 시작합니다.", 2.5);
      state.player.x = 180;
      state.player.y = 470;
      state.hidden = false;
      bear.x = 1510;
      bear.y = 420;
      bear.route = 0;
      bear.suspicion = 0;
      state.cameraX = 0;
    }
  }

  function render() {
    if (state.mode === "menu") drawMenu();
    else if (state.mode === "tutorial") drawTutorial();
    else if (state.mode === "briefing") drawBriefing();
    else if (state.mode === "stage1") drawStage1();
    else if (state.mode === "stairs") drawStairs();
    else if (state.mode === "stage2") drawStage2();
    else if (state.mode === "stage3") drawStage3();
    else if (state.mode === "hallway") drawHallwayWait();
    else if (state.mode === "choice") drawChoice();
    else if (state.mode === "reward") drawReward();
    drawInventory();
  }

  function loop(t) {
    if (!virtualMode) {
      const dt = Math.min(0.033, (t - lastTime || 16) / 1000);
      update(dt);
      render();
    }
    lastTime = t;
    requestAnimationFrame(loop);
  }

  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * W,
      y: ((evt.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("mousemove", (evt) => {
    const p = canvasPoint(evt);
    pointer.x = p.x;
    pointer.y = p.y;
  });

  canvas.addEventListener("click", (evt) => {
    const p = canvasPoint(evt);
    handleClick(p.x, p.y);
    render();
  });

  for (const btn of document.querySelectorAll("[data-hold]")) {
    const key = btn.dataset.hold;
    const press = (evt) => {
      evt.preventDefault();
      heldControls.add(key);
      btn.classList.add("is-active");
    };
    const release = (evt) => {
      evt.preventDefault();
      heldControls.delete(key);
      btn.classList.remove("is-active");
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
  }

  const actionButton = document.querySelector("[data-action='interact']");
  actionButton.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    actionButton.classList.add("is-active");
    interact();
    render();
  });
  actionButton.addEventListener("pointerup", () => actionButton.classList.remove("is-active"));
  actionButton.addEventListener("pointercancel", () => actionButton.classList.remove("is-active"));
  actionButton.addEventListener("pointerleave", () => actionButton.classList.remove("is-active"));

  for (const el of [canvas, document.querySelector(".touch-controls")]) {
    for (const eventName of ["contextmenu", "selectstart", "dragstart"]) {
      el.addEventListener(eventName, (evt) => evt.preventDefault());
    }
  }

  window.addEventListener("blur", () => {
    heldControls.clear();
    for (const btn of document.querySelectorAll("[data-hold]")) btn.classList.remove("is-active");
  });

  const preventZoom = (evt) => evt.preventDefault();
  document.addEventListener("gesturestart", preventZoom, { passive: false });
  document.addEventListener("gesturechange", preventZoom, { passive: false });
  document.addEventListener("gestureend", preventZoom, { passive: false });
  document.addEventListener("dblclick", preventZoom, { passive: false });
  document.addEventListener("touchmove", (evt) => {
    if (evt.touches && evt.touches.length > 1) evt.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", (evt) => {
    const k = evt.key.length === 1 ? evt.key.toLowerCase() : evt.key;
    if (k === "f") {
      if (!document.fullscreenElement) canvas.requestFullscreen?.();
      else document.exitFullscreen?.();
    } else if (k === "e" || k === "Enter") {
      interact();
      render();
    } else if (state.keypad && /^\d$/.test(k)) {
      keypadPress(k);
      render();
    } else if (state.keypad && k === "Backspace") {
      keypadPress("지움");
      render();
    } else if (state.keypad && k === "Escape") {
      state.keypad = false;
      state.codeInput = "";
      render();
    }
    keys.add(k);
  });

  window.addEventListener("keyup", (evt) => {
    keys.delete(evt.key.length === 1 ? evt.key.toLowerCase() : evt.key);
  });

  window.advanceTime = (ms) => {
    virtualMode = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) update(1 / 60);
    render();
    virtualMode = false;
  };

  window.render_game_to_text = () => {
    const payload = {
      note: "Canvas coordinates: origin top-left, x right, y down.",
      mode: state.mode,
      stage: state.stage,
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        hidden: state.hidden,
      },
      objective: currentObjective(),
      inventory: {
        hammer: state.hammer,
        code: foundCodeText(),
        stage3Key: state.stage3Key,
        knife: state.knife,
        finalKey: state.finalKey,
      },
      bear: state.mode === "stage2" ? {
        x: Math.round(state.bear.x),
        y: Math.round(state.bear.y),
        alert: state.bear.alert,
        suspicion: Number((state.bear.suspicion || 0).toFixed(2)),
        stunned: state.bear.stunned,
      } : undefined,
      timer: state.mode === "stage3" || state.mode === "hallway" ? Math.ceil(state.rescueTimer) : undefined,
      coins: state.coins,
      message: state.messageT > 0 ? state.message : "",
    };
    return JSON.stringify(payload);
  };

  function currentObjective() {
    if (state.mode === "menu") return "start the game";
    if (state.mode === "tutorial") return "watch or skip comic";
    if (state.mode === "briefing") return "read objectives and start stage 1";
    if (state.mode === "stage1") return state.hammer ? "break cracked wall with hammer" : "open drawer and collect hammer";
    if (state.mode === "stairs") return "climb the tall stairs";
    if (state.mode === "stage2") return state.keypad ? "enter code 378" : "find codes 3, 7, 8 and open exit";
    if (state.mode === "stage3") return state.kidFreed ? "leave before timer ends" : state.stage3Key ? "unlock prison" : "collect prison key";
    if (state.mode === "hallway") return "wait for final bear choice";
    if (state.mode === "choice") return "choose kill or spare";
    if (state.mode === "reward") return "open chest for 5000 coins";
    return "";
  }

  render();
  requestAnimationFrame(loop);
})();
