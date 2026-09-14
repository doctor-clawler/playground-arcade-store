import * as THREE from "./node_modules/three/build/three.module.js";

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 16 / 10, 0.05, 120);
const clock = new THREE.Clock();

const keys = new Set();
const heldControls = new Set();
const colliders = [];
const interactables = [];
const hidingSpots = [];

const STORAGE_KEY = "gomdori-coins-3d";

const state = {
  mode: "menu",
  stage: 0,
  coins: Number(localStorage.getItem(STORAGE_KEY) || "0"),
  player: {
    x: 0,
    y: 1.55,
    z: 4,
    yaw: Math.PI,
    pitch: 0,
    radius: 0.35,
    hidden: false,
    hideSpotType: null,
    hideSpotX: null,
    hideSpotZ: null,
    hideSpotRadius: 0,
  },
  bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
  hammer: false,
  codeFound: { a: false, b: false, c: false },
  stage3Key: false,
  knife: false,
  finalKey: false,
  chestOpen: false,
  kidFreed: false,
  rescueTimer: 7,
  finalReturn: false,
  message: "",
  messageT: 0,
  keypadOpen: false,
  codeInput: "",
  bear: { x: 16, z: 2.5, y: 0, route: 0, suspicion: 0, alert: false, stunned: false },
};

const materials = {
  wallPurple: new THREE.MeshStandardMaterial({ color: "#2f1647", roughness: 0.82 }),
  wallDark: new THREE.MeshStandardMaterial({ color: "#1a1423", roughness: 0.9 }),
  floorPurple: new THREE.MeshStandardMaterial({ color: "#342042", roughness: 0.86 }),
  floorGrey: new THREE.MeshStandardMaterial({ color: "#d9dde7", roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: "#f0f0f3", roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: "#f4b84f", roughness: 0.45, metalness: 0.05 }),
  wood: new THREE.MeshStandardMaterial({ color: "#765032", roughness: 0.72 }),
  woodLight: new THREE.MeshStandardMaterial({ color: "#b88c4d", roughness: 0.6 }),
  cabinet: new THREE.MeshStandardMaterial({ color: "#384b62", roughness: 0.72 }),
  bookcase: new THREE.MeshStandardMaterial({ color: "#3b2855", roughness: 0.76 }),
  pillar: new THREE.MeshStandardMaterial({ color: "#62536d", roughness: 0.8 }),
  code: new THREE.MeshStandardMaterial({ color: "#f5efff", roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: "#ff3434", emissive: "#661111", roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: "#b8dcf3", transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.04 }),
};

const bearPatrol3D = [
  { x: 16, z: 2.5 },
  { x: 11.5, z: 3.4 },
  { x: 8.3, z: -2.4 },
  { x: 5.9, z: 2.2 },
  { x: 9.2, z: 3.5 },
  { x: 12.7, z: -2.8 },
  { x: 16.2, z: 2.5 },
];

const ui = createUi();
setupLights();
showMenu();
resize();
renderer.setAnimationLoop(loop);

