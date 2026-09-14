import * as THREE from "three";

import {
  chooseDialogue,
  createGameState,
  holdGuest,
  serializeGameState,
  spawnGuest,
  toggleTalisman,
  updateSimulation,
} from "./game/simulation/core.js";

const VISUAL_THESIS =
  "Sterile late-night hospital geometry with warm talisman contrast and restrained survival HUD.";
const CONTENT_PLAN =
  "First-person reception desk, arriving guests, three exam rooms, doctors, compact status, talisman, and dialogue choices.";
const INTERACTION_THESIS =
  "Pointer-look movement, click-to-question guests, bottom talisman lift, and press-hold banish for attackers.";

const root = document.querySelector("#game-root");
const healthFill = document.querySelector("#health-fill");
const healthValue = document.querySelector("#health-value");
const statusChip = document.querySelector("#status-chip");
const talismanButton = document.querySelector("#talisman-button");
const dialogue = document.querySelector("#dialogue");
const guestLine = document.querySelector("#guest-line");
const admitButton = document.querySelector("#admit-button");
const rejectButton = document.querySelector("#reject-button");
const startPanel = document.querySelector("#start-panel");
const startButton = document.querySelector("#start-button");
const roomLabels = [1, 2, 3].map((id) => document.querySelector(`#room-${id}`));
const movePadButtons = Array.from(document.querySelectorAll("[data-move]"));

const clock = new THREE.Clock();
const state = createGameState({ seed: 20260707 });
const behaviorCycle = ["normal", "repeat", "stare", "attack", "normal", "repeat", "stare"];
const guestMeshes = new Map();
const keys = new Set();
const moveButtons = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let spawnIndex = 0;
let spawnTimer = 0.8;
let activeDialogueGuestId = null;
let holdingGuestId = null;
let draggingLook = false;
let lastDragX = 0;
let lastDragY = 0;
let running = false;
let yaw = 0;
let pitch = 0;
let playerPosition = new THREE.Vector3(0, 1.65, -3.2);
state.player.x = playerPosition.x;
state.player.z = playerPosition.z;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9fb9b3");
scene.fog = new THREE.Fog("#9fb9b3", 28, 80);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 120);
camera.position.copy(playerPosition);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.prepend(renderer.domElement);

const world = new THREE.Group();
scene.add(world);

buildHospital();
buildDoctors();
spawnNextGuest();
updateHud();

window.__hospitalGame = {
  state,
  spawnGuest: spawnNextGuest,
  spawnGuestWithBehavior: spawnGuestWithBehaviorForDebug,
  clearGuests: clearGuestsForDebug,
  getGuestRenderDebug,
  setRunning: (value) => {
    running = Boolean(value);
  },
  visualThesis: VISUAL_THESIS,
  contentPlan: CONTENT_PLAN,
  interactionThesis: INTERACTION_THESIS,
};

window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "Three.js meters, y up, player starts behind the reception counter, negative z faces lobby.",
    running,
    pointerLocked: document.pointerLockElement === renderer.domElement,
    dialogueOpen: !dialogue.classList.contains("hidden"),
    ...serializeGameState(state),
  });

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    update(1 / 60);
  }
  render();
  return window.render_game_to_text();
};

startButton.addEventListener("click", () => {
  running = true;
  startPanel.classList.add("hidden");
  requestPointerLock();
});

talismanButton.addEventListener("click", () => {
  toggleTalisman(state);
  updateSimulation(state, 0.01);
  updateHud("부적을 들었다");
});

for (const button of movePadButtons) {
  const direction = button.dataset.move;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    moveButtons.add(direction);
    button.classList.add("active");
    button.setPointerCapture?.(event.pointerId);
  });
  const stop = (event) => {
    event.preventDefault();
    moveButtons.delete(direction);
    button.classList.remove("active");
  };
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("lostpointercapture", stop);
  button.addEventListener("pointerleave", stop);
}

