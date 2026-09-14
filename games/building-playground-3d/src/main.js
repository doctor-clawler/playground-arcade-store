import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const STORAGE_KEY = "playground-3d-building-game-v1";
const WORLD_SIZE = 18;
const HALF_WORLD = WORLD_SIZE / 2;

const CATEGORIES = [
  {
    id: "blocks",
    label: "블록",
    items: [
      item("birch", "자작나무", "#d9caa5", "block", { texture: "birch" }),
      item("dark-wood", "진한색나무", "#5b3424", "block", { texture: "wood" }),
      item("light-wood", "연한색나무", "#d8a86f", "block", { texture: "wood" }),
      item("glass", "유리", "#9edaf2", "block", { transparent: true }),
      item("water-block", "물블록", "#2d9de7", "block", { transparent: true, texture: "water" }),
      item("brick", "벽돌", "#a74f38", "block", { texture: "brick" }),
      item("concrete", "콘크리트", "#a9aaa3", "block", { texture: "concrete" }),
    ],
  },
  {
    id: "furniture",
    label: "가구",
    items: [
      item("bed", "침대", "#e76572", "bed"),
      item("chair", "의자", "#8c5b38", "chair"),
      item("bunk-bed", "2층침대", "#4d8fc7", "bunkBed"),
      item("frame", "액자", "#f4b244", "frame"),
      item("bookshelf", "책장", "#7d5137", "bookshelf"),
      item("desk", "책상", "#9f693c", "desk"),
      item("dresser", "서랍", "#b97543", "dresser"),
      item("lamp", "조명", "#ffd65a", "lamp"),
    ],
  },
  {
    id: "bathroom",
    label: "욕실",
    items: [
      item("bathtub", "욕조", "#f2f6f8", "bathtub"),
      item("toilet", "변기", "#f8fbff", "toilet"),
      item("toilet-paper", "휴지", "#ffffff", "toiletPaper"),
      item("shower", "샤워부스", "#9edaf2", "shower"),
      item("towel", "수건", "#ff9fa9", "towel"),
      item("sink", "세면대", "#f3f8fb", "sink"),
      item("washer", "세탁기", "#d8e4eb", "washer"),
    ],
  },
  {
    id: "kitchen",
    label: "주방",
    items: [
      item("oven", "오븐", "#4d5967", "oven"),
      item("kitchen-cabinet", "주방용서랍", "#df9b55", "kitchenCabinet"),
      item("microwave", "전자레인지", "#cfd9df", "microwave"),
      item("kettle", "주전자", "#7cc0cf", "kettle"),
      item("dining-table", "식탁", "#ae7242", "table"),
      item("kitchen-chair", "의자", "#d29158", "chair"),
      item("fridge", "냉장고", "#e6edf2", "fridge"),
      item("steak", "스테이크", "#9e3b2f", "food", { food: "steak" }),
      item("cake", "케이크", "#fff0aa", "food", { food: "cake" }),
      item("water", "물", "#71c8ff", "food", { food: "water" }),
      item("pasta", "파스타", "#f3c35d", "food", { food: "pasta" }),
      item("hamburger", "햄버거", "#d89742", "food", { food: "hamburger" }),
      item("mackerel", "고등어", "#6f8fa7", "food", { food: "mackerel" }),
      item("rice", "밥", "#fff7e8", "food", { food: "rice" }),
    ],
  },
  {
    id: "outdoor",
    label: "외부",
    items: [
      item("swing", "그네", "#64a052", "swing"),
      item("pool", "풀", "#2ea8df", "pool"),
      item("seesaw", "시소", "#f5ba4f", "seesaw"),
      item("slide", "미끄럼틀", "#f05a41", "slide"),
      item("outdoor-chair", "의자", "#4fa883", "chair"),
    ],
  },
  {
    id: "school",
    label: "학교",
    items: [
      item("locker", "사물함", "#6d88a8", "locker"),
      item("chalkboard", "칠판", "#2e6f55", "chalkboard"),
      item("bag", "가방", "#e85949", "bag"),
      item("book", "책", "#5174c4", "book"),
      item("teacher-desk", "교탁", "#9a633a", "podium"),
      item("school-desk", "책상", "#c0874c", "schoolDesk"),
      item("school-chair", "의자", "#6580b9", "chair"),
    ],
  },
  {
    id: "windows",
    label: "창문",
    items: [
      item("wide-window", "가로창문", "#9edaf2", "window", { window: "wide" }),
      item("tall-window", "세로창문", "#9edaf2", "window", { window: "tall" }),
      item("small-window", "작은 창문", "#9edaf2", "window", { window: "small" }),
      item("big-window", "큰 창문", "#9edaf2", "window", { window: "big" }),
    ],
  },
];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const ITEM_BY_KEY = new Map();
for (const category of CATEGORIES) {
  for (const catalogItem of category.items) {
    catalogItem.categoryId = category.id;
    catalogItem.categoryLabel = category.label;
    catalogItem.key = `${category.id}:${catalogItem.id}`;
    ITEM_BY_KEY.set(catalogItem.key, catalogItem);
  }
}

const state = {
  activeCategoryId: "blocks",
  buildOpen: false,
  selectedKey: null,
  rotation: 0,
  placements: [],
  pointerCell: null,
  deleteMode: false,
  savedOverlayOpen: false,
};