function createUi() {
  const root = document.createElement("div");
  root.className = "fp-ui";
  root.innerHTML = `
    <div class="fp-chip" id="fpObjective"></div>
    <div class="fp-center" id="fpPrompt"></div>
    <div class="fp-inventory" id="fpInventory"></div>
    <div class="fp-cabinet-hide" id="fpCabinetHide" aria-hidden="true">
      <div class="cabinet-scene">
        <div class="cabinet-picture" aria-hidden="true">
          <div class="cabinet-door left"></div>
          <div class="cabinet-door right"></div>
          <div class="cabinet-handle left"></div>
          <div class="cabinet-handle right"></div>
          <div class="cabinet-shadow"></div>
        </div>
        <div class="cabinet-text">케비넷에 숨었습니다</div>
      </div>
    </div>
    <div class="fp-panel" id="fpPanel"></div>
  `;
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    .fp-ui, .fp-ui * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      box-sizing: border-box;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .fp-chip {
      position: fixed;
      left: 18px;
      top: 18px;
      z-index: 10;
      min-width: 220px;
      max-width: min(520px, calc(100vw - 36px));
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(18,14,25,0.78);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff8ed;
      font-weight: 850;
      line-height: 1.32;
      pointer-events: none;
    }
    .fp-center {
      position: fixed;
      left: 50%;
      bottom: 150px;
      z-index: 10;
      transform: translateX(-50%);
      min-width: 280px;
      max-width: min(620px, calc(100vw - 32px));
      padding: 12px 16px;
      border-radius: 8px;
      background: rgba(255,248,237,0.94);
      color: #25140e;
      border: 1px solid rgba(37,20,12,0.18);
      text-align: center;
      font-weight: 850;
      opacity: 0;
      transition: opacity 120ms ease;
      pointer-events: none;
    }
    .fp-center.is-visible { opacity: 1; }
    .fp-inventory {
      position: fixed;
      left: 50%;
      bottom: 82px;
      z-index: 10;
      transform: translateX(-50%);
      display: none;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(18,14,25,0.78);
      border: 1px solid rgba(255,255,255,0.18);
      pointer-events: none;
    }
    .fp-inventory.is-visible { display: flex; }
    .fp-cabinet-hide {
      position: fixed;
      inset: 0;
      z-index: 18;
      display: none;
      place-items: center;
      background: #030305;
      pointer-events: none;
    }
    .fp-cabinet-hide.is-visible { display: grid; }
    .cabinet-scene {
      display: grid;
      justify-items: center;
      gap: 22px;
      transform: translateY(-5vh);
    }
    .cabinet-picture {
      position: relative;
      width: min(210px, 52vw);
      height: min(250px, 60vw);
      border: 8px solid #1f2530;
      border-radius: 7px;
      background: linear-gradient(90deg, #263246 0 49%, #121722 49% 51%, #2d3b51 51% 100%);
      box-shadow: 0 28px 70px rgba(0,0,0,0.72), inset 0 0 42px rgba(0,0,0,0.62);
    }
    .cabinet-picture::before,
    .cabinet-picture::after {
      content: "";
      position: absolute;
      left: 18px;
      right: 18px;
      height: 5px;
      border-radius: 4px;
      background: rgba(216,224,237,0.18);
    }
    .cabinet-picture::before { top: 34px; }
    .cabinet-picture::after { top: 55px; }
    .cabinet-door {
      position: absolute;
      top: 0;
      width: 50%;
      height: 100%;
      border: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.2));
    }
    .cabinet-door.left { left: 0; }
    .cabinet-door.right { right: 0; }
    .cabinet-handle {
      position: absolute;
      top: 46%;
      width: 8px;
      height: 52px;
      border-radius: 8px;
      background: #f4b84f;
      box-shadow: 0 0 16px rgba(244,184,79,0.28);
    }
    .cabinet-handle.left { right: 51%; }
    .cabinet-handle.right { left: 51%; }
    .cabinet-shadow {
      position: absolute;
      left: 18%;
      right: 18%;
      bottom: -22px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0,0,0,0.72);
      filter: blur(6px);
    }
    .cabinet-text {
      color: #fff8ed;
      font-size: clamp(24px, 5vw, 42px);
      font-weight: 950;
      line-height: 1.25;
      text-align: center;
      text-shadow: 0 4px 24px rgba(0,0,0,0.95);
      letter-spacing: 0;
    }
    .fp-slot {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.28);
      color: #fff8ed;
      font-weight: 900;
      font-size: 22px;
    }
    .fp-panel {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: none;
      place-items: center;
      padding: 24px;
      background: rgba(11,8,15,0.62);
    }
    .fp-panel.is-visible { display: grid; }
    .fp-box {
      min-width: min(420px, calc(100vw - 40px));
      padding: 24px;
      border-radius: 10px;
      background: rgba(18,14,25,0.92);
      border: 1px solid rgba(255,255,255,0.22);
      color: #fff8ed;
      text-align: center;
    }
    .fp-box p { margin: 8px 0 18px; color: #d8cfe3; font-weight: 750; }
    .fp-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .fp-actions button, .fp-keypad button {
      appearance: none;
      min-width: 92px;
      min-height: 48px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.12);
      color: #fff8ed;
      font-size: 18px;
      font-weight: 850;
    }
    .fp-actions button.primary, .fp-keypad button.primary { background: #f4b84f; color: #241208; border-color: #ffe0a1; }
    .fp-keypad { display: grid; grid-template-columns: repeat(3, 64px); gap: 8px; justify-content: center; }
    .fp-code-display { margin: 0 0 14px; font-size: 34px; font-weight: 900; color: #f4b84f; letter-spacing: 6px; }
  `;
  document.head.appendChild(style);

  return {
    root,
    objective: root.querySelector("#fpObjective"),
    prompt: root.querySelector("#fpPrompt"),
    inventory: root.querySelector("#fpInventory"),
    cabinetHide: root.querySelector("#fpCabinetHide"),
    panel: root.querySelector("#fpPanel"),
  };
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2d173c, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d5, 1.2);
  sun.position.set(5, 10, 5);
  sun.castShadow = true;
  scene.add(sun);
}

function clearWorld() {
  for (let i = scene.children.length - 1; i >= 0; i -= 1) {
    const child = scene.children[i];
    if (child.isLight) continue;
    scene.remove(child);
    child.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
    });
  }
  colliders.length = 0;
  interactables.length = 0;
  hidingSpots.length = 0;
}

function showMenu() {
  state.mode = "menu";
  clearWorld();
  scene.background = new THREE.Color("#15111d");
  createRoom({ centerX: 0, width: 9, depth: 7, wall: materials.wallDark, floor: materials.floorPurple, openFront: true });
  if (!state.finalReturn) {
    const menuBear = createBearMesh(0, 1.8, 0.8, 1.55);
    menuBear.rotation.y = Math.PI;
    createKidMesh(-2.5, 1.2, 2.1, 0.85);
  }
  setPlayer(0, 4.1, 0);
  ui.panel.classList.add("is-visible");
  ui.panel.innerHTML = `
    <div class="fp-box">
      <p>보유 코인 ${state.coins.toLocaleString()}개</p>
      <div class="fp-actions"><button class="primary" id="start3d">시작</button></div>
    </div>
  `;
  ui.panel.querySelector("#start3d").addEventListener("click", () => {
    ui.panel.classList.remove("is-visible");
    resetStage1();
  });
  updateUi();
}

function resetStage1() {
  state.mode = "stage1";
  state.stage = 1;
  state.hammer = false;
  state.finalReturn = false;
  clearWorld();
  scene.background = new THREE.Color("#16111f");
  state.bounds = { minX: -5.2, maxX: 5.2, minZ: -6.2, maxZ: 6.2 };
  createRoom({ centerX: 0, width: 10, depth: 12, wall: materials.wallPurple, floor: materials.floorPurple });
  createDesk(-3.1, 2.2);
  createChair(-3.6, 3.35);
  addFurniture("drawer", 3.1, 2.0, { interactive: true, id: "stage1-drawer" });
  createDoll(-0.8, 1.6);
  createBookcase(1.2, -2.2);
  createCrackedWall(4.7, -2.7);
  addInteractable({ id: "stage1-wall", label: "금 간 벽", x: 4.7, z: -2.7, radius: 1.3, onInteract: interactStage1Wall });
  setPlayer(-2.4, 4.2, 0);
  say("서랍을 열어 망치를 찾으세요.");
}

function startStairs() {
  state.mode = "stairs";
  clearWorld();
  scene.background = new THREE.Color("#17111f");
  state.bounds = { minX: -2.2, maxX: 2.2, minZ: -13, maxZ: 4.2 };
  createCorridor(4.2, 17, materials.wallDark, materials.floorPurple);
  for (let i = 0; i < 16; i += 1) {
    const step = box(3.8, 0.12, 0.75, "#59466e");
    step.position.set(0, 0.05 + i * 0.035, 3 - i * 0.9);
    scene.add(step);
  }
  setPlayer(0, 3.5, 0);
  say("계단을 올라가세요.");
}

function resetStage2() {
  state.mode = "stage2";
  state.stage = 2;
  state.codeFound = { a: false, b: false, c: false };
  state.keypadOpen = false;
  state.codeInput = "";
  state.hidden = false;
  state.bear = { x: 16, z: 2.5, y: 0, route: 0, suspicion: 0, alert: false, stunned: false };
  clearWorld();
  scene.background = new THREE.Color("#17111f");
  state.bounds = { minX: -4.4, maxX: 20.4, minZ: -5.2, maxZ: 5.2 };
  for (let i = 0; i < 3; i += 1) createRoom({ centerX: i * 8, width: 7.8, depth: 10, wall: i === 1 ? materials.wallDark : materials.wallPurple, floor: materials.floorPurple, doorLeft: i > 0, doorRight: i < 2 });
  addFurniture("drawer", -2.0, 1.4, { interactive: true, id: "code3" });
  createBookcase(-0.2, -2.8);
  createCabinet(2.1, 2.6, true);
  createBookcase(8.0, -2.7);
  createCodePaper(8.9, -2.65, "7", "code7");
  createChair(9.5, 2.7);
  createPillar(10.2, 0.3, true);
  createDoll(13.0, -1.8);
  createCabinet(14.1, 2.7, true);
  createPillar(15.1, 0.1, true);
  createCodePaper(15.5, 0.1, "8", "code8");
  createFridge(18.1, -1.5);
  createExitDoor(8, -4.85);
  addInteractable({ id: "stage2-exit", label: "출입문", x: 8, z: -4.55, radius: 1.4, onInteract: interactStage2Exit });
  createBearMesh(state.bear.x, 0, state.bear.z, 0.75);
  setPlayer(0, 2.8, 0);
  say("코드 3개를 찾으세요.");
}

function resetStage3() {
  state.mode = "stage3";
  state.stage = 3;
  state.stage3Key = false;
  state.kidFreed = false;
  state.knife = false;
  state.rescueTimer = 7;
  clearWorld();
  scene.background = new THREE.Color("#211a2b");
  state.bounds = { minX: -5.2, maxX: 5.2, minZ: -5.2, maxZ: 5.2 };
  createRoom({ centerX: 0, width: 10, depth: 10, wall: materials.wallDark, floor: materials.floorPurple });
  createGlassCeilingBear();
  addFurniture("drawer", -3.1, -1.8, {});
  createBookcase(-2.4, 1.4);
  createCabinet(-0.6, 2.8, false);
  createPillar(0.8, -0.3, false);
  createChair(2.1, 2.6);
  createCell(3.3, -0.3);
  createKidMesh(3.3, 0.9, -0.3, 0.55);
  createKeyMesh(-0.8, 0.05, 1.2, "prison-key");
  addInteractable({ id: "prison-key", label: "열쇠", x: -0.8, z: 1.2, radius: 1.2, onInteract: () => {
    if (!state.stage3Key) {
      state.stage3Key = true;
      say("감옥 열쇠를 주웠습니다.");
    }
  } });
  addInteractable({ id: "cell", label: "감옥", x: 3.1, z: -0.3, radius: 1.6, onInteract: interactCell });
  createExitDoor(4.6, 3.1);
  addInteractable({ id: "prison-exit", label: "문", x: 4.45, z: 3.1, radius: 1.4, onInteract: interactPrisonExit });
  setPlayer(-3.5, 3.8, 0);
  say("바닥 열쇠를 찾으세요.");
}

function showHallway() {
  state.mode = "hallway";
  clearWorld();
  scene.background = new THREE.Color("#eeeeF2");
  state.bounds = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
  createRoom({ centerX: 0, width: 8, depth: 8, wall: materials.white, floor: materials.floorGrey, openFront: true });
  setPlayer(0, 2.8, 0);
}

function showChoice() {
  state.mode = "choice";
  ui.panel.classList.add("is-visible");
  ui.panel.innerHTML = `
    <div class="fp-box">
      <h2>곰돌이가 앞을 막았습니다</h2>
      <p>아이에게 받은 칼을 쓸지, 곰돌이를 위로할지 고르세요.</p>
      <div class="fp-actions">
        <button class="primary" id="choiceKill">1 죽이기</button>
        <button id="choiceSpare">2 살리기</button>
      </div>
    </div>
  `;
  ui.panel.querySelector("#choiceKill").addEventListener("click", () => startRewardRoom("stop"));
  ui.panel.querySelector("#choiceSpare").addEventListener("click", () => startRewardRoom("spare"));
}

function startRewardRoom(ending) {
  state.mode = "reward";
  state.stage = 4;
  state.finalKey = true;
  state.chestOpen = false;
  ui.panel.classList.remove("is-visible");
  clearWorld();
  scene.background = new THREE.Color("#f0f0f3");
  state.bounds = { minX: -4.5, maxX: 4.5, minZ: -5, maxZ: 5 };
  createRoom({ centerX: 0, width: 9, depth: 10, wall: materials.white, floor: materials.floorGrey });
  createChest(2.6, -1.2);
  addInteractable({ id: "chest", label: "상자", x: 2.6, z: -1.2, radius: 1.4, onInteract: interactChest });
  setPlayer(-2.8, 3.2, 0);
  say(ending === "spare" ? "곰돌이가 열쇠를 주고 사라졌습니다." : "열쇠를 얻었습니다.");
}

function createRoom({ centerX, width, depth, wall, floor, openFront = false, doorLeft = false, doorRight = false }) {
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), floor);
  floorMesh.position.set(centerX, -0.04, 0);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  const wallH = 3.2;
  const t = 0.18;
  addWall(centerX, wallH / 2, -depth / 2, width, wallH, t, wall);
  if (!openFront) addWall(centerX, wallH / 2, depth / 2, width, wallH, t, wall);
  if (!doorLeft) addWall(centerX - width / 2, wallH / 2, 0, t, wallH, depth, wall);
  if (!doorRight) addWall(centerX + width / 2, wallH / 2, 0, t, wallH, depth, wall);
}

function createCorridor(width, depth, wall, floor) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), floor);
  f.position.set(0, -0.04, -4.3);
  f.receiveShadow = true;
  scene.add(f);
  addWall(-width / 2, 1.6, -4.3, 0.16, 3.2, depth, wall);
  addWall(width / 2, 1.6, -4.3, 0.16, 3.2, depth, wall);
}

function addWall(x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function box(w, h, d, colorOrMat) {
  const mat = typeof colorOrMat === "string" ? new THREE.MeshStandardMaterial({ color: colorOrMat, roughness: 0.72 }) : colorOrMat;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(radius, height, mat, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addFurniture(kind, x, z, opts = {}) {
  if (kind === "drawer") {
    const group = new THREE.Group();
    const body = box(1.2, 1.0, 0.55, opts.open ? materials.woodLight : materials.wood);
    body.position.y = 0.5;
    group.add(body);
    for (let i = 0; i < 3; i += 1) {
      const handle = box(0.28, 0.05, 0.06, materials.gold);
      handle.position.set(0, 0.25 + i * 0.26, -0.31);
      group.add(handle);
    }
    group.position.set(x, 0, z);
    scene.add(group);
    if (opts.interactive) addInteractable({ id: opts.id, label: "서랍", x, z, radius: 1.3, onInteract: interactDrawer });
  }
}

function createDesk(x, z) {
  const group = new THREE.Group();
  const top = box(1.7, 0.16, 0.75, "#72516d");
  top.position.y = 0.78;
  group.add(top);
  for (const lx of [-0.65, 0.65]) {
    for (const lz of [-0.25, 0.25]) {
      const leg = box(0.12, 0.72, 0.12, "#442f4a");
      leg.position.set(lx, 0.35, lz);
      group.add(leg);
    }
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function createChair(x, z) {
  const group = new THREE.Group();
  const seat = box(0.75, 0.16, 0.75, "#76536f");
  seat.position.y = 0.45;
  const back = box(0.75, 0.75, 0.12, "#76536f");
  back.position.set(0, 0.85, 0.32);
  group.add(seat, back);
  group.position.set(x, 0, z);
  scene.add(group);
}

function createBookcase(x, z) {
  const group = new THREE.Group();
  const frame = box(1.2, 2.1, 0.35, materials.bookcase);
  frame.position.y = 1.05;
  group.add(frame);
  const colors = ["#d86c65", "#f0c86a", "#76d1b2", "#8fa7dc", "#c88bd9"];
  for (let row = 0; row < 4; row += 1) {
    for (let i = 0; i < 5; i += 1) {
      const book = box(0.12, 0.32, 0.06, colors[(row + i) % colors.length]);
      book.position.set(-0.42 + i * 0.2, 0.35 + row * 0.44, -0.22);
      group.add(book);
    }
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function createCabinet(x, z, hiding) {
  const group = new THREE.Group();
  const body = box(1, 1.55, 0.55, materials.cabinet);
  body.position.y = 0.78;
  group.add(body);
  const handle = box(0.08, 0.42, 0.06, materials.gold);
  handle.position.set(0.14, 0.8, -0.31);
  group.add(handle);
  group.position.set(x, 0, z);
  scene.add(group);
  if (hiding) hidingSpots.push({ x, z, radius: 1.25, type: "cabinet" });
}

function createPillar(x, z, hiding) {
  const group = new THREE.Group();
  const p = cyl(0.36, 2.35, materials.pillar, 20);
  p.position.y = 1.18;
  group.add(p);
  const base = box(0.92, 0.18, 0.92, materials.pillar);
  base.position.y = 0.09;
  group.add(base);
  const top = box(0.92, 0.18, 0.92, materials.pillar);
  top.position.y = 2.27;
  group.add(top);
  group.position.set(x, 0, z);
  scene.add(group);
  if (hiding) hidingSpots.push({ x, z, radius: 1.2, type: "pillar" });
}

function createDoll(x, z) {
  const group = createBearGroup(0.32, false);
  group.position.set(x, 0.05, z);
  scene.add(group);
}

function createFridge(x, z) {
  const group = new THREE.Group();
  const body = box(1.1, 1.9, 0.75, "#78909b");
  body.position.y = 0.95;
  group.add(body);
  const handle = box(0.08, 0.7, 0.08, "#d8ecf0");
  handle.position.set(0.42, 1.0, -0.43);
  group.add(handle);
  group.position.set(x, 0, z);
  scene.add(group);
}

function createCodePaper(x, z, digit, id) {
  const paper = box(0.42, 0.5, 0.04, materials.code);
  paper.position.set(x, 1.15, z);
  scene.add(paper);
  addInteractable({ id, label: `코드 ${digit}`, x, z, radius: 1.1, onInteract: () => {
    if (digit === "7") state.codeFound.b = true;
    if (digit === "8") state.codeFound.c = true;
    say(`코드 ${digit}을 찾았습니다.`);
  } });
}

function createCrackedWall(x, z) {
  const crack = box(0.08, 2.0, 0.08, materials.gold);
  crack.position.set(x, 1.1, z);
  crack.rotation.z = 0.45;
  scene.add(crack);
}

function createExitDoor(x, z) {
  const door = box(1.35, 2.15, 0.15, materials.woodLight);
  door.position.set(x, 1.05, z);
  scene.add(door);
}

function createCell(x, z) {
  for (let i = 0; i < 5; i += 1) {
    const bar = cyl(0.04, 1.95, new THREE.MeshStandardMaterial({ color: "#d7d1e2", roughness: 0.55 }), 10);
    bar.position.set(x - 0.6 + i * 0.3, 1.0, z - 0.55);
    scene.add(bar);
  }
}

function createKeyMesh(x, y, z) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16), materials.gold);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const stem = box(0.42, 0.04, 0.04, materials.gold);
  stem.position.x = 0.25;
  group.add(stem);
  group.position.set(x, y + 0.08, z);
  scene.add(group);
}

function createGlassCeilingBear() {
  const glass = new THREE.Mesh(new THREE.BoxGeometry(9, 0.06, 2), materials.glass);
  glass.position.set(0, 3.05, -2.7);
  scene.add(glass);
  const bear = createBearGroup(0.42, true);
  bear.position.set(0, 3.0, -2.7);
  bear.rotation.x = Math.PI;
  scene.add(bear);
  const slash = box(1.4, 0.07, 0.08, materials.red);
  slash.position.set(0, 2.96, -2.7);
  slash.rotation.z = 0.75;
  scene.add(slash);
}

function createChest(x, z) {
  const group = new THREE.Group();
  const base = box(1.2, 0.7, 0.8, materials.woodLight);
  base.position.y = 0.35;
  group.add(base);
  const band = box(1.25, 0.14, 0.85, materials.gold);
  band.position.y = 0.68;
  group.add(band);
  group.position.set(x, 0, z);
  scene.add(group);
}

function createKidMesh(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 16, 12), new THREE.MeshStandardMaterial({ color: "#f1c596" }));
  head.position.y = y + 0.9 * scale;
  const body = box(0.38 * scale, 0.7 * scale, 0.22 * scale, "#5bb8d6");
  body.position.y = y + 0.45 * scale;
  group.add(head, body);
  group.position.set(x, 0, z);
  scene.add(group);
}

function createBearMesh(x, y, z, scale = 1) {
  const group = createBearGroup(scale, true);
  group.position.set(x, y, z);
  group.name = "bear";
  scene.add(group);
  return group;
}

function createBearGroup(scale, redEyes) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: "#8b5b38", roughness: 0.8 });
  const belly = new THREE.MeshStandardMaterial({ color: "#765032", roughness: 0.75 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48 * scale, 24, 18), fur);
  head.position.y = 1.08 * scale;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.52 * scale, 24, 18), belly);
  body.position.y = 0.48 * scale;
  body.scale.set(1, 1.25, 0.85);
  group.add(head, body);
  for (const x of [-0.3, 0.3]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 16, 12), fur);
    ear.position.set(x * scale, 1.48 * scale, 0);
    group.add(ear);
  }
  if (redEyes) {
    for (const x of [-0.16, 0.16]) {
      const eye = box(0.13 * scale, 0.05 * scale, 0.03 * scale, materials.red);
      eye.position.set(x * scale, 1.13 * scale, -0.44 * scale);
      group.add(eye);
    }
  }
  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  return group;
}

function interactDrawer() {
  if (state.mode === "stage1") {
    if (!state.hammer) {
      state.hammer = true;
      say("망치를 찾았습니다.");
    }
    return;
  }
  if (state.mode === "stage2" && !state.codeFound.a) {
    state.codeFound.a = true;
    say("코드 3을 찾았습니다.");
  }
}

function interactStage1Wall() {
  if (!state.hammer) say("망치가 필요합니다.");
  else startStairs();
}

function interactStage2Exit() {
  if (!state.codeFound.a || !state.codeFound.b || !state.codeFound.c) {
    say("코드 3개를 먼저 찾으세요.");
    return;
  }
  showKeypad();
}

function interactCell() {
  if (!state.stage3Key) {
    say("감옥 열쇠가 필요합니다.");
    return;
  }
  if (!state.kidFreed) {
    state.kidFreed = true;
    state.knife = true;
    state.rescueTimer = 7;
    say("아이가 칼을 건네고 사라졌습니다.");
  }
}

function interactPrisonExit() {
  if (!state.kidFreed) {
    say("아이를 먼저 구하세요.");
    return;
  }
  showHallway();
}

function interactChest() {
  if (state.chestOpen) return;
  state.chestOpen = true;
  state.coins += 5000;
  localStorage.setItem(STORAGE_KEY, String(state.coins));
  say("5000코인을 받았습니다.");
  setTimeout(() => {
    state.finalReturn = true;
    showMenu();
  }, 950);
}

function addInteractable(def) {
  interactables.push(def);
}

function showKeypad() {
  state.keypadOpen = true;
  state.codeInput = "";
  ui.panel.classList.add("is-visible");
  const nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "지움", "0", "확인"];
  ui.panel.innerHTML = `
    <div class="fp-box">
      <div class="fp-code-display" id="codeDisplay">___</div>
      <div class="fp-keypad">${nums.map((n) => `<button ${n === "확인" ? "class='primary'" : ""} data-key="${n}">${n}</button>`).join("")}</div>
    </div>
  `;
  ui.panel.querySelectorAll("[data-key]").forEach((btn) => btn.addEventListener("click", () => keypadPress(btn.dataset.key)));
}

function keypadPress(key) {
  if (!state.keypadOpen) return;
  if (key === "지움") state.codeInput = state.codeInput.slice(0, -1);
  else if (key === "확인") {
    if (state.codeInput === "378") {
      state.keypadOpen = false;
      ui.panel.classList.remove("is-visible");
      state.bear.stunned = true;
      say("문이 열렸습니다.");
      setTimeout(resetStage3, 350);
    } else {
      state.codeInput = "";
      say("코드가 틀렸습니다.");
    }
  } else if (/^\d$/.test(key) && state.codeInput.length < 3) {
    state.codeInput += key;
  }
  const display = ui.panel.querySelector("#codeDisplay");
  if (display) display.textContent = state.codeInput.padEnd(3, "_");
}

function setPlayer(x, z, yaw) {
  state.player.x = x;
  state.player.z = z;
  state.player.yaw = yaw;
  state.player.pitch = 0;
  clearHideState();
  syncCamera();
}

function syncCamera() {
  camera.position.set(state.player.x, state.player.y, state.player.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = state.player.yaw;
  camera.rotation.x = state.player.pitch;
}

function loop() {
  const dt = Math.min(0.033, clock.getDelta() || 1 / 60);
  update(dt);
  render();
}

function update(dt) {
  if (state.messageT > 0) state.messageT = Math.max(0, state.messageT - dt);
  if (!state.keypadOpen && !ui.panel.classList.contains("is-visible")) updatePlayer(dt);
  if (state.mode === "stairs" && state.player.z < -11) resetStage2();
  if (state.mode === "stage2") updateBear(dt);
  if (state.mode === "stage3" && state.kidFreed) {
    state.rescueTimer = Math.max(0, state.rescueTimer - dt);
    if (state.rescueTimer <= 0) resetStage3();
  }
  if (state.mode === "hallway") {
    state.rescueTimer = Math.max(0, state.rescueTimer - dt);
    if (state.rescueTimer <= 0) showChoice();
  }
  syncCamera();
  updateUi();
}

function updatePlayer(dt) {
  if (!["stage1", "stairs", "stage2", "stage3", "hallway", "reward"].includes(state.mode)) return;
  const turnSpeed = 2.3;
  const turnLeft = hasInput("ArrowLeft") || hasInput("a");
  const turnRight = hasInput("ArrowRight") || hasInput("d");
  const moveForward = hasInput("ArrowUp") || hasInput("w");
  const moveBack = hasInput("ArrowDown") || hasInput("s");

  if (isCabinetHidden() && (turnLeft || turnRight || moveForward || moveBack)) {
    exitCabinet();
    return;
  }

  if (turnLeft) state.player.yaw += turnSpeed * dt;
  if (turnRight) state.player.yaw -= turnSpeed * dt;

  let move = 0;
  if (moveForward) move += 1;
  if (moveBack) move -= 1;
  if (move) {
    const speed = state.player.hidden ? 1.15 : 3.05;
    const nx = state.player.x - Math.sin(state.player.yaw) * move * speed * dt;
    const nz = state.player.z - Math.cos(state.player.yaw) * move * speed * dt;
    tryMove(nx, nz);
  }

  clearHideState();
  if (state.mode === "stage2") {
    for (const spot of hidingSpots) {
      if (Math.hypot(state.player.x - spot.x, state.player.z - spot.z) < spot.radius) {
        state.player.hidden = true;
        state.player.hideSpotType = spot.type;
        state.player.hideSpotX = spot.x;
        state.player.hideSpotZ = spot.z;
        state.player.hideSpotRadius = spot.radius;
        break;
      }
    }
  }
}

function isCabinetHidden() {
  return state.player.hidden && state.player.hideSpotType === "cabinet";
}

function exitCabinet() {
  const sx = Number.isFinite(state.player.hideSpotX) ? state.player.hideSpotX : state.player.x;
  const sz = Number.isFinite(state.player.hideSpotZ) ? state.player.hideSpotZ : state.player.z;
  let dx = state.player.x - sx;
  let dz = state.player.z - sz;
  if (Math.hypot(dx, dz) < 0.1) {
    dx = -Math.sin(state.player.yaw);
    dz = -Math.cos(state.player.yaw);
  }
  const len = Math.hypot(dx, dz) || 1;
  const exitDistance = (state.player.hideSpotRadius || 1.25) + 0.72;
  tryMove(sx + (dx / len) * exitDistance, sz + (dz / len) * exitDistance);
  clearHideState();
}

function clearHideState() {
  state.player.hidden = false;
  state.player.hideSpotType = null;
  state.player.hideSpotX = null;
  state.player.hideSpotZ = null;
  state.player.hideSpotRadius = 0;
}

function tryMove(nx, nz) {
  nx = clamp(nx, state.bounds.minX, state.bounds.maxX);
  nz = clamp(nz, state.bounds.minZ, state.bounds.maxZ);
  state.player.x = nx;
  state.player.z = nz;
}

function updateBear(dt) {
  const bear = state.bear;
  if (bear.stunned) return;
  const dxp = state.player.x - bear.x;
  const dzp = state.player.z - bear.z;
  const playerDist = Math.hypot(dxp, dzp);
  const sameRoomSight = !state.player.hidden && Math.abs(dzp) < 3.3 && playerDist < 4.0;
  if (sameRoomSight) bear.suspicion = Math.min(1.25, bear.suspicion + dt);
  else bear.suspicion = Math.max(0, bear.suspicion - dt * 1.8);
  bear.alert = bear.suspicion > 0.9;

  let tx;
  let tz;
  if (bear.alert) {
    tx = state.player.x;
    tz = state.player.z;
  } else {
    const target = bearPatrol3D[bear.route % bearPatrol3D.length];
    tx = target.x;
    tz = target.z;
    if (Math.hypot(tx - bear.x, tz - bear.z) < 0.45) bear.route = (bear.route + 1) % bearPatrol3D.length;
  }
  const d = Math.hypot(tx - bear.x, tz - bear.z) || 1;
  const speed = bear.alert ? 2.0 : 1.35;
  bear.x += ((tx - bear.x) / d) * speed * dt;
  bear.z += ((tz - bear.z) / d) * speed * dt;
  const bearObj = scene.getObjectByName("bear");
  if (bearObj) {
    bearObj.position.x = bear.x;
    bearObj.position.z = bear.z;
    bearObj.lookAt(state.player.x, 0.8, state.player.z);
  }
  if (!state.player.hidden && playerDist < 0.85) {
    say("곰돌이에게 들켰습니다.");
    setPlayer(0, 2.8, 0);
    bear.x = 16;
    bear.z = 2.5;
    bear.route = 0;
    bear.suspicion = 0;
  }
}

function render() {
  resize();
  renderer.render(scene, camera);
}

function resize() {
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function updateUi() {
  const objective = currentObjective();
  ui.objective.style.display = state.mode === "menu" ? "none" : "block";
  ui.objective.innerHTML = objective;
  ui.prompt.textContent = state.messageT > 0 ? state.message : interactPrompt();
  ui.prompt.classList.toggle("is-visible", Boolean(ui.prompt.textContent));
  ui.cabinetHide.classList.toggle("is-visible", state.player.hidden && state.player.hideSpotType === "cabinet");
  const items = inventoryItems();
  ui.inventory.classList.toggle("is-visible", items.length > 0 && !["menu", "choice"].includes(state.mode));
  ui.inventory.innerHTML = items.map(renderInventorySlot).join("");
}

function currentObjective() {
  if (state.mode === "stage1") return state.hammer ? "1단계 · 금 간 벽을 조사하세요" : "1단계 · 서랍에서 망치를 찾으세요";
  if (state.mode === "stairs") return "계단 · 앞으로 올라가세요";
  if (state.mode === "stage2") return `2단계 · 코드 ${state.codeFound.a ? "3" : "_"} ${state.codeFound.b ? "7" : "_"} ${state.codeFound.c ? "8" : "_"}${state.player.hidden ? " · 숨는 중" : ""}`;
  if (state.mode === "stage3") return state.kidFreed ? `3단계 · 남은 시간 ${Math.ceil(state.rescueTimer)}초` : state.stage3Key ? "3단계 · 감옥을 여세요" : "3단계 · 바닥 열쇠를 찾으세요";
  if (state.mode === "hallway") return "복도";
  if (state.mode === "reward") return "보상 방 · 상자를 여세요";
  return "";
}

function interactPrompt() {
  const target = findInteractable();
  return target ? `${target.label} 조사` : "";
}

function inventoryItems() {
  const items = [];
  if (state.hammer) items.push("🔨");
  if (state.codeFound.a) items.push("3");
  if (state.codeFound.b) items.push("7");
  if (state.codeFound.c) items.push("8");
  if (state.stage3Key) items.push("🔑");
  if (state.knife) items.push("◢");
  if (state.finalKey) items.push("🗝");
  return items;
}

function renderInventorySlot(item) {
  return `<div class="fp-slot">${item}</div>`;
}

function findInteractable() {
  let best = null;
  let bestScore = Infinity;
  const forward = new THREE.Vector3(-Math.sin(state.player.yaw), 0, -Math.cos(state.player.yaw));
  for (const item of interactables) {
    const to = new THREE.Vector3(item.x - state.player.x, 0, item.z - state.player.z);
    const dist = to.length();
    if (dist > item.radius + 0.9) continue;
    to.normalize();
    const facing = forward.dot(to);
    if (facing < 0.15 && dist > 0.95) continue;
    if (dist < bestScore) {
      best = item;
      bestScore = dist;
    }
  }
  return best;
}

function interact() {
  if (state.keypadOpen) return;
  const target = findInteractable();
  if (target) target.onInteract();
  else say("조사할 곳에 더 가까이 가세요.", 1.2);
}

function say(text, seconds = 2.2) {
  state.message = text;
  state.messageT = seconds;
}

function hasInput(key) {
  return keys.has(key) || heldControls.has(key);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

window.addEventListener("keydown", (evt) => {
  const key = evt.key.length === 1 ? evt.key.toLowerCase() : evt.key;
  if (key === "e" || key === "Enter") interact();
  else if (state.keypadOpen && /^\d$/.test(key)) keypadPress(key);
  else if (state.keypadOpen && key === "Backspace") keypadPress("지움");
  keys.add(key);
});

window.addEventListener("keyup", (evt) => {
  keys.delete(evt.key.length === 1 ? evt.key.toLowerCase() : evt.key);
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
});
actionButton.addEventListener("pointerup", () => actionButton.classList.remove("is-active"));
actionButton.addEventListener("pointercancel", () => actionButton.classList.remove("is-active"));
actionButton.addEventListener("pointerleave", () => actionButton.classList.remove("is-active"));

let dragging = false;
let lastPointerX = 0;
canvas.addEventListener("pointerdown", (evt) => {
  dragging = true;
  lastPointerX = evt.clientX;
});
canvas.addEventListener("pointermove", (evt) => {
  if (!dragging) return;
  const dx = evt.clientX - lastPointerX;
  lastPointerX = evt.clientX;
  state.player.yaw -= dx * 0.005;
});
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });

window.addEventListener("blur", () => {
  heldControls.clear();
  keys.clear();
});

const preventZoom = (evt) => evt.preventDefault();
document.addEventListener("gesturestart", preventZoom, { passive: false });
document.addEventListener("gesturechange", preventZoom, { passive: false });
document.addEventListener("gestureend", preventZoom, { passive: false });
document.addEventListener("dblclick", preventZoom, { passive: false });
document.addEventListener("touchmove", (evt) => {
  if (evt.touches && evt.touches.length > 1) evt.preventDefault();
}, { passive: false });

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};

window.render_game_to_text = () => JSON.stringify({
  note: "3D coordinates: x horizontal, y up, z depth. Player yaw in radians.",
  mode: state.mode,
  stage: state.stage,
  player: {
    x: Number(state.player.x.toFixed(2)),
    z: Number(state.player.z.toFixed(2)),
    yaw: Number(state.player.yaw.toFixed(2)),
    hidden: state.player.hidden,
    hideSpotType: state.player.hideSpotType,
    hideSpot: state.player.hideSpotType ? {
      x: Number(state.player.hideSpotX.toFixed(2)),
      z: Number(state.player.hideSpotZ.toFixed(2)),
      radius: Number(state.player.hideSpotRadius.toFixed(2)),
    } : null,
  },
  objective: currentObjective(),
  inventory: {
    hammer: state.hammer,
    code: `${state.codeFound.a ? "3" : "_"} ${state.codeFound.b ? "7" : "_"} ${state.codeFound.c ? "8" : "_"}`,
    stage3Key: state.stage3Key,
    knife: state.knife,
    finalKey: state.finalKey,
  },
  bear: state.mode === "stage2" ? {
    x: Number(state.bear.x.toFixed(2)),
    z: Number(state.bear.z.toFixed(2)),
    alert: state.bear.alert,
    suspicion: Number(state.bear.suspicion.toFixed(2)),
  } : undefined,
  timer: ["stage3", "hallway"].includes(state.mode) ? Math.ceil(state.rescueTimer) : undefined,
  coins: state.coins,
  message: state.messageT > 0 ? state.message : "",
});