admitButton.addEventListener("click", () => resolveDialogue("admit"));
rejectButton.addEventListener("click", () => resolveDialogue("reject"));

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyE") {
    talismanButton.click();
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== renderer.domElement || activeDialogueGuestId !== null) {
    return;
  }
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.002;
  pitch = THREE.MathUtils.clamp(pitch, -1.12, 1.05);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!running) {
    return;
  }

  if (document.pointerLockElement !== renderer.domElement && activeDialogueGuestId === null) {
    requestPointerLock();
  }

  const guest = raycastGuest(event);
  if (!guest) {
    if (document.pointerLockElement !== renderer.domElement && activeDialogueGuestId === null) {
      draggingLook = true;
      lastDragX = event.clientX;
      lastDragY = event.clientY;
    }
    return;
  }

  if (guest.status === "attacking") {
    holdingGuestId = guest.id;
    updateHud("계속 누르고 있어야 한다");
    return;
  }

  if (guest.status === "waiting") {
    openDialogue(guest);
  }
});

window.addEventListener("pointerup", () => {
  holdingGuestId = null;
  draggingLook = false;
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!draggingLook || document.pointerLockElement === renderer.domElement || activeDialogueGuestId !== null) {
    return;
  }
  const dx = event.clientX - lastDragX;
  const dy = event.clientY - lastDragY;
  lastDragX = event.clientX;
  lastDragY = event.clientY;
  yaw -= dx * 0.004;
  pitch -= dy * 0.0035;
  pitch = THREE.MathUtils.clamp(pitch, -1.12, 1.05);
});

renderer.domElement.addEventListener("pointerleave", () => {
  draggingLook = false;
});

window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  render();
});

function update(dt) {
  if (!running) {
    animateIdleGuests(dt);
    return;
  }

  updatePlayer(dt);
  maybeSpawnGuest(dt);

  if (holdingGuestId !== null) {
    const target = state.guests.find((guest) => guest.id === holdingGuestId);
    if (target?.status === "attacking") {
      holdGuest(state, holdingGuestId, dt);
    } else {
      holdingGuestId = null;
    }
  }

  updateSimulation(state, dt);
  syncGuests(dt);
  updateCamera();
  updateHud();
}

function render() {
  renderer.render(scene, camera);
}

function buildHospital() {
  const hemi = new THREE.HemisphereLight("#e8fffa", "#58736c", 1.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff8e6", 1.8);
  sun.position.set(12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ color: "#6f8f7d", roughness: 0.92 }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.receiveShadow = true;
  world.add(outside);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 30),
    new THREE.MeshStandardMaterial({ color: "#d7ebe7", roughness: 0.82, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.012;
  floor.receiveShadow = true;
  world.add(floor);

  addBox("front-wall-left", [-11.5, 1.7, -14.8], [11, 3.4, 0.42], "#c6ddd9");
  addBox("front-wall-right", [11.5, 1.7, -14.8], [11, 3.4, 0.42], "#c6ddd9");
  addBox("back-wall", [0, 1.7, 14.8], [34, 3.4, 0.42], "#c6ddd9");
  addBox("left-wall", [-16.8, 1.7, 0], [0.42, 3.4, 30], "#c6ddd9");
  addBox("right-wall", [16.8, 1.7, 0], [0.42, 3.4, 30], "#c6ddd9");

  addBox("counter-front", [0, 0.65, -5.25], [10.8, 1.3, 0.6], "#32675f");
  addBox("counter-top", [0, 1.32, -5.2], [11.2, 0.16, 1.1], "#ecfffb");
  addBox("counter-left-return", [-5.4, 0.55, -3.35], [0.55, 1.1, 3.2], "#32675f");
  addBox("counter-right-door", [6.35, 0.48, -3.25], [0.35, 0.96, 2.2], "#d69b54");

  addBox("lobby-bench-left", [-10.5, 0.38, -10.2], [4.8, 0.42, 0.8], "#6d7f90");
  addBox("lobby-bench-right", [10.5, 0.38, -10.2], [4.8, 0.42, 0.8], "#6d7f90");

  for (let i = 0; i < 3; i += 1) {
    const x = -10 + i * 10;
    addBox(`room-${i + 1}-back`, [x, 1.45, 12.2], [8.5, 2.9, 0.26], "#b9d2d0");
    addBox(`room-${i + 1}-left`, [x - 4.15, 1.45, 8.6], [0.26, 2.9, 7.4], "#b9d2d0");
    addBox(`room-${i + 1}-right`, [x + 4.15, 1.45, 8.6], [0.26, 2.9, 7.4], "#b9d2d0");
    addBox(`room-${i + 1}-bed`, [x + 1.1, 0.46, 9.8], [3.2, 0.38, 1.5], "#f3fbff");
    addBox(`room-${i + 1}-bed-base`, [x + 1.1, 0.22, 9.8], [3.4, 0.34, 1.6], "#7aa8c2");
    const label = createTextSprite(`${i + 1}번 진료실`, { width: 320, height: 96, fontSize: 42 });
    label.position.set(x, 2.6, 5.05);
    world.add(label);
  }

  const sign = createTextSprite("접수", { width: 220, height: 90, fontSize: 44, background: "#1b4f48" });
  sign.position.set(0, 2.65, -5.75);
  world.add(sign);
}

function buildDoctors() {
  for (let i = 0; i < 3; i += 1) {
    const doctor = createHumanoid({ coat: "#f6fbff", skin: "#f1c7a5", accent: "#56a4ff" });
    doctor.position.set(-11.2 + i * 10, 0, 8.4);
    doctor.rotation.y = Math.PI;
    world.add(doctor);
  }
}

function addBox(name, position, scale, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(scale[0], scale[1], scale[2]),
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.03 }),
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function createHumanoid({ coat, skin, accent }) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.78, 6, 12),
    new THREE.MeshStandardMaterial({ color: coat, roughness: 0.75 }),
  );
  body.position.y = 1.02;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 20, 16),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
  );
  head.position.y = 1.76;
  head.castShadow = true;
  group.add(head);

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.22, 0.024),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.46 }),
  );
  badge.position.set(0.18, 1.22, -0.34);
  group.add(badge);

  return group;
}