const els = {
  canvas: document.querySelector("#game-canvas"),
  statusText: document.querySelector("#status-text"),
  buildToggle: document.querySelector("#build-toggle"),
  deleteToggle: document.querySelector("#delete-toggle"),
  buildPanel: document.querySelector("#build-panel"),
  categoryTabs: document.querySelector("#category-tabs"),
  itemGrid: document.querySelector("#item-grid"),
  rotateButton: document.querySelector("#rotate-button"),
  saveExitButton: document.querySelector("#save-exit-button"),
  savedScreen: document.querySelector("#saved-screen"),
  savedSummary: document.querySelector("#saved-summary"),
  continueButton: document.querySelector("#continue-button"),
  newWorldButton: document.querySelector("#new-world-button"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#bfe5ff");
scene.fog = new THREE.Fog("#bfe5ff", 18, 42);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(9, 9, 12);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: els.canvas,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 6;
controls.maxDistance = 28;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const placementRoot = new THREE.Group();
const previewRoot = new THREE.Group();
const cursorTile = makeCursorTile();
const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
  new THREE.MeshBasicMaterial({ visible: false }),
);

groundPlane.rotation.x = -Math.PI / 2;
scene.add(groundPlane, placementRoot, previewRoot, cursorTile);

let previewMesh = null;
let dragStart = null;
let lastPointerScreen = null;

setupWorld();
setupUi();
loadSavedWorld();
resize();
animate();

window.addEventListener("resize", resize);
window.addEventListener("keydown", onKeyDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointerup", onPointerUp);
controls.addEventListener("change", render);

window.advanceTime = (ms = 16) => {
  const steps = Math.max(1, Math.ceil(ms / 16));
  for (let index = 0; index < steps; index += 1) {
    controls.update();
  }
  render();
};

window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "origin at center of floor, x right, z forward, y up, placements snap to 1x1 floor cells",
    mode: state.savedOverlayOpen ? "saved_screen" : "building",
    buildPanelOpen: state.buildOpen,
    deleteMode: state.deleteMode,
    activeCategory: CATEGORY_BY_ID.get(state.activeCategoryId)?.label ?? null,
    selected: selectedItem()
      ? {
          category: selectedItem().categoryLabel,
          name: selectedItem().name,
          rotationDegrees: Math.round(THREE.MathUtils.radToDeg(state.rotation)),
        }
      : null,
    pointerCell: state.pointerCell,
    objectCount: state.placements.length,
    objects: state.placements.slice(-12).map((placement) => ({
      name: placement.name,
      category: placement.categoryLabel,
      x: placement.x,
      y: placement.y ?? 0,
      z: placement.z,
      rotationDegrees: Math.round(THREE.MathUtils.radToDeg(placement.rotation)),
    })),
  });

window.__buildingGame = {
  catalog: CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    items: category.items.map((catalogItem) => ({ id: catalogItem.id, name: catalogItem.name })),
  })),
  selectItem: (categoryId, itemId) => selectItem(`${categoryId}:${itemId}`),
  placeSelected,
  deletePlacementAtIndex,
  saveAndExit,
  getState: () => JSON.parse(window.render_game_to_text()),
};

function item(id, name, color, kind, options = {}) {
  return { id, name, color, kind, ...options };
}

function setupWorld() {
  const hemi = new THREE.HemisphereLight("#fff7dd", "#7bb2c7", 2.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff1cf", 2.35);
  sun.position.set(8, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#7cc7ff", 0.75);
  fill.position.set(-8, 6, -5);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_SIZE + 1, 0.26, WORLD_SIZE + 1),
    material("#79bd69", { roughness: 0.92 }),
  );
  floor.position.y = -0.14;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(WORLD_SIZE, WORLD_SIZE, "#ffffff", "#a8d38f");
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.65;
  scene.add(grid);

  const borderColor = "#547943";
  addCube(scene, WORLD_SIZE + 0.4, 0.38, 0.28, borderColor, [0, 0.18, -HALF_WORLD - 0.2]);
  addCube(scene, WORLD_SIZE + 0.4, 0.38, 0.28, borderColor, [0, 0.18, HALF_WORLD + 0.2]);
  addCube(scene, 0.28, 0.38, WORLD_SIZE + 0.4, borderColor, [-HALF_WORLD - 0.2, 0.18, 0]);
  addCube(scene, 0.28, 0.38, WORLD_SIZE + 0.4, borderColor, [HALF_WORLD + 0.2, 0.18, 0]);
}

function setupUi() {
  renderCategoryTabs();
  renderItemGrid();
  updateBuildPanel();
  updateDeleteButton();

  els.buildToggle.addEventListener("click", () => {
    if (state.deleteMode) setDeleteMode(false);
    state.buildOpen = !state.buildOpen;
    updateBuildPanel();
    setStatus(state.buildOpen ? "카테고리와 건축물을 골라주세요" : "만들기 버튼을 누르면 목록이 열려요");
  });

  els.deleteToggle.addEventListener("click", () => {
    setDeleteMode(!state.deleteMode);
  });
  els.rotateButton.addEventListener("click", rotateSelection);
  els.saveExitButton.addEventListener("click", saveAndExit);
  els.continueButton.addEventListener("click", () => {
    state.savedOverlayOpen = false;
    els.savedScreen.hidden = true;
    setStatus("저장한 뒤 계속 만드는 중이에요");
  });
  els.newWorldButton.addEventListener("click", resetWorld);
}