function spawnNextGuest() {
  const behavior = behaviorCycle[spawnIndex % behaviorCycle.length];
  spawnIndex += 1;
  return spawnGuestWithBehaviorForDebug(behavior);
}

function spawnGuestWithBehaviorForDebug(behavior) {
  const guest = spawnGuest(state, {
    behavior,
    phrase: phraseFor(behavior),
    position: { x: 0, z: -13.2 },
  });
  ensureGuestMesh(guest);
  updateHud("손님이 왔다");
  return guest;
}

function clearGuestsForDebug() {
  for (const entry of guestMeshes.values()) {
    world.remove(entry.group);
  }
  guestMeshes.clear();
  state.guests.length = 0;
  for (const room of state.rooms) {
    room.occupantId = null;
  }
  activeDialogueGuestId = null;
  dialogue.classList.add("hidden");
  spawnTimer = 99;
}

function getGuestRenderDebug() {
  return Array.from(guestMeshes.entries()).map(([id, entry]) => {
    const guest = state.guests.find((candidate) => candidate.id === id);
    return {
      id,
      behavior: guest?.behavior,
      status: guest?.status,
      trackingPlayer: Boolean(entry.eyeDebug?.trackingPlayer),
      pupilOffsetX: entry.eyeDebug?.pupilOffsetX ?? 0,
      pupilOffsetY: entry.eyeDebug?.pupilOffsetY ?? 0,
    };
  });
}

function phraseFor(behavior) {
  if (behavior === "repeat") return "괜찮아요 괜찮아요 괜찮아요";
  if (behavior === "stare") return "당신을 보고 있어요";
  if (behavior === "attack") return "문 열어...";
  return "진료 받고 싶어요";
}

function maybeSpawnGuest(dt) {
  const hasCounterGuest = state.guests.some((guest) => ["waiting", "attacking"].includes(guest.status));
  if (hasCounterGuest) {
    spawnTimer = 3.2;
    return;
  }
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnNextGuest();
    spawnTimer = 5.2;
  }
}

function ensureGuestMesh(guest) {
  if (guestMeshes.has(guest.id)) {
    return guestMeshes.get(guest.id);
  }

  const group = createHumanoid({
    coat: guest.behavior === "normal" ? "#7ed6c7" : "#7862a8",
    skin: guest.behavior === "attack" ? "#c0d1c6" : "#efc4a4",
    accent: guest.behavior === "normal" ? "#e7fff7" : "#ff6b6b",
  });
  group.position.set(guest.position.x, 0, guest.position.z);
  group.userData.guestId = guest.id;

  const label = createTextSprite(guest.dialogue, {
    width: 420,
    height: 120,
    fontSize: 38,
    background: guest.mood === "suspicious" ? "#351b39" : "#0f3f39",
  });
  label.position.set(0, 2.45, 0);
  group.add(label);

  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: "#f8fffb", roughness: 0.36 });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: "#071214" });
  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.086, 16, 12), eyeWhiteMaterial);
  const rightEyeWhite = leftEyeWhite.clone();
  leftEyeWhite.position.set(-0.1, 1.8, -0.28);
  rightEyeWhite.position.set(0.1, 1.8, -0.28);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), pupilMaterial);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.1, 1.8, -0.36);
  rightEye.position.set(0.1, 1.8, -0.36);
  group.add(leftEyeWhite, rightEyeWhite, leftEye, rightEye);

  let mirrorLeftEye = null;
  let mirrorRightEye = null;
  let mirrorLeftEyeWhite = null;
  let mirrorRightEyeWhite = null;
  if (guest.behavior === "stare") {
    mirrorLeftEyeWhite = leftEyeWhite.clone();
    mirrorRightEyeWhite = rightEyeWhite.clone();
    mirrorLeftEyeWhite.position.set(-0.1, 1.8, 0.28);
    mirrorRightEyeWhite.position.set(0.1, 1.8, 0.28);
    mirrorLeftEye = leftEye.clone();
    mirrorRightEye = rightEye.clone();
    mirrorLeftEye.position.set(-0.1, 1.8, 0.36);
    mirrorRightEye.position.set(0.1, 1.8, 0.36);
    group.add(mirrorLeftEyeWhite, mirrorRightEyeWhite, mirrorLeftEye, mirrorRightEye);
  }

  const holdHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.025, 8, 48),
    new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0 }),
  );
  holdHalo.position.y = 1.28;
  holdHalo.rotation.x = Math.PI / 2;
  group.add(holdHalo);

  const entry = {
    group,
    label,
    leftEye,
    rightEye,
    leftEyeWhite,
    rightEyeWhite,
    mirrorLeftEye,
    mirrorRightEye,
    mirrorLeftEyeWhite,
    mirrorRightEyeWhite,
    holdHalo,
    labelText: guest.dialogue,
    eyeDebug: { trackingPlayer: false, pupilOffsetX: 0, pupilOffsetY: 0 },
  };
  group.traverse((node) => {
    node.userData.guestId = guest.id;
  });
  guestMeshes.set(guest.id, entry);
  world.add(group);
  return entry;
}

function syncGuests(dt) {
  for (const guest of state.guests) {
    const mesh = ensureGuestMesh(guest);
    const target = targetForGuest(guest);

    if (guest.status === "gone") {
      mesh.group.visible = false;
      continue;
    }

    mesh.group.visible = true;
    mesh.group.position.x = THREE.MathUtils.damp(mesh.group.position.x, target.x, 4.2, dt);
    mesh.group.position.z = THREE.MathUtils.damp(mesh.group.position.z, target.z, 4.2, dt);
    guest.position.x = mesh.group.position.x;
    guest.position.z = mesh.group.position.z;

    const lookTarget =
      guest.status === "attacking" ? playerPosition : new THREE.Vector3(0, 0.9, -3.2);
    mesh.group.lookAt(lookTarget.x, 0.9, lookTarget.z);

    if (guest.behavior === "stare" && guest.status === "waiting") {
      const localPlayer = mesh.group.worldToLocal(playerPosition.clone());
      const dx = THREE.MathUtils.clamp(localPlayer.x * 0.032, -0.058, 0.058);
      const dy = THREE.MathUtils.clamp((localPlayer.y - 1.8) * 0.04, -0.022, 0.022);
      mesh.leftEye.position.x = -0.1 + dx;
      mesh.rightEye.position.x = 0.1 + dx;
      mesh.leftEye.position.y = 1.8 + dy;
      mesh.rightEye.position.y = 1.8 + dy;
      mesh.leftEye.position.z = -0.35;
      mesh.rightEye.position.z = -0.35;
      if (mesh.mirrorLeftEye && mesh.mirrorRightEye) {
        mesh.mirrorLeftEye.position.x = -0.1 + dx;
        mesh.mirrorRightEye.position.x = 0.1 + dx;
        mesh.mirrorLeftEye.position.y = 1.8 + dy;
        mesh.mirrorRightEye.position.y = 1.8 + dy;
        mesh.mirrorLeftEye.position.z = 0.35;
        mesh.mirrorRightEye.position.z = 0.35;
      }
      mesh.eyeDebug = { trackingPlayer: true, pupilOffsetX: dx, pupilOffsetY: dy };
    } else {
      mesh.leftEye.position.x = THREE.MathUtils.damp(mesh.leftEye.position.x, -0.1, 6, dt);
      mesh.rightEye.position.x = THREE.MathUtils.damp(mesh.rightEye.position.x, 0.1, 6, dt);
      mesh.leftEye.position.y = THREE.MathUtils.damp(mesh.leftEye.position.y, 1.8, 6, dt);
      mesh.rightEye.position.y = THREE.MathUtils.damp(mesh.rightEye.position.y, 1.8, 6, dt);
      mesh.leftEye.position.z = THREE.MathUtils.damp(mesh.leftEye.position.z, -0.34, 6, dt);
      mesh.rightEye.position.z = THREE.MathUtils.damp(mesh.rightEye.position.z, -0.34, 6, dt);
      if (mesh.mirrorLeftEye && mesh.mirrorRightEye) {
        mesh.mirrorLeftEye.position.x = THREE.MathUtils.damp(mesh.mirrorLeftEye.position.x, -0.1, 6, dt);
        mesh.mirrorRightEye.position.x = THREE.MathUtils.damp(mesh.mirrorRightEye.position.x, 0.1, 6, dt);
        mesh.mirrorLeftEye.position.y = THREE.MathUtils.damp(mesh.mirrorLeftEye.position.y, 1.8, 6, dt);
        mesh.mirrorRightEye.position.y = THREE.MathUtils.damp(mesh.mirrorRightEye.position.y, 1.8, 6, dt);
        mesh.mirrorLeftEye.position.z = THREE.MathUtils.damp(mesh.mirrorLeftEye.position.z, 0.34, 6, dt);
        mesh.mirrorRightEye.position.z = THREE.MathUtils.damp(mesh.mirrorRightEye.position.z, 0.34, 6, dt);
      }
      mesh.eyeDebug = { trackingPlayer: false, pupilOffsetX: 0, pupilOffsetY: 0 };
    }

    mesh.holdHalo.material.opacity =
      guest.status === "attacking" ? Math.min(0.92, 0.12 + guest.holdProgress / 3) : 0;
    mesh.holdHalo.scale.setScalar(1 + guest.holdProgress * 0.12);

    if (mesh.labelText !== guest.dialogue) {
      replaceSpriteText(mesh.label, guest.dialogue, {
        width: 420,
        height: 120,
        fontSize: 38,
        background: guest.mood === "suspicious" ? "#351b39" : "#0f3f39",
      });
      mesh.labelText = guest.dialogue;
    }
  }
}