function renderCategoryTabs() {
  els.categoryTabs.replaceChildren(
    ...CATEGORIES.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-tab${category.id === state.activeCategoryId ? " is-active" : ""}`;
      button.textContent = category.label;
      button.addEventListener("click", () => {
        state.activeCategoryId = category.id;
        renderCategoryTabs();
        renderItemGrid();
      });
      return button;
    }),
  );
}

function renderItemGrid() {
  const category = CATEGORY_BY_ID.get(state.activeCategoryId);
  const buttons = category.items.map((catalogItem) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `item-button${catalogItem.key === state.selectedKey ? " is-selected" : ""}`;
    button.innerHTML = `<span class="item-swatch" aria-hidden="true"></span><span class="item-label"></span>`;
    button.querySelector(".item-swatch").style.background = catalogItem.color;
    button.querySelector(".item-label").textContent = catalogItem.name;
    button.addEventListener("click", () => selectItem(catalogItem.key));
    return button;
  });
  els.itemGrid.replaceChildren(...buttons);
}

function updateBuildPanel() {
  els.buildPanel.hidden = !state.buildOpen;
  els.buildToggle.textContent = state.buildOpen ? "닫기" : "만들기";
}

function updateDeleteButton() {
  els.deleteToggle.classList.toggle("is-active", state.deleteMode);
  els.deleteToggle.setAttribute("aria-pressed", String(state.deleteMode));
  els.deleteToggle.textContent = state.deleteMode ? "삭제중" : "삭제";
}

function setDeleteMode(enabled) {
  state.deleteMode = enabled;
  if (enabled) {
    state.buildOpen = false;
    updateBuildPanel();
    previewRoot.clear();
    previewMesh = null;
    cursorTile.material.color.set("#d33f2f");
    setStatus("삭제할 블록을 눌러주세요");
  } else {
    cursorTile.material.color.set("#f35b2f");
  }
  updateDeleteButton();
  updatePreview();
}

function selectItem(key) {
  const catalogItem = ITEM_BY_KEY.get(key);
  if (!catalogItem) return;
  if (state.deleteMode) setDeleteMode(false);
  state.selectedKey = key;
  state.rotation = 0;
  state.activeCategoryId = catalogItem.categoryId;
  renderCategoryTabs();
  renderItemGrid();
  updatePreview();
  setStatus(`${catalogItem.categoryLabel} · ${catalogItem.name} 선택됨`);
}

function selectedItem() {
  return state.selectedKey ? ITEM_BY_KEY.get(state.selectedKey) : null;
}

function rotateSelection() {
  if (!selectedItem()) {
    setStatus("먼저 만들기에서 건축물을 골라주세요");
    return;
  }
  state.rotation = (state.rotation + Math.PI / 2) % (Math.PI * 2);
  updatePreview();
  setStatus(`${selectedItem().name} 방향을 돌렸어요`);
}

function onKeyDown(event) {
  if (event.key.toLowerCase() === "r") {
    rotateSelection();
  }
  if (event.key.toLowerCase() === "b") {
    if (state.deleteMode) setDeleteMode(false);
    state.buildOpen = !state.buildOpen;
    updateBuildPanel();
  }
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
  if (event.key === "Escape" && document.fullscreenElement) {
    document.exitFullscreen();
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}

function onPointerDown(event) {
  dragStart = { x: event.clientX, y: event.clientY };
}

function onPointerMove(event) {
  if (
    lastPointerScreen &&
    state.pointerCell &&
    Math.hypot(event.clientX - lastPointerScreen.x, event.clientY - lastPointerScreen.y) < 2
  ) {
    return;
  }
  lastPointerScreen = { x: event.clientX, y: event.clientY };
  const cell = getPointerCell(event.clientX, event.clientY);
  state.pointerCell = cell;
  cursorTile.visible = Boolean(cell);
  if (cell) {
    const catalogItem = selectedItem();
    const cursorY = catalogItem ? getPlacementY(catalogItem, cell.x, cell.z) : 0;
    cursorTile.position.set(cell.x, cursorY + 0.025, cell.z);
  }
  updatePreview();
}

function onPointerUp(event) {
  if (!dragStart) return;
  const dragDistance = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
  dragStart = null;
  if (dragDistance > 6) return;
  if (state.deleteMode) {
    deletePlacementAtPointer(event.clientX, event.clientY);
    return;
  }
  const cell = state.pointerCell ?? getPointerCell(event.clientX, event.clientY);
  if (cell) {
    placeSelected(cell.x, cell.z);
  }
}

function getPointerCell(clientX, clientY) {
  updatePointerRay(clientX, clientY);
  const catalogItem = selectedItem();
  if (catalogItem?.kind === "block") {
    const blockTargetCell = getBlockSurfaceTargetCell();
    if (blockTargetCell) return blockTargetCell;
  }
  const [hit] = raycaster.intersectObject(groundPlane);
  if (!hit) return null;
  return cellFromPoint(hit.point);
}

function updatePointerRay(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
}

function cellFromPoint(point) {
  return clampGridCell(point.x, point.z);
}

function clampGridCell(xValue, zValue) {
  const x = THREE.MathUtils.clamp(Math.round(xValue), -HALF_WORLD + 1, HALF_WORLD - 1);
  const z = THREE.MathUtils.clamp(Math.round(zValue), -HALF_WORLD + 1, HALF_WORLD - 1);
  return { x, z };
}

function getBlockSurfaceTargetCell() {
  const placementHit = getPointerPlacementHit({ requireFace: true });
  if (!placementHit) return null;

  const placement = findPlacementForObject(placementHit.object);
  if (!placement) return null;

  const normal = placementHit.face.normal
    .clone()
    .transformDirection(placementHit.object.matrixWorld)
    .normalize();

  if (normal.y > 0.55) {
    return { x: placement.x, z: placement.z };
  }
  if (normal.y < -0.55) {
    return null;
  }

  const xStrength = Math.abs(normal.x);
  const zStrength = Math.abs(normal.z);
  if (xStrength < 0.25 && zStrength < 0.25) return null;

  const offsetX = xStrength >= zStrength ? Math.sign(normal.x) : 0;
  const offsetZ = zStrength > xStrength ? Math.sign(normal.z) : 0;
  return clampGridCell(placement.x + offsetX, placement.z + offsetZ);
}

function placeSelected(x, z, y = null) {
  const catalogItem = selectedItem();
  if (!catalogItem) {
    setStatus("만들기 버튼을 눌러 건축물을 먼저 골라주세요");
    return;
  }
  const placementY = Number.isFinite(y) ? y : getPlacementY(catalogItem, x, z);
  const mesh = createItemMesh(catalogItem);
  mesh.position.set(x, placementY, z);
  mesh.rotation.y = state.rotation;
  placementRoot.add(mesh);

  const placement = {
    key: catalogItem.key,
    name: catalogItem.name,
    categoryId: catalogItem.categoryId,
    categoryLabel: catalogItem.categoryLabel,
    x,
    y: placementY,
    z,
    rotation: state.rotation,
    mesh,
  };
  state.placements.push(placement);
  setStatus(`${catalogItem.name} 배치됨 · 총 ${state.placements.length}개`);
  updatePreview();
}

function getPlacementY(catalogItem, x, z) {
  if (catalogItem.kind !== "block") return 0;
  const topY = state.placements
    .filter((placement) => placement.x === x && placement.z === z)
    .reduce((highest, placement) => Math.max(highest, getPlacementTopY(placement)), 0);
  return roundStackY(topY);
}

function getPlacementTopY(placement) {
  const catalogItem = ITEM_BY_KEY.get(placement.key);
  return (placement.y ?? 0) + getStackHeight(catalogItem);
}

function getStackHeight(catalogItem) {
  if (!catalogItem) return 1;
  if (catalogItem.kind === "block") return 1;
  if (catalogItem.kind === "bunkBed") return 2;
  if (catalogItem.kind === "lamp" || catalogItem.kind === "locker" || catalogItem.kind === "fridge") return 1.9;
  if (catalogItem.kind === "window") return catalogItem.window === "big" || catalogItem.window === "tall" ? 1.9 : 1.1;
  if (catalogItem.kind === "chalkboard" || catalogItem.kind === "swing" || catalogItem.kind === "slide") return 1.8;
  return 1.2;
}

function roundStackY(value) {
  return Math.round(value * 100) / 100;
}

function updatePreview() {
  previewRoot.clear();
  previewMesh = null;
  const catalogItem = selectedItem();
  if (state.deleteMode || !catalogItem || !state.pointerCell) {
    render();
    return;
  }
  previewMesh = createItemMesh(catalogItem);
  previewMesh.position.set(
    state.pointerCell.x,
    getPlacementY(catalogItem, state.pointerCell.x, state.pointerCell.z),
    state.pointerCell.z,
  );
  previewMesh.rotation.y = state.rotation;
  previewMesh.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material = child.material.clone();
    child.material.transparent = true;
    child.material.opacity = Math.min(child.material.opacity ?? 1, 0.45);
    child.material.depthWrite = false;
  });
  previewRoot.add(previewMesh);
  render();
}

function deletePlacementAtPointer(clientX, clientY) {
  const placement = getPointerPlacement(clientX, clientY);
  if (!placement) {
    setStatus("삭제할 블록을 다시 눌러주세요");
    return;
  }
  deletePlacement(placement);
  state.pointerCell = null;
  cursorTile.visible = false;
  setDeleteMode(false);
  previewRoot.clear();
  previewMesh = null;
  setStatus(`${placement.name} 삭제됨 · 총 ${state.placements.length}개`);
  render();
}

function getPointerPlacement(clientX, clientY) {
  updatePointerRay(clientX, clientY);
  const hit = getPointerPlacementHit();
  return hit ? findPlacementForObject(hit.object) : null;
}

function getPointerPlacementHit({ requireFace = false } = {}) {
  const hits = raycaster.intersectObjects(placementRoot.children, true);
  for (const hit of hits) {
    if (requireFace && (!hit.object.isMesh || !hit.face)) continue;
    const placement = findPlacementForObject(hit.object);
    if (placement) return hit;
  }
  return null;
}

function findPlacementForObject(object) {
  let current = object;
  while (current) {
    const placement = state.placements.find((candidate) => candidate.mesh === current);
    if (placement) return placement;
    current = current.parent;
  }
  return null;
}

function deletePlacementAtIndex(index) {
  const placement = state.placements[index];
  if (!placement) return false;
  deletePlacement(placement);
  setStatus(`${placement.name} 삭제됨 · 총 ${state.placements.length}개`);
  render();
  return true;
}

function deletePlacement(placement) {
  placementRoot.remove(placement.mesh);
  disposeObject(placement.mesh);
  state.placements = state.placements.filter((candidate) => candidate !== placement);
}

function saveAndExit() {
  const payload = {
    savedAt: new Date().toISOString(),
    objects: state.placements.map((placement) => ({
      key: placement.key,
      x: placement.x,
      y: placement.y ?? 0,
      z: placement.z,
      rotation: placement.rotation,
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  state.savedOverlayOpen = true;
  els.savedSummary.textContent = `${state.placements.length}개의 3D 건축물을 저장했어요. 다음에 열면 같은 위치에서 이어서 만들 수 있어요.`;
  els.savedScreen.hidden = false;
  setStatus("저장 완료");
}

function loadSavedWorld() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setStatus("만들기 버튼을 누르면 건축물 목록이 열려요");
    return;
  }
  try {
    const payload = JSON.parse(raw);
    const objects = Array.isArray(payload.objects) ? payload.objects : [];
    for (const savedObject of objects) {
      const catalogItem = ITEM_BY_KEY.get(savedObject.key);
      if (!catalogItem) continue;
      const mesh = createItemMesh(catalogItem);
      mesh.position.set(savedObject.x, savedObject.y ?? 0, savedObject.z);
      mesh.rotation.y = savedObject.rotation ?? 0;
      placementRoot.add(mesh);
      state.placements.push({
        key: catalogItem.key,
        name: catalogItem.name,
        categoryId: catalogItem.categoryId,
        categoryLabel: catalogItem.categoryLabel,
        x: savedObject.x,
        y: savedObject.y ?? 0,
        z: savedObject.z,
        rotation: savedObject.rotation ?? 0,
        mesh,
      });
    }
    setStatus(`${state.placements.length}개의 저장된 건축물을 불러왔어요`);
  } catch (error) {
    console.warn("Saved world could not be loaded.", error);
    setStatus("저장 데이터를 읽지 못했어요. 새로 만들 수 있어요");
  }
}

function resetWorld() {
  localStorage.removeItem(STORAGE_KEY);
  for (const placement of state.placements) {
    placementRoot.remove(placement.mesh);
    disposeObject(placement.mesh);
  }
  state.placements = [];
  state.savedOverlayOpen = false;
  els.savedScreen.hidden = true;
  setStatus("새 건축판을 시작했어요");
  render();
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      for (const childMaterial of child.material) childMaterial.dispose();
    } else if (child.material) {
      child.material.dispose();
    }
  });
}

function createItemMesh(catalogItem) {
  const group = new THREE.Group();
  group.name = catalogItem.name;

  switch (catalogItem.kind) {
    case "block":
      buildBlock(group, catalogItem);
      break;
    case "bed":
      buildBed(group, catalogItem);
      break;
    case "chair":
      buildChair(group, catalogItem.color);
      break;
    case "bunkBed":
      buildBunkBed(group, catalogItem);
      break;
    case "frame":
      buildFrame(group);
      break;
    case "bookshelf":
      buildBookshelf(group);
      break;
    case "desk":
      buildDesk(group, catalogItem.color);
      break;
    case "dresser":
      buildDresser(group, catalogItem.color);
      break;
    case "lamp":
      buildLamp(group);
      break;
    case "bathtub":
      buildBathtub(group);
      break;
    case "toilet":
      buildToilet(group);
      break;
    case "toiletPaper":
      buildToiletPaper(group);
      break;
    case "shower":
      buildShower(group);
      break;
    case "towel":
      buildTowel(group);
      break;
    case "sink":
      buildSink(group);
      break;
    case "washer":
      buildWasher(group);
      break;
    case "oven":
      buildOven(group);
      break;
    case "kitchenCabinet":
      buildKitchenCabinet(group);
      break;
    case "microwave":
      buildMicrowave(group);
      break;
    case "kettle":
      buildKettle(group);
      break;
    case "table":
      buildTable(group, catalogItem.color);
      break;
    case "fridge":
      buildFridge(group);
      break;
    case "food":
      buildFood(group, catalogItem.food);
      break;
    case "swing":
      buildSwing(group);
      break;
    case "pool":
      buildPool(group);
      break;
    case "seesaw":
      buildSeesaw(group);
      break;
    case "slide":
      buildSlide(group);
      break;
    case "locker":
      buildLocker(group);
      break;
    case "chalkboard":
      buildChalkboard(group);
      break;
    case "bag":
      buildBag(group);
      break;
    case "book":
      buildBook(group);
      break;
    case "podium":
      buildPodium(group);
      break;
    case "schoolDesk":
      buildSchoolDesk(group);
      break;
    case "window":
      buildWindow(group, catalogItem.window);
      break;
    default:
      buildBlock(group, catalogItem);
  }

  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return group;
}

function buildBlock(group, catalogItem) {
  addCube(group, 1, 1, 1, catalogItem.color, [0, 0.5, 0], {
    transparent: catalogItem.transparent,
    opacity: catalogItem.transparent ? 0.56 : 1,
    roughness: catalogItem.transparent ? 0.15 : 0.78,
    metalness: 0,
  });

  if (catalogItem.texture === "birch") {
    for (const x of [-0.28, 0.22]) {
      addCube(group, 0.08, 0.86, 1.03, "#7b6048", [x, 0.5, 0], { opacity: 0.55 });
    }
  }
  if (catalogItem.texture === "wood") {
    for (const y of [0.3, 0.56, 0.82]) {
      addCube(group, 1.03, 0.025, 1.03, "#3c2419", [0, y, 0], { opacity: 0.42 });
    }
  }
  if (catalogItem.texture === "brick") {
    for (const y of [0.28, 0.52, 0.76]) {
      addCube(group, 1.04, 0.035, 1.04, "#6b2c24", [0, y, 0], { opacity: 0.56 });
    }
    for (const x of [-0.25, 0.25]) {
      addCube(group, 0.035, 0.2, 1.05, "#6b2c24", [x, 0.4, 0], { opacity: 0.48 });
      addCube(group, 0.035, 0.2, 1.05, "#6b2c24", [-x, 0.66, 0], { opacity: 0.48 });
    }
  }
  if (catalogItem.texture === "concrete") {
    addCube(group, 0.18, 0.04, 0.18, "#85877f", [-0.24, 0.92, -0.18], { opacity: 0.55 });
    addCube(group, 0.12, 0.04, 0.12, "#cacbc6", [0.24, 0.32, 0.22], { opacity: 0.65 });
  }
}

function buildBed(group, catalogItem) {
  addCube(group, 1.8, 0.28, 2.5, "#7c442e", [0, 0.2, 0]);
  addCube(group, 1.64, 0.3, 2.18, catalogItem.color, [0, 0.5, 0.1], { roughness: 0.65 });
  addCube(group, 1.45, 0.22, 0.54, "#fff2dc", [0, 0.68, -0.74]);
  addCube(group, 1.9, 1.1, 0.18, "#8c5d3b", [0, 0.62, -1.23]);
}

function buildChair(group, color) {
  addCube(group, 0.9, 0.18, 0.86, color, [0, 0.62, 0]);
  addCube(group, 0.92, 0.92, 0.16, color, [0, 1.08, 0.36]);
  for (const x of [-0.32, 0.32]) {
    for (const z of [-0.28, 0.28]) {
      addCube(group, 0.12, 0.58, 0.12, "#5d3a24", [x, 0.29, z]);
    }
  }
}

function buildBunkBed(group, catalogItem) {
  for (const y of [0.36, 1.38]) {
    addCube(group, 1.8, 0.22, 2.34, "#68442d", [0, y, 0]);
    addCube(group, 1.58, 0.22, 2.02, catalogItem.color, [0, y + 0.22, 0.06]);
    addCube(group, 1.34, 0.18, 0.5, "#fff2dc", [0, y + 0.38, -0.68]);
  }
  for (const x of [-0.82, 0.82]) {
    for (const z of [-1.1, 1.1]) {
      addCube(group, 0.14, 1.92, 0.14, "#4c3526", [x, 0.96, z]);
    }
  }
  for (const y of [0.62, 0.9, 1.18]) {
    addCube(group, 0.58, 0.07, 0.08, "#f0d28b", [1.04, y, -0.25]);
  }
}

function buildFrame(group) {
  addCube(group, 1.4, 1, 0.12, "#704420", [0, 0.82, 0]);
  addCube(group, 1.06, 0.66, 0.14, "#f7d276", [0, 0.82, -0.01]);
  addCube(group, 0.32, 0.28, 0.16, "#5d9bd3", [-0.24, 0.86, -0.04]);
  addCube(group, 0.32, 0.28, 0.16, "#ec7357", [0.2, 0.72, -0.04]);
}

function buildBookshelf(group) {
  addCube(group, 1.45, 1.8, 0.44, "#7d5137", [0, 0.9, 0]);
  for (const y of [0.5, 0.93, 1.36]) {
    addCube(group, 1.34, 0.08, 0.5, "#5b3424", [0, y, 0]);
  }
  const colors = ["#e85949", "#5174c4", "#f2bd4b", "#5ea65c", "#8e62b8"];
  for (let row = 0; row < 3; row += 1) {
    for (let index = 0; index < 5; index += 1) {
      addCube(group, 0.16, 0.34, 0.18, colors[(row + index) % colors.length], [-0.5 + index * 0.24, 0.28 + row * 0.43, -0.24]);
    }
  }
}

function buildDesk(group, color) {
  addCube(group, 1.75, 0.18, 1, color, [0, 0.82, 0]);
  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.36, 0.36]) {
      addCube(group, 0.14, 0.76, 0.14, "#5c3824", [x, 0.38, z]);
    }
  }
  addCube(group, 0.48, 0.18, 0.36, "#ead7b2", [0.38, 1.02, -0.08]);
}

function buildDresser(group, color) {
  addCube(group, 1.2, 1.1, 0.72, color, [0, 0.55, 0]);
  for (const y of [0.28, 0.58, 0.88]) {
    addCube(group, 1.04, 0.18, 0.04, "#8f5530", [0, y, -0.38]);
    addCube(group, 0.18, 0.05, 0.05, "#efd28c", [0, y, -0.43]);
  }
}

function buildLamp(group) {
  addCylinder(group, 0.26, 0.34, 0.16, "#293f56", [0, 0.08, 0]);
  addCylinder(group, 0.055, 0.055, 1.1, "#6f7780", [0, 0.62, 0]);
  addCylinder(group, 0.42, 0.28, 0.42, "#ffd65a", [0, 1.28, 0], [0, 0, 0], {
    emissive: "#ffca4b",
    emissiveIntensity: 0.6,
  });
  const glow = new THREE.PointLight("#ffd65a", 1.4, 5);
  glow.position.set(0, 1.28, 0);
  group.add(glow);
}

function buildBathtub(group) {
  addCube(group, 1.7, 0.58, 0.92, "#eef6fb", [0, 0.34, 0]);
  addCube(group, 1.25, 0.18, 0.52, "#7dd5ff", [0, 0.68, 0], { transparent: true, opacity: 0.68 });
  addCylinder(group, 0.06, 0.06, 0.42, "#8da0aa", [0.64, 0.82, -0.25], [Math.PI / 2, 0, 0]);
  addCylinder(group, 0.05, 0.05, 0.28, "#8da0aa", [0.64, 0.72, -0.1]);
}

function buildToilet(group) {
  addCylinder(group, 0.4, 0.32, 0.42, "#f8fbff", [0, 0.28, 0.06]);
  addTorus(group, 0.31, 0.045, "#dce8ef", [0, 0.52, 0.06], [Math.PI / 2, 0, 0]);
  addCube(group, 0.7, 0.72, 0.22, "#f8fbff", [0, 0.72, 0.48]);
  addCube(group, 0.5, 0.1, 0.1, "#9aaab2", [0, 0.95, 0.34]);
}

function buildToiletPaper(group) {
  addCube(group, 0.72, 0.78, 0.18, "#7b8790", [0, 0.42, 0.18]);
  addCylinder(group, 0.26, 0.26, 0.42, "#ffffff", [0, 0.72, 0], [Math.PI / 2, 0, 0]);
  addCylinder(group, 0.1, 0.1, 0.44, "#d8dde0", [0, 0.72, 0], [Math.PI / 2, 0, 0]);
}

function buildShower(group) {
  addCube(group, 1.35, 0.14, 1.05, "#e9f3f7", [0, 0.07, 0]);
  addCube(group, 0.08, 1.78, 1.05, "#9edaf2", [-0.64, 0.98, 0], { transparent: true, opacity: 0.42 });
  addCube(group, 0.08, 1.78, 1.05, "#9edaf2", [0.64, 0.98, 0], { transparent: true, opacity: 0.42 });
  addCube(group, 1.35, 1.78, 0.08, "#9edaf2", [0, 0.98, -0.48], { transparent: true, opacity: 0.42 });
  addCylinder(group, 0.045, 0.045, 1.28, "#7b8d97", [0.48, 0.86, 0.38]);
  addCylinder(group, 0.16, 0.08, 0.18, "#7b8d97", [0.48, 1.52, 0.22], [Math.PI / 2, 0, 0]);
}

function buildTowel(group) {
  addCube(group, 1.1, 0.08, 0.08, "#77858c", [0, 1.12, 0]);
  addCube(group, 0.78, 0.86, 0.08, "#ff9fa9", [0, 0.68, -0.02]);
  addCube(group, 0.8, 0.05, 0.09, "#f36b7d", [0, 0.95, -0.04]);
}

function buildSink(group) {
  addCylinder(group, 0.44, 0.32, 0.24, "#f3f8fb", [0, 0.82, 0]);
  addCylinder(group, 0.22, 0.18, 0.44, "#e1edf2", [0, 0.38, 0]);
  addCube(group, 0.72, 0.15, 0.28, "#f3f8fb", [0, 0.96, 0.2]);
  addCylinder(group, 0.04, 0.04, 0.36, "#8298a5", [0.22, 1.12, 0.02], [Math.PI / 2, 0, 0]);
}

function buildWasher(group) {
  addCube(group, 1, 1.18, 0.82, "#d8e4eb", [0, 0.59, 0]);
  addCylinder(group, 0.32, 0.32, 0.08, "#8bb8d0", [0, 0.55, -0.44], [Math.PI / 2, 0, 0], {
    transparent: true,
    opacity: 0.78,
  });
  addCube(group, 0.78, 0.16, 0.04, "#b3c3cc", [0, 1.04, -0.44]);
}

function buildOven(group) {
  addCube(group, 1, 1, 0.82, "#4d5967", [0, 0.5, 0]);
  addCube(group, 0.68, 0.48, 0.04, "#2d3744", [0, 0.44, -0.43], { transparent: true, opacity: 0.85 });
  for (const x of [-0.24, 0, 0.24]) {
    addCylinder(group, 0.055, 0.055, 0.04, "#d9c36f", [x, 0.86, -0.45], [Math.PI / 2, 0, 0]);
  }
}

function buildKitchenCabinet(group) {
  addCube(group, 1.3, 0.98, 0.78, "#df9b55", [0, 0.49, 0]);
  addCube(group, 1.36, 0.12, 0.84, "#9d6840", [0, 1.04, 0]);
  for (const x of [-0.32, 0.32]) {
    addCube(group, 0.5, 0.34, 0.04, "#c27a3f", [x, 0.48, -0.42]);
    addCube(group, 0.08, 0.04, 0.05, "#fff0b7", [x, 0.5, -0.46]);
  }
}

function buildMicrowave(group) {
  addCube(group, 1.05, 0.62, 0.62, "#cfd9df", [0, 0.56, 0]);
  addCube(group, 0.58, 0.34, 0.04, "#31414d", [-0.16, 0.58, -0.34], { transparent: true, opacity: 0.82 });
  addCube(group, 0.18, 0.42, 0.05, "#aab8c0", [0.34, 0.58, -0.34]);
}

function buildKettle(group) {
  addCylinder(group, 0.38, 0.3, 0.58, "#7cc0cf", [0, 0.42, 0]);
  addCylinder(group, 0.16, 0.22, 0.18, "#7cc0cf", [0, 0.83, 0]);
  addTorus(group, 0.42, 0.04, "#4f8998", [0, 0.64, 0], [0, Math.PI / 2, 0]);
  addCylinder(group, 0.06, 0.12, 0.38, "#7cc0cf", [0.42, 0.52, 0], [0, 0, Math.PI / 2]);
}

function buildTable(group, color) {
  addCube(group, 1.7, 0.16, 1.2, color, [0, 0.82, 0]);
  for (const x of [-0.66, 0.66]) {
    for (const z of [-0.44, 0.44]) {
      addCube(group, 0.12, 0.76, 0.12, "#6a4028", [x, 0.38, z]);
    }
  }
}

function buildFridge(group) {
  addCube(group, 1.02, 1.82, 0.86, "#e6edf2", [0, 0.91, 0]);
  addCube(group, 0.96, 0.04, 0.88, "#cbd8df", [0, 1.1, 0]);
  addCube(group, 0.06, 0.52, 0.08, "#9aaab2", [0.4, 1.42, -0.45]);
  addCube(group, 0.06, 0.62, 0.08, "#9aaab2", [0.4, 0.62, -0.45]);
}

function buildFood(group, foodType) {
  addCylinder(group, 0.5, 0.5, 0.08, "#f5f0e5", [0, 0.06, 0]);
  if (foodType === "steak") {
    addCube(group, 0.72, 0.14, 0.42, "#9e3b2f", [0, 0.18, 0]);
    addCube(group, 0.48, 0.04, 0.06, "#f5c18d", [0.05, 0.27, -0.04]);
  }
  if (foodType === "cake") {
    addCylinder(group, 0.34, 0.34, 0.36, "#fff0aa", [0, 0.26, 0]);
    addCylinder(group, 0.34, 0.34, 0.06, "#ff8ab0", [0, 0.48, 0]);
    addCylinder(group, 0.03, 0.03, 0.18, "#ff4d3d", [0, 0.62, 0]);
  }
  if (foodType === "water") {
    addCylinder(group, 0.18, 0.14, 0.58, "#71c8ff", [0, 0.36, 0], [0, 0, 0], {
      transparent: true,
      opacity: 0.62,
    });
    addCylinder(group, 0.12, 0.12, 0.08, "#2e7fb8", [0, 0.68, 0]);
  }
  if (foodType === "pasta") {
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      addCylinder(group, 0.025, 0.025, 0.42, "#f3c35d", [Math.cos(angle) * 0.17, 0.22, Math.sin(angle) * 0.17], [
        Math.PI / 2,
        0,
        angle,
      ]);
    }
    addSphere(group, 0.14, "#d44230", [0.08, 0.28, 0.02]);
  }
  if (foodType === "hamburger") {
    addCylinder(group, 0.36, 0.32, 0.16, "#d89742", [0, 0.19, 0]);
    addCylinder(group, 0.36, 0.36, 0.08, "#6b3b25", [0, 0.32, 0]);
    addCylinder(group, 0.34, 0.38, 0.16, "#e5ad54", [0, 0.44, 0]);
    addCube(group, 0.58, 0.04, 0.16, "#55a85f", [0, 0.38, 0]);
  }
  if (foodType === "mackerel") {
    addSphere(group, 0.3, "#6f8fa7", [0, 0.24, 0], [1.7, 0.45, 0.55]);
    addCone(group, 0.18, 0.32, "#536b7d", [-0.46, 0.24, 0], [0, 0, -Math.PI / 2]);
    addSphere(group, 0.035, "#111111", [0.34, 0.3, -0.08]);
  }
  if (foodType === "rice") {
    addCylinder(group, 0.34, 0.28, 0.24, "#dbe7f0", [0, 0.2, 0]);
    addSphere(group, 0.28, "#fff7e8", [0, 0.4, 0], [1, 0.52, 1]);
  }
}

function buildSwing(group) {
  addCube(group, 1.9, 0.1, 0.1, "#6c4a2e", [0, 1.82, 0]);
  for (const x of [-0.82, 0.82]) {
    addCube(group, 0.1, 1.8, 0.1, "#6c4a2e", [x, 0.9, -0.42], { rotationZ: x < 0 ? -0.18 : 0.18 });
    addCube(group, 0.1, 1.8, 0.1, "#6c4a2e", [x, 0.9, 0.42], { rotationZ: x < 0 ? 0.18 : -0.18 });
  }
  for (const x of [-0.28, 0.28]) {
    addCube(group, 0.035, 0.9, 0.035, "#3f4c54", [x, 1.26, 0]);
  }
  addCube(group, 0.82, 0.12, 0.38, "#64a052", [0, 0.78, 0]);
}

function buildPool(group) {
  addCylinder(group, 0.88, 0.88, 0.25, "#e5f3fa", [0, 0.13, 0], [0, 0, 0], { radialSegments: 36 });
  addCylinder(group, 0.74, 0.74, 0.08, "#2ea8df", [0, 0.3, 0], [0, 0, 0], {
    transparent: true,
    opacity: 0.76,
    radialSegments: 36,
  });
}

function buildSeesaw(group) {
  addCylinder(group, 0.18, 0.34, 0.44, "#6f7780", [0, 0.22, 0]);
  addCube(group, 2, 0.12, 0.32, "#f5ba4f", [0, 0.62, 0], { rotationZ: -0.16 });
  addCube(group, 0.18, 0.2, 0.38, "#e85949", [-0.86, 0.74, 0]);
  addCube(group, 0.18, 0.2, 0.38, "#4d8fc7", [0.86, 0.5, 0]);
}

function buildSlide(group) {
  addCube(group, 0.82, 1.18, 0.74, "#f0c14b", [-0.5, 0.59, 0]);
  addCube(group, 1.54, 0.16, 0.72, "#f05a41", [0.42, 0.68, 0], { rotationZ: -0.5 });
  for (const y of [0.32, 0.58, 0.84]) {
    addCube(group, 0.08, 0.08, 0.86, "#7f8d96", [-0.82, y, 0]);
  }
}

function buildLocker(group) {
  addCube(group, 1.12, 1.85, 0.58, "#6d88a8", [0, 0.93, 0]);
  addCube(group, 0.04, 1.72, 0.04, "#4f6b88", [0, 0.94, -0.31]);
  for (const x of [-0.28, 0.28]) {
    addCube(group, 0.24, 0.035, 0.04, "#d7e1e7", [x, 1.42, -0.33]);
    addCube(group, 0.06, 0.16, 0.04, "#edf3f6", [x + 0.12, 0.82, -0.33]);
  }
}

function buildChalkboard(group) {
  addCube(group, 1.85, 1.02, 0.12, "#2e6f55", [0, 1.08, 0]);
  addCube(group, 1.98, 0.08, 0.16, "#7d5137", [0, 1.62, 0]);
  addCube(group, 1.98, 0.08, 0.16, "#7d5137", [0, 0.54, 0]);
  addCube(group, 0.08, 1.08, 0.16, "#7d5137", [-0.98, 1.08, 0]);
  addCube(group, 0.08, 1.08, 0.16, "#7d5137", [0.98, 1.08, 0]);
  addCube(group, 0.54, 0.035, 0.04, "#edf4ef", [-0.48, 0.74, -0.08]);
}

function buildBag(group) {
  addCube(group, 0.82, 0.82, 0.42, "#e85949", [0, 0.46, 0]);
  addCube(group, 0.7, 0.28, 0.46, "#bf3d31", [0, 0.76, -0.02]);
  addTorus(group, 0.32, 0.035, "#78332f", [0, 0.64, 0.24], [Math.PI / 2, 0, 0]);
  addCube(group, 0.16, 0.08, 0.05, "#ffe08a", [0, 0.52, -0.24]);
}

function buildBook(group) {
  addCube(group, 0.92, 0.16, 0.68, "#5174c4", [0, 0.16, 0]);
  addCube(group, 0.84, 0.06, 0.6, "#f7f3df", [0.02, 0.28, 0]);
  addCube(group, 0.08, 0.05, 0.62, "#3353a1", [-0.46, 0.29, 0]);
}

function buildPodium(group) {
  addCube(group, 1.1, 1.1, 0.78, "#9a633a", [0, 0.55, 0]);
  addCube(group, 1.2, 0.12, 0.9, "#754824", [0, 1.16, -0.02], { rotationX: -0.12 });
  addCube(group, 0.58, 0.06, 0.04, "#efd69c", [0, 0.78, -0.42]);
}

function buildSchoolDesk(group) {
  addCube(group, 1.08, 0.16, 0.76, "#c0874c", [0, 0.72, 0]);
  addCube(group, 0.95, 0.36, 0.12, "#d9a468", [0, 0.45, -0.32]);
  for (const x of [-0.42, 0.42]) {
    for (const z of [-0.28, 0.28]) {
      addCube(group, 0.08, 0.58, 0.08, "#5f6d79", [x, 0.29, z]);
    }
  }
}

function buildWindow(group, variant) {
  const sizes = {
    wide: [1.75, 0.86],
    tall: [0.86, 1.75],
    small: [0.86, 0.86],
    big: [1.75, 1.75],
  };
  const [width, height] = sizes[variant] ?? sizes.small;
  addCube(group, width + 0.16, height + 0.16, 0.1, "#6b4a31", [0, height / 2 + 0.1, 0]);
  addCube(group, width, height, 0.08, "#9edaf2", [0, height / 2 + 0.1, -0.02], {
    transparent: true,
    opacity: 0.5,
    roughness: 0.05,
  });
  addCube(group, 0.08, height + 0.08, 0.12, "#6b4a31", [0, height / 2 + 0.1, -0.05]);
  addCube(group, width + 0.08, 0.08, 0.12, "#6b4a31", [0, height / 2 + 0.1, -0.05]);
}

function addCube(parent, width, height, depth, color, position, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material(color, options),
  );
  mesh.position.set(...position);
  mesh.rotation.set(options.rotationX ?? 0, options.rotationY ?? 0, options.rotationZ ?? 0);
  addEdges(mesh, options.edgeColor ?? "#251b13", options.edgeOpacity ?? 0.18);
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radiusTop, radiusBottom, height, color, position, rotation = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, options.radialSegments ?? 24),
    material(color, options),
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addCone(parent, radius, height, color, position, rotation = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, options.radialSegments ?? 24),
    material(color, options),
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, color, position, scale = [1, 1, 1], options = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material(color, options));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function addTorus(parent, radius, tube, color, position, rotation = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 32), material(color, options));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.02,
    transparent: options.transparent ?? options.opacity < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? "#000000",
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function addEdges(mesh, color, opacity) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  mesh.add(edges);
}

function makeCursorTile() {
  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.035, 1.04),
    new THREE.MeshBasicMaterial({
      color: "#f35b2f",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  tile.visible = false;
  return tile;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  render();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}