function animateIdleGuests(dt) {
  for (const guest of state.guests) {
    const mesh = ensureGuestMesh(guest);
    mesh.group.position.y = Math.sin(state.time * 2 + guest.id) * 0.015;
  }
  state.time += dt;
}

function targetForGuest(guest) {
  if (guest.status === "waiting") {
    return { x: 0, z: -7.4 };
  }
  if (guest.status === "in-room" || guest.status === "treated") {
    const roomX = -10 + (guest.roomId - 1) * 10;
    return { x: roomX - 0.5, z: 9.65 };
  }
  if (guest.status === "attacking") {
    return { x: playerPosition.x, z: playerPosition.z - 1.35 };
  }
  return guest.position;
}

function updatePlayer(dt) {
  if (activeDialogueGuestId !== null) {
    return;
  }

  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 6.1 : 4.2;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const movement = new THREE.Vector3();

  if (keys.has("KeyW") || keys.has("ArrowUp") || moveButtons.has("forward")) movement.add(forward);
  if (keys.has("KeyS") || keys.has("ArrowDown") || moveButtons.has("back")) movement.sub(forward);
  if (keys.has("KeyD") || keys.has("ArrowRight") || moveButtons.has("right")) movement.add(right);
  if (keys.has("KeyA") || keys.has("ArrowLeft") || moveButtons.has("left")) movement.sub(right);

  if (movement.lengthSq() > 0) {
    movement.normalize().multiplyScalar(speed * dt);
    const next = playerPosition.clone().add(movement);
    if (isWalkable(next)) {
      playerPosition.copy(next);
      state.player.x = playerPosition.x;
      state.player.z = playerPosition.z;
      state.player.yaw = yaw;
    }
  }
}

function isWalkable(position) {
  if (position.x < -15.7 || position.x > 15.7 || position.z < -13.8 || position.z > 13.7) {
    return false;
  }

  const insideMainCounter = position.x > -5.8 && position.x < 5.8 && position.z > -5.95 && position.z < -4.4;
  const insideLeftReturn = position.x > -5.95 && position.x < -4.85 && position.z > -5.0 && position.z < -1.8;
  return !insideMainCounter && !insideLeftReturn;
}

function updateCamera() {
  camera.position.copy(playerPosition);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function openDialogue(guest) {
  activeDialogueGuestId = guest.id;
  guestLine.textContent = guest.dialogue;
  dialogue.classList.remove("hidden");
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  updateHud("대화 중");
}

function resolveDialogue(choice) {
  if (activeDialogueGuestId === null) {
    return;
  }

  const result = chooseDialogue(state, activeDialogueGuestId, choice);
  const guest = state.guests.find((candidate) => candidate.id === activeDialogueGuestId);
  activeDialogueGuestId = null;
  dialogue.classList.add("hidden");

  if (!result.ok) {
    updateHud(result.reason === "rooms-full" ? "빈 진료실 없음" : "대화 실패");
    return;
  }

  if (choice === "admit" && guest?.mood === "suspicious") {
    updateHud("이상한 환자였다");
  } else if (choice === "admit") {
    updateHud(`${result.roomId}번 진료실로 보냈다`);
  } else {
    updateHud("돌려보냈다");
  }
}

function raycastGuest(event) {
  if (document.pointerLockElement === renderer.domElement) {
    pointer.set(0, 0);
  } else {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  raycaster.setFromCamera(pointer, camera);
  const objects = Array.from(guestMeshes.values()).map((entry) => entry.group);
  const hits = raycaster.intersectObjects(objects, true);
  const hit = hits.find((candidate) => guestIdFromObject(candidate.object));
  if (!hit || hit.distance > 9) {
    return null;
  }

  const guestId = guestIdFromObject(hit.object);
  return state.guests.find((guest) => guest.id === guestId && guest.status !== "gone");
}

function guestIdFromObject(object) {
  let node = object;
  while (node) {
    if (node.userData?.guestId) {
      return node.userData.guestId;
    }
    node = node.parent;
  }
  return null;
}

function updateHud(forcedStatus) {
  const health = Math.round(state.player.health);
  healthValue.textContent = String(health);
  healthFill.style.width = `${health}%`;
  healthFill.style.background =
    health < 35 ? "linear-gradient(90deg, #ff6b6b, #ffd166)" : "linear-gradient(90deg, var(--accent), #b7f8dd)";

  talismanButton.classList.toggle("active", state.talisman.active);
  talismanButton.setAttribute("aria-pressed", String(state.talisman.active));

  for (const room of state.rooms) {
    const label = roomLabels[room.id - 1];
    if (!label) continue;
    label.textContent = `${room.id} ${room.occupantId ? "진료중" : "비어있음"}`;
    label.classList.toggle("busy", room.occupantId !== null);
  }

  if (forcedStatus) {
    statusChip.textContent = forcedStatus;
    return;
  }

  const attacker = state.guests.find((guest) => guest.status === "attacking");
  if (attacker) {
    statusChip.textContent =
      attacker.behavior === "attack" && !attacker.admittedByMistake
        ? "3초 동안 붙잡아야 한다"
        : "부적이 통한다";
    return;
  }

  const waiting = state.guests.find((guest) => guest.status === "waiting");
  if (waiting) {
    statusChip.textContent = "손님 대기 중";
    return;
  }

  statusChip.textContent = "접수 대기";
}

function createTextSprite(text, options = {}) {
  const material = new THREE.SpriteMaterial({
    map: makeTextTexture(text, options),
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.scaleX ?? 2.8, options.scaleY ?? 0.8, 1);
  return sprite;
}

function replaceSpriteText(sprite, text, options = {}) {
  const oldMap = sprite.material.map;
  sprite.material.map = makeTextTexture(text, options);
  oldMap?.dispose();
}

function makeTextTexture(
  text,
  { width = 512, height = 128, fontSize = 48, background = "#0f3f39", color = "#eef8f7" } = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  roundRect(ctx, 8, 8, width - 16, height - 16, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(238,248,247,0.34)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const safeText = fitText(ctx, text, width - 34);
  ctx.fillText(safeText, width / 2, height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function requestPointerLock() {
  try {
    const lockResult = renderer.domElement.requestPointerLock?.();
    if (lockResult && typeof lockResult.catch === "function") {
      lockResult.catch(() => updateHud("시야 고정 없이 진행"));
    }
  } catch {
    updateHud("시야 고정 없이 진행");
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    root.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}
