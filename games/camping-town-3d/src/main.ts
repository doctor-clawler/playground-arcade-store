import "./styles.css";
import * as THREE from "three";
import {
  COLLECTIBLE_LABELS,
  FOOD_LABELS,
  FURNITURE_SPECS,
  SHOP_ITEMS,
  advanceSimulation,
  buyShopItem,
  claimTent,
  collectTownItem,
  createInitialState,
  eatMarshmallow,
  feedAnimal,
  getOwnerReply,
  petAnimal,
  placeFurniture,
  startMarshmallowRoast,
  talkToResident,
  type Animal,
  type CollectibleKind,
  type FoodKind,
  type FurnitureType,
  type PlacedFurniture,
  type Resident,
  type ShopItemId,
  type Tent,
  type TownCollectible,
  type Vec2,
} from "./game/simulation/state";

type Mode = "camp" | "tent" | "toilet";
type ClickKind =
  | "owner"
  | "freezer"
  | "shelf"
  | "tent"
  | "animal"
  | "toiletBuilding"
  | "sink"
  | "toiletStall"
  | "pool"
  | "resident"
  | "collectible"
  | "noticeBoard";

interface ClickPayload {
  kind: ClickKind;
  id?: string;
}

type PersonHairVariant = "tuft" | "buns" | "bob" | "sidePart" | "cap";

interface PersonStyle {
  hairColor?: string;
  accentColor?: string;
  pantsColor?: string;
  shoeColor?: string;
  cheekColor?: string;
  hairVariant?: PersonHairVariant;
}

interface CampingCheckpoint {
  state: ReturnType<typeof createInitialState>;
  mode: Mode;
  activeTentId: string | null;
  position: number[];
}

interface WindowWithGameHooks extends Window {
  LoaSave?: {
    register(adapter: { version: number; capture: () => CampingCheckpoint; restore: (saved: CampingCheckpoint) => void }): void;
    restoreObject<T extends object>(target: T, saved: T): T;
  };
  render_game_to_text?: () => string;
  advanceTime?: (ms: number) => void;
}

const state = createInitialState();
const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) throw new Error("#app is missing");
const app: HTMLDivElement = appElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9fd4ff");
scene.fog = new THREE.Fog("#9fd4ff", 32, 78);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 24, 26);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "game-canvas";
app.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickTargets: THREE.Object3D[] = [];
const clock = new THREE.Clock();

const campGroup = new THREE.Group();
campGroup.name = "Campground";
const tentInteriorGroup = new THREE.Group();
tentInteriorGroup.name = "TentInterior";
const toiletInteriorGroup = new THREE.Group();
toiletInteriorGroup.name = "ToiletInterior";
scene.add(campGroup, tentInteriorGroup, toiletInteriorGroup);

const ambientLight = new THREE.HemisphereLight("#fff6d4", "#66a05d", 1.7);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight("#fff4c2", 2.2);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const campfireLight = new THREE.PointLight("#ff8b3d", 0, 18, 1.8);
campfireLight.position.set(9.5, 1.2, -5.5);
scene.add(campfireLight);

const animalMeshes = new Map<string, THREE.Group>();
const residentMeshes = new Map<string, THREE.Group>();
const collectibleMeshes = new Map<string, THREE.Group>();
const tentNameSprites = new Map<string, THREE.Sprite>();
const furnitureMeshes = new Map<string, THREE.Object3D>();
const waterSurfaces: THREE.Object3D[] = [];
const cloudMeshes: THREE.Group[] = [];
const lampLights: THREE.PointLight[] = [];
const keys = new Set<string>();
const screenKeys = new Set<string>();

let mode: Mode = "camp";
let activeTentId: string | null = null;
let selectedFurniture: FurnitureType | null = null;
let playerSeated = false;
let washingUntilMs = 0;
let lastMessage = "여름 캠핑장에 도착했어요.";
let lastPanelTitle = "";
let tentFloor: THREE.Mesh | null = null;
let toiletSitUntilMs = 0;

const player = createPerson("#ffcf78", "#2e7dd7", "플레이어", {
  hairColor: "#4a2f24",
  accentColor: "#ffd166",
  pantsColor: "#1b4965",
  hairVariant: "tuft",
});
player.position.set(0, 0, 3);
campGroup.add(player);

const hud = createHud();
addSkyDetails();
createCampground();
createTentInterior();
createToiletInterior();
setMode("camp");
setMessage("솔바람 캠핑 타운에 오신 걸 환영해요. 주민과 대화하고 반짝이는 수집품을 주워 보세요.");
updateHud();

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === "Escape") {
    closePanel();
    selectedFurniture = null;
  }
  if (event.key.toLowerCase() === "f") toggleFullscreen();
  if (event.key === " " && mode === "toilet" && playerSeated) {
    playerSeated = false;
    toiletSitUntilMs = state.elapsedMs + 500;
    setMessage("점프해서 일어났어요.");
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("webglcontextlost", (event: Event) => {
  event.preventDefault();
  setMessage("그래픽 컨텍스트가 잠시 멈췄어요. 새로고침하면 복구됩니다.");
});

(window as WindowWithGameHooks).render_game_to_text = renderGameToText;
(window as WindowWithGameHooks).advanceTime = (ms: number) => {
  step(Math.max(0, ms));
  renderFrame();
};

(window as WindowWithGameHooks).LoaSave?.register({
  version: 1,
  capture: () => ({ state, mode, activeTentId: mode === "tent" ? activeTentId : null, position: player.position.toArray() }),
  restore: (saved) => {
    if (!["camp", "tent", "toilet"].includes(saved.mode) || saved.position?.length !== 3 || !saved.position.every(Number.isFinite)) throw new Error("Invalid camping save");
    (window as WindowWithGameHooks).LoaSave!.restoreObject(state, saved.state);
    activeTentId = saved.activeTentId;
    setMode(saved.mode);
    player.position.fromArray(saved.position);
    syncScene();
    updateHud();
  },
});

renderer.setAnimationLoop(() => {
  const deltaMs = Math.min(clock.getDelta() * 1000, 80);
  step(deltaMs);
  renderFrame();
});

function createCampground(): void {
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.32, 36),
    new THREE.MeshStandardMaterial({ color: "#83c968", roughness: 0.9 }),
  );
  ground.receiveShadow = true;
  ground.position.y = -0.18;
  campGroup.add(ground);

  addSummerDetails();
  addTownSquare();
  addQualityDecor();
  addTreeBorder();
  addPool();
  addStore();
  addToiletBuilding();
  addTents();
  addAnimalPen();
  addResidents();
  addCollectibles();
  addCampfire();
}

function addSkyDetails(): void {
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: "#fff9e8", transparent: true, opacity: 0.92 });
  const cloudPositions = [
    { x: -18, y: 12.5, z: -20, scale: 1.15 },
    { x: -4, y: 14.2, z: -23, scale: 0.9 },
    { x: 12, y: 13.6, z: -21, scale: 1.05 },
    { x: 20, y: 12.8, z: -10, scale: 0.78 },
  ];
  cloudPositions.forEach((position, index) => {
    const cloud = new THREE.Group();
    [
      [-0.62, 0, 0],
      [0, 0.1, 0],
      [0.58, 0, 0.02],
      [0.12, -0.12, 0.12],
    ].forEach(([x, y, z], partIndex) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.7 - partIndex * 0.06, 14, 10), cloudMaterial);
      puff.scale.set(1.25, 0.42, 0.6);
      puff.position.set(x, y, z);
      cloud.add(puff);
    });
    cloud.position.set(position.x, position.y, position.z);
    cloud.scale.setScalar(position.scale);
    cloud.userData.baseX = position.x;
    cloud.userData.baseY = position.y;
    cloud.userData.drift = index * 1.3;
    cloudMeshes.push(cloud);
    scene.add(cloud);
  });
}

function addTownSquare(): void {
  const plaza = new THREE.Group();
  plaza.name = "TownSquare";

  const plazaFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(5.15, 5.15, 0.16, 36),
    new THREE.MeshStandardMaterial({ color: "#e8d39b", roughness: 0.86 }),
  );
  plazaFloor.position.set(0, 0.03, 2.6);
  plazaFloor.receiveShadow = true;
  plaza.add(plazaFloor);

  const paths = [
    { x: 0, z: -5.0, w: 2.1, d: 12.2 },
    { x: -7.7, z: 2.3, w: 10.6, d: 1.65 },
    { x: 8.0, z: 2.3, w: 9.8, d: 1.65 },
    { x: 0, z: 9.5, w: 2.1, d: 7.0 },
  ];
  paths.forEach((path) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(path.w, 0.08, path.d), new THREE.MeshStandardMaterial({ color: "#d9bd7d", roughness: 0.9 }));
    mesh.position.set(path.x, 0.04, path.z);
    mesh.receiveShadow = true;
    plaza.add(mesh);
  });

  const board = new THREE.Group();
  board.position.set(-3.6, 0, 4.5);
  const boardBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.0, 0.16), new THREE.MeshStandardMaterial({ color: "#b8783f" }));
  boardBody.position.y = 0.9;
  boardBody.castShadow = true;
  markClickable(boardBody, { kind: "noticeBoard" });
  board.add(boardBody);
  const boardPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), new THREE.MeshStandardMaterial({ color: "#7a4a28" }));
  boardPost.position.y = 0.45;
  board.add(boardPost);
  const boardSign = createTextSprite("게시판", "#5b321a", 0.45);
  boardSign.position.set(0, 1.55, 0);
  board.add(boardSign);
  plaza.add(board);

  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.28, 24),
    new THREE.MeshStandardMaterial({ color: "#c8d7dd", roughness: 0.55 }),
  );
  fountain.position.set(0.4, 0.18, 3.2);
  fountain.castShadow = true;
  plaza.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 18, 10),
    new THREE.MeshPhysicalMaterial({ color: "#81d4fa", transparent: true, opacity: 0.76, roughness: 0.22 }),
  );
  fountainWater.scale.y = 0.35;
  fountainWater.position.set(0.4, 0.5, 3.2);
  fountainWater.userData.baseY = fountainWater.position.y;
  waterSurfaces.push(fountainWater);
  plaza.add(fountainWater);

  const townSign = createTextSprite("솔바람 캠핑 타운", "#2d4a25", 0.82);
  townSign.position.set(0.2, 1.15, 6.7);
  plaza.add(townSign);

  campGroup.add(plaza);

  const cottages = [
    { x: 10.5, z: -10.3, color: "#ffd7ba", label: "하나네" },
    { x: 13.2, z: -6.0, color: "#c9f2d1", label: "준네" },
    { x: 12.1, z: 6.6, color: "#d8c7ff", label: "미나네" },
  ];
  cottages.forEach((cottage) => {
    const mesh = createCottage(cottage.color, cottage.label);
    mesh.position.set(cottage.x, 0, cottage.z);
    campGroup.add(mesh);
  });
}

function addQualityDecor(): void {
  const benches = [
    { x: -2.7, z: 0.2, rotation: Math.PI * 0.5, color: "#7d5435" },
    { x: 3.5, z: 4.5, rotation: -Math.PI * 0.5, color: "#8e5f3d" },
    { x: 6.7, z: -7.4, rotation: -0.35, color: "#6f6a46" },
    { x: -8.8, z: -8.6, rotation: 0.35, color: "#82624c" },
  ];
  benches.forEach((benchData) => {
    const bench = createBench(benchData.color);
    bench.position.set(benchData.x, 0, benchData.z);
    bench.rotation.y = benchData.rotation;
    campGroup.add(bench);
  });

  const lampPositions = [
    { x: -4.6, z: 0.2 },
    { x: 4.8, z: 0.4 },
    { x: -4.8, z: 5.7 },
    { x: 5.1, z: 5.2 },
    { x: -7.6, z: -10.2 },
    { x: 7.7, z: -10.4 },
  ];
  lampPositions.forEach((position) => {
    const lamp = createLampPost();
    lamp.position.set(position.x, 0, position.z);
    campGroup.add(lamp);
  });

  [
    { x: -5.2, z: 5.7 },
    { x: 5.3, z: 5.5 },
    { x: -13.6, z: -8.8 },
    { x: -7.0, z: -12.9 },
    { x: 10.6, z: -8.2 },
    { x: 12.8, z: 5.1 },
  ].forEach((position, index) => {
    addFlowerCluster(position.x, position.z, index % 2 === 0 ? ["#ff6f91", "#ffd166", "#ffffff"] : ["#7bdff2", "#f7aef8", "#fce38a"]);
  });

  addStonePath([
    { x: -2.4, z: 2.8 },
    { x: -4.5, z: 1.0 },
    { x: -6.6, z: -2.1 },
    { x: -9.0, z: -5.5 },
    { x: -11.7, z: -8.5 },
  ]);
  addStonePath([
    { x: 2.2, z: 3.0 },
    { x: 4.8, z: 2.0 },
    { x: 7.8, z: 0.6 },
    { x: 10.6, z: -2.6 },
  ]);

  const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 1.55), new THREE.MeshStandardMaterial({ color: "#f88379", roughness: 0.95 }));
  blanket.position.set(8.4, 0.09, -1.0);
  blanket.rotation.y = -0.24;
  blanket.receiveShadow = true;
  campGroup.add(blanket);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.46), new THREE.MeshStandardMaterial({ color: "#c08b4f", roughness: 0.8 }));
  basket.position.set(8.25, 0.35, -1.05);
  basket.castShadow = true;
  campGroup.add(basket);

  addPennantLine(-7.0, -9.2, 5.2, 0.0);
  addPennantLine(3.4, -9.7, 4.6, 0.0);
}

function createBench(color: string): THREE.Group {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const metal = new THREE.MeshStandardMaterial({ color: "#41505b", roughness: 0.6, metalness: 0.2 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 0.44), wood);
  seat.position.y = 0.48;
  seat.castShadow = true;
  bench.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 0.36), wood);
  back.position.set(0, 0.86, -0.32);
  back.rotation.x = -0.18;
  back.castShadow = true;
  bench.add(back);
  [-0.55, 0.55].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), metal);
    leg.position.set(x, 0.24, 0.12);
    leg.castShadow = true;
    bench.add(leg);
  });
  return bench;
}

function createLampPost(): THREE.Group {
  const lamp = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({ color: "#3f4a55", roughness: 0.62, metalness: 0.15 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.65, 12), poleMaterial);
  pole.position.y = 0.82;
  pole.castShadow = true;
  lamp.add(pole);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 6), new THREE.MeshStandardMaterial({ color: "#52606d", roughness: 0.68 }));
  cap.position.y = 1.78;
  cap.castShadow = true;
  lamp.add(cap);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 10),
    new THREE.MeshBasicMaterial({ color: "#fff2a8", transparent: true, opacity: 0.84 }),
  );
  glow.position.y = 1.58;
  lamp.add(glow);
  const light = new THREE.PointLight("#ffd77a", 0.15, 7, 2.1);
  light.position.y = 1.58;
  lampLights.push(light);
  lamp.add(light);
  return lamp;
}

function addFlowerCluster(x: number, z: number, colors: string[]): void {
  const cluster = new THREE.Group();
  cluster.position.set(x, 0, z);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: "#3f8f45", roughness: 0.8 });
  colors.forEach((color, index) => {
    const angle = (index / colors.length) * Math.PI * 2;
    const radius = 0.22 + (index % 2) * 0.14;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.28, 6), stemMaterial);
    stem.position.set(Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius);
    cluster.add(stem);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 9, 7), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    bloom.position.set(stem.position.x, 0.34, stem.position.z);
    bloom.castShadow = true;
    cluster.add(bloom);
  });
  campGroup.add(cluster);
}

function addStonePath(points: Vec2[]): void {
  points.forEach((point, index) => {
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42 + (index % 2) * 0.05, 0.46, 0.07, 14),
      new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? "#c9bea6" : "#bdb39e", roughness: 0.92 }),
    );
    stone.position.set(point.x, 0.08, point.z);
    stone.rotation.y = index * 0.35;
    stone.receiveShadow = true;
    campGroup.add(stone);
  });
}

function addPennantLine(x: number, z: number, length: number, rotation: number): void {
  const line = new THREE.Group();
  line.position.set(x, 0, z);
  line.rotation.y = rotation;
  const postMaterial = new THREE.MeshStandardMaterial({ color: "#7b4a24", roughness: 0.76 });
  [-length / 2, length / 2].forEach((postX) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.85, 8), postMaterial);
    post.position.set(postX, 0.92, 0);
    post.castShadow = true;
    line.add(post);
  });
  const string = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.035), new THREE.MeshStandardMaterial({ color: "#f9f2d1", roughness: 0.7 }));
  string.position.y = 1.65;
  line.add(string);
  const flagColors = ["#ff6b6b", "#4dabf7", "#ffd43b", "#6bc4a6", "#b388eb"];
  for (let i = 0; i < 7; i += 1) {
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.38),
      new THREE.MeshStandardMaterial({ color: flagColors[i % flagColors.length], side: THREE.DoubleSide, roughness: 0.7 }),
    );
    flag.position.set(-length / 2 + 0.62 + i * 0.62, 1.43, 0.02);
    flag.rotation.z = Math.sin(i) * 0.12;
    line.add(flag);
  }
  campGroup.add(line);
}

function addSummerDetails(): void {
  const flowerColors = ["#ffd43b", "#ff6b8b", "#7bdff2", "#ffffff"];
  for (let i = 0; i < 90; i += 1) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.8 }),
    );
    flower.position.set(THREE.MathUtils.randFloat(-16, 16), 0.04, THREE.MathUtils.randFloat(-16, 16));
    if (flower.position.distanceTo(new THREE.Vector3(-13, 0, -12)) < 5) continue;
    flower.castShadow = true;
    campGroup.add(flower);
  }

  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#fff17a" }),
  );
  sunDisk.position.set(-14, 17, -17);
  campGroup.add(sunDisk);
}

function addTreeBorder(): void {
  const positions: Vec2[] = [];
  for (let x = -17; x <= 17; x += 2.2) {
    positions.push({ x, z: -17.4 }, { x, z: 17.4 });
  }
  for (let z = -15; z <= 15; z += 2.2) {
    positions.push({ x: -17.4, z }, { x: 17.4, z });
  }

  positions.forEach((position, index) => {
    const tree = createTree(index % 3);
    tree.position.set(position.x, 0, position.z);
    campGroup.add(tree);
  });
}

function addPool(): void {
  const poolBase = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.3, 5.2),
    new THREE.MeshStandardMaterial({ color: "#e5f7ff", roughness: 0.55 }),
  );
  poolBase.position.set(-12.5, 0.05, -12.2);
  poolBase.receiveShadow = true;
  campGroup.add(poolBase);

  const water = new THREE.Mesh(
    new THREE.BoxGeometry(6.3, 0.22, 4.3),
    new THREE.MeshPhysicalMaterial({
      color: "#32c7f4",
      transparent: true,
      opacity: 0.72,
      roughness: 0.18,
      metalness: 0,
      transmission: 0.15,
    }),
  );
  water.position.set(-12.5, 0.28, -12.2);
  water.userData.baseY = water.position.y;
  waterSurfaces.push(water);
  markClickable(water, { kind: "pool" });
  campGroup.add(water);

  const poolLabel = createTextSprite("허리 높이 수영장", "#0a5f80", 0.95);
  poolLabel.position.set(-12.5, 0.9, -9.2);
  campGroup.add(poolLabel);
}

function addStore(): void {
  const store = new THREE.Group();
  store.position.set(-4.4, 0, -12.2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 5), new THREE.MeshStandardMaterial({ color: "#f6d6a2" }));
  floor.receiveShadow = true;
  floor.position.y = 0.02;
  store.add(floor);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 0.22), new THREE.MeshStandardMaterial({ color: "#ffd99a" }));
  backWall.position.set(0, 1.2, -2.4);
  backWall.castShadow = true;
  store.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 5), new THREE.MeshStandardMaterial({ color: "#ffe5b6" }));
  sideWall.position.set(-3, 1.2, 0);
  sideWall.castShadow = true;
  store.add(sideWall);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 1.2), new THREE.MeshStandardMaterial({ color: "#ff6b5a" }));
  awning.position.set(0, 2.55, 1.3);
  awning.castShadow = true;
  store.add(awning);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: "#915b33" }));
  counter.position.set(0.2, 0.5, 0.7);
  counter.castShadow = true;
  store.add(counter);

  const owner = createPerson("#f0ba83", "#5e3d2f", "사장님", {
    hairColor: "#6b4b34",
    accentColor: "#ffd166",
    pantsColor: "#4a3428",
    hairVariant: "cap",
  });
  owner.scale.setScalar(0.95);
  owner.position.set(0.2, 0.18, -0.3);
  markClickable(owner, { kind: "owner" });
  store.add(owner);

  const freezer = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: "#d7f6ff" }));
  freezer.position.set(-1.8, 0.55, 1.6);
  freezer.castShadow = true;
  markClickable(freezer, { kind: "freezer" });
  store.add(freezer);
  const freezerTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.08, 0.95),
    new THREE.MeshStandardMaterial({ color: "#86ddff", transparent: true, opacity: 0.65 }),
  );
  freezerTop.position.set(-1.8, 1.03, 1.6);
  markClickable(freezerTop, { kind: "freezer" });
  store.add(freezerTop);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.25, 0.52), new THREE.MeshStandardMaterial({ color: "#b47a45" }));
  shelf.position.set(2, 0.7, 1.7);
  shelf.castShadow = true;
  markClickable(shelf, { kind: "shelf" });
  store.add(shelf);
  ["#ffd43b", "#ff9f1c", "#4dabf7"].forEach((color, index) => {
    const snack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.12), new THREE.MeshStandardMaterial({ color }));
    snack.position.set(1.55 + index * 0.42, 1.2, 2.02);
    markClickable(snack, { kind: "shelf" });
    store.add(snack);
  });

  const sign = createTextSprite("매점", "#5d2f12", 1.25);
  sign.position.set(0, 2.95, 0.8);
  store.add(sign);

  campGroup.add(store);
}

function addToiletBuilding(): void {
  const building = new THREE.Group();
  building.position.set(3.7, 0, -12.3);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.1, 2.2, 4.8), new THREE.MeshStandardMaterial({ color: "#e8f0f7" }));
  body.position.y = 1.1;
  body.castShadow = true;
  body.receiveShadow = true;
  markClickable(body, { kind: "toiletBuilding" });
  building.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.35, 5.1), new THREE.MeshStandardMaterial({ color: "#59758f" }));
  roof.position.y = 2.4;
  roof.castShadow = true;
  building.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.35, 0.08), new THREE.MeshStandardMaterial({ color: "#7aa2c7" }));
  door.position.set(0, 0.75, 2.45);
  markClickable(door, { kind: "toiletBuilding" });
  building.add(door);
  const sign = createTextSprite("화장실", "#26394a", 1.0);
  sign.position.set(0, 2.85, 2.65);
  building.add(sign);
  campGroup.add(building);
}

function addTents(): void {
  state.tents.forEach((tent, index) => {
    const tentGroup = createTentMesh(index);
    tentGroup.position.set(tent.position.x, 0, tent.position.z);
    markClickable(tentGroup, { kind: "tent", id: tent.id });
    const label = createTextSprite(tent.label, "#233015", 0.72);
    label.position.set(0, 1.65, 0);
    tentGroup.add(label);
    tentNameSprites.set(tent.id, label);
    campGroup.add(tentGroup);
  });
}

function addAnimalPen(): void {
  const pen = new THREE.Group();
  pen.position.set(0, 0, 12.5);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(21, 0.18, 7), new THREE.MeshStandardMaterial({ color: "#d7b887" }));
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  pen.add(floor);
  for (let x = -10; x <= 10; x += 1.2) {
    addFencePost(pen, x, -3.5);
    addFencePost(pen, x, 3.5);
  }
  for (let z = -3.5; z <= 3.5; z += 1.2) {
    addFencePost(pen, -10.5, z);
    addFencePost(pen, 10.5, z);
  }
  const label = createTextSprite("동물우리", "#5b3618", 0.9);
  label.position.set(0, 1.5, -3.8);
  pen.add(label);
  campGroup.add(pen);

  state.animals.forEach((animal) => {
    const mesh = createAnimalMesh(animal);
    mesh.position.set(animal.position.x, 0, animal.position.z);
    markClickable(mesh, { kind: "animal", id: animal.id });
    animalMeshes.set(animal.id, mesh);
    campGroup.add(mesh);
  });
}

function addFencePost(parent: THREE.Group, x: number, z: number): void {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.16), new THREE.MeshStandardMaterial({ color: "#8b5a2b" }));
  post.position.set(x, 0.38, z);
  post.castShadow = true;
  parent.add(post);
}

function addResidents(): void {
  state.residents.forEach((resident) => {
    const mesh = createPerson(
      resident.gender === "girl" ? "#ffd2de" : "#b7d7ff",
      resident.gender === "girl" ? "#d14b7a" : "#2f5fa8",
      resident.name,
      getResidentPersonStyle(resident),
    );
    mesh.position.set(resident.position.x, 0, resident.position.z);
    markClickable(mesh, { kind: "resident", id: resident.id });
    addClickBubble(mesh, { kind: "resident", id: resident.id }, 0.8, 1.9);
    residentMeshes.set(resident.id, mesh);
    campGroup.add(mesh);
  });
}

function addCollectibles(): void {
  state.collectibles.forEach((item) => {
    const mesh = createCollectibleMesh(item);
    mesh.position.set(item.position.x, 0, item.position.z);
    markClickable(mesh, { kind: "collectible", id: item.id });
    addClickBubble(mesh, { kind: "collectible", id: item.id }, 0.46, 0.7);
    collectibleMeshes.set(item.id, mesh);
    campGroup.add(mesh);
  });
}

function createCottage(color: string, label: string): THREE.Group {
  const cottage = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.65, 2.0), new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
  body.position.y = 0.85;
  body.castShadow = true;
  body.receiveShadow = true;
  cottage.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.0, 4), new THREE.MeshStandardMaterial({ color: "#8b5d42", roughness: 0.75 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.05;
  roof.castShadow = true;
  cottage.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.58, 0.28), new THREE.MeshStandardMaterial({ color: "#9a5842", roughness: 0.7 }));
  chimney.position.set(-0.58, 2.32, -0.3);
  chimney.castShadow = true;
  cottage.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.88, 0.08), new THREE.MeshStandardMaterial({ color: "#5f422f" }));
  door.position.set(0, 0.52, 1.04);
  cottage.add(door);
  [-0.68, 0.68].forEach((x) => {
    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), new THREE.MeshStandardMaterial({ color: "#fff3bf", emissive: "#ffe08a", emissiveIntensity: 0.12 }));
    windowMesh.position.set(x, 1.1, 1.05);
    cottage.add(windowMesh);
    const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: "#7d5435", roughness: 0.8 }));
    flowerBox.position.set(x, 0.78, 1.12);
    cottage.add(flowerBox);
    ["#ff6f91", "#ffd166", "#7bdff2"].forEach((flowerColor, index) => {
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.75 }));
      bloom.position.set(x - 0.18 + index * 0.18, 0.9, 1.2);
      cottage.add(bloom);
    });
  });
  const doorstep = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.48), new THREE.MeshStandardMaterial({ color: "#d9bd7d", roughness: 0.9 }));
  doorstep.position.set(0, 0.07, 1.32);
  doorstep.receiveShadow = true;
  cottage.add(doorstep);
  const labelSprite = createTextSprite(label, "#3f2b1d", 0.42);
  labelSprite.position.set(0, 2.75, 0);
  cottage.add(labelSprite);
  return cottage;
}

function createCollectibleMesh(item: TownCollectible): THREE.Group {
  const group = new THREE.Group();
  if (item.kind === "clover") {
    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#3fbf5b", roughness: 0.74 });
    [
      [0, 0.08],
      [0.09, 0],
      [0, -0.08],
      [-0.09, 0],
    ].forEach(([x, z]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), leafMaterial);
      leaf.scale.set(1.2, 0.18, 0.85);
      leaf.position.set(x, 0.14, z);
      leaf.castShadow = true;
      group.add(leaf);
    });
  } else if (item.kind === "shell") {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8), new THREE.MeshStandardMaterial({ color: "#ffe8c2", roughness: 0.7 }));
    shell.scale.set(1.25, 0.35, 0.75);
    shell.position.y = 0.16;
    shell.castShadow = true;
    group.add(shell);
  } else {
    const starMaterial = new THREE.MeshStandardMaterial({ color: "#ffd43b", roughness: 0.45, emissive: "#6d4d00", emissiveIntensity: 0.18 });
    for (let i = 0; i < 5; i += 1) {
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), starMaterial);
      ray.position.y = 0.2;
      ray.rotation.z = (i / 5) * Math.PI * 2;
      ray.rotation.x = Math.PI / 2;
      group.add(ray);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), starMaterial);
    core.position.y = 0.2;
    group.add(core);
  }
  const label = createTextSprite(COLLECTIBLE_LABELS[item.kind], "#315138", 0.32);
  label.position.set(0, 0.65, 0);
  group.add(label);
  return group;
}

function addCampfire(): void {
  const fireGroup = new THREE.Group();
  fireGroup.name = "Campfire";
  fireGroup.position.set(9.5, 0, -5.5);
  for (let i = 0; i < 6; i += 1) {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: "#78756c" }));
    const angle = (i / 6) * Math.PI * 2;
    stone.position.set(Math.cos(angle) * 0.75, 0.15, Math.sin(angle) * 0.75);
    stone.castShadow = true;
    fireGroup.add(stone);
  }
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), new THREE.MeshStandardMaterial({ color: "#6b3f20" }));
  logA.rotation.z = Math.PI / 2;
  logA.position.y = 0.18;
  fireGroup.add(logA);
  const logB = logA.clone();
  logB.rotation.y = Math.PI / 2;
  fireGroup.add(logB);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 16), new THREE.MeshBasicMaterial({ color: "#ff7a25" }));
  flame.name = "Flame";
  flame.position.y = 0.72;
  fireGroup.add(flame);
  campGroup.add(fireGroup);
}

function createTentInterior(): void {
  tentInteriorGroup.visible = false;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 6), new THREE.MeshStandardMaterial({ color: "#d8b891" }));
  floor.name = "TentFloor";
  floor.position.y = 0;
  floor.receiveShadow = true;
  tentFloor = floor;
  tentInteriorGroup.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(10.4, 2.6, 0.22), new THREE.MeshStandardMaterial({ color: "#f0c05d" }));
  back.position.set(0, 1.3, -3.1);
  tentInteriorGroup.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 6), new THREE.MeshStandardMaterial({ color: "#f5d37c" }));
  left.position.set(-5.1, 1.1, 0);
  tentInteriorGroup.add(left);
  const right = left.clone();
  right.position.x = 5.1;
  tentInteriorGroup.add(right);
}

function createToiletInterior(): void {
  toiletInteriorGroup.visible = false;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 7), new THREE.MeshStandardMaterial({ color: "#dfeaf3" }));
  floor.receiveShadow = true;
  toiletInteriorGroup.add(floor);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 0.24), new THREE.MeshStandardMaterial({ color: "#f8fbff" }));
  backWall.position.set(0, 1.25, -3.5);
  toiletInteriorGroup.add(backWall);
  const sink = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.75), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
  sink.position.set(-4.2, 0.65, -2.75);
  markClickable(sink, { kind: "sink" });
  toiletInteriorGroup.add(sink);
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12), new THREE.MeshStandardMaterial({ color: "#8fa5b5", metalness: 0.5 }));
  faucet.position.set(-4.2, 1.08, -2.85);
  faucet.rotation.x = Math.PI / 2;
  toiletInteriorGroup.add(faucet);

  for (let i = 0; i < 3; i += 1) {
    const x = -1.8 + i * 2.25;
    const stall = new THREE.Group();
    stall.position.set(x, 0, -1.15);
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.65, 2.1), new THREE.MeshStandardMaterial({ color: "#b7c9d9" }));
    divider.position.set(-0.78, 0.85, 0);
    stall.add(divider);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.45, 0.08), new THREE.MeshStandardMaterial({ color: "#8fb6d7" }));
    door.position.set(0, 0.78, 1.02);
    markClickable(door, { kind: "toiletStall", id: `stall-${i + 1}` });
    stall.add(door);
    const toilet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.35, 18), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
    toilet.position.set(0, 0.35, -0.35);
    markClickable(toilet, { kind: "toiletStall", id: `stall-${i + 1}` });
    stall.add(toilet);
    toiletInteriorGroup.add(stall);
  }
}

function createTree(variant: number): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 10), new THREE.MeshStandardMaterial({ color: "#7b4a24" }));
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  tree.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.78 + variant * 0.08, 1.65 + variant * 0.08, 12),
    new THREE.MeshStandardMaterial({ color: variant === 1 ? "#3d9942" : "#2f8542", roughness: 0.75 }),
  );
  leaves.position.y = 1.55;
  leaves.castShadow = true;
  tree.add(leaves);
  return tree;
}

function createTentMesh(index: number): THREE.Group {
  const colors = ["#ff7b54", "#ffc857", "#6bc4a6", "#5aa9e6", "#b388eb"];
  const group = new THREE.Group();
  const fabric = new THREE.Mesh(
    new THREE.ConeGeometry(1.55, 1.75, 4),
    new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.72 }),
  );
  fabric.rotation.y = Math.PI / 4;
  fabric.position.y = 0.88;
  fabric.castShadow = true;
  fabric.receiveShadow = true;
  group.add(fabric);

  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.82), new THREE.MeshStandardMaterial({ color: "#38271f", side: THREE.DoubleSide }));
  door.position.set(0, 0.58, 1.12);
  door.rotation.x = 0.02;
  group.add(door);
  return group;
}

function createAnimalMesh(animal: Animal): THREE.Group {
  if (animal.species === "rabbit") return createRabbit(animal.label);
  if (animal.species === "duck") return createDuck(animal.label);
  return createPig(animal.label);
}

function createPig(label: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#ff9eb5", roughness: 0.72 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), mat);
  body.scale.set(1.25, 0.78, 0.85);
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), mat);
  head.position.set(0, 0.62, 0.48);
  head.castShadow = true;
  group.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), new THREE.MeshStandardMaterial({ color: "#f57f9a" }));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.58, 0.76);
  group.add(snout);
  addTinyEyes(group, 0.09, 0.68, 0.74);
  addAnimalLabel(group, label);
  return group;
}

function createRabbit(label: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#fff6ef", roughness: 0.82 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), mat);
  body.scale.set(1, 1.18, 0.85);
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), mat);
  head.position.set(0, 0.82, 0.28);
  head.castShadow = true;
  group.add(head);
  [-0.11, 0.11].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 5, 8), mat);
    ear.position.set(x, 1.18, 0.27);
    ear.rotation.x = -0.2;
    ear.castShadow = true;
    group.add(ear);
  });
  addTinyEyes(group, 0.07, 0.88, 0.52);
  addAnimalLabel(group, label);
  return group;
}

function createDuck(label: string): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#ffe15a", roughness: 0.75 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), bodyMat);
  body.scale.set(1.1, 0.85, 0.9);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), bodyMat);
  head.position.set(0, 0.72, 0.34);
  head.castShadow = true;
  group.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), new THREE.MeshStandardMaterial({ color: "#ff9d2e" }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.7, 0.58);
  group.add(beak);
  addTinyEyes(group, 0.055, 0.76, 0.52);
  addAnimalLabel(group, label);
  return group;
}

function addTinyEyes(group: THREE.Group, spacing: number, y: number, z: number): void {
  [-spacing, spacing].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#1a1a1a" }));
    eye.position.set(x, y, z);
    group.add(eye);
  });
}

function addAnimalLabel(group: THREE.Group, label: string): void {
  const sprite = createTextSprite(label, "#35251d", 0.45);
  sprite.position.set(0, 1.35, 0);
  group.add(sprite);
}

function getResidentPersonStyle(resident: Resident): PersonStyle {
  const styles: Record<string, PersonStyle> = {
    "resident-1": { hairColor: "#6b3f2a", accentColor: "#ffd166", pantsColor: "#7b2cbf", hairVariant: "buns" },
    "resident-2": { hairColor: "#3f2a56", accentColor: "#ffb3c1", pantsColor: "#a23e72", hairVariant: "bob" },
    "resident-3": { hairColor: "#2f3e46", accentColor: "#7bdff2", pantsColor: "#355070", hairVariant: "sidePart" },
    "resident-4": { hairColor: "#5c4033", accentColor: "#b7e4c7", pantsColor: "#2d6a4f", hairVariant: "tuft" },
    "resident-5": { hairColor: "#1f2a44", accentColor: "#f4a261", pantsColor: "#264653", hairVariant: "cap" },
    "resident-6": { hairColor: "#7a4a24", accentColor: "#bde0fe", pantsColor: "#3a506b", hairVariant: "sidePart" },
  };
  return styles[resident.id] ?? {
    hairColor: resident.gender === "girl" ? "#4a2f45" : "#3d2f2a",
    accentColor: resident.gender === "girl" ? "#ffcad4" : "#90dbf4",
    pantsColor: "#38435a",
    hairVariant: resident.gender === "girl" ? "bob" : "tuft",
  };
}

function createPerson(skinColor: string, shirtColor: string, label: string, style: PersonStyle = {}): THREE.Group {
  const group = new THREE.Group();
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: style.pantsColor ?? "#303846", roughness: 0.78 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: style.shoeColor ?? "#263238", roughness: 0.72 });
  [-0.11, 0.11].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 5, 9), pantsMaterial);
    leg.position.set(x, 0.27, 0);
    leg.castShadow = true;
    group.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.24), shoeMaterial);
    shoe.position.set(x, 0.08, 0.07);
    shoe.castShadow = true;
    group.add(shoe);
  });
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: style.accentColor ?? "#ffe08a", roughness: 0.74 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.42, 8, 18), shirtMaterial);
  body.position.y = 0.68;
  body.scale.set(1.05, 1, 0.9);
  body.castShadow = true;
  group.add(body);
  const frontPatch = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), accentMaterial);
  frontPatch.scale.set(1.05, 0.42, 0.26);
  frontPatch.position.set(0, 0.74, 0.25);
  group.add(frontPatch);
  [-0.34, 0.34].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.38, 5, 9), shirtMaterial);
    arm.position.set(x, 0.7, 0.03);
    arm.rotation.z = x > 0 ? -0.34 : 0.34;
    arm.castShadow = true;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), skinMaterial);
    hand.position.set(x * 1.03, 0.48, 0.04);
    hand.castShadow = true;
    group.add(hand);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 18), skinMaterial);
  head.position.y = 1.16;
  head.scale.set(0.98, 1.05, 0.94);
  head.castShadow = true;
  group.add(head);
  const hairMaterial = new THREE.MeshStandardMaterial({ color: style.hairColor ?? "#33231f", roughness: 0.82 });
  addPersonHair(group, hairMaterial, style.hairVariant ?? "tuft", accentMaterial);
  addPersonFace(group, style);
  const labelSprite = createTextSprite(label, "#1f2b35", 0.45);
  labelSprite.position.set(0, 1.85, 0);
  group.add(labelSprite);
  group.scale.setScalar(1.14);
  return group;
}

function addPersonHair(group: THREE.Group, hairMaterial: THREE.Material, variant: PersonHairVariant, accentMaterial: THREE.Material): void {
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.405, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), hairMaterial);
  hairCap.position.set(0, 1.31, -0.01);
  hairCap.scale.set(1.04, 0.96, 0.98);
  group.add(hairCap);

  const bangPositions =
    variant === "sidePart"
      ? [
          [-0.16, 1.35, 0.22, 1.25],
          [-0.03, 1.37, 0.24, 1.0],
          [0.12, 1.34, 0.21, 0.88],
        ]
      : [
          [-0.13, 1.34, 0.22, 1.0],
          [0, 1.36, 0.24, 1.08],
          [0.13, 1.34, 0.22, 1.0],
        ];
  bangPositions.forEach(([x, y, z, scale]) => {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.098, 10, 8), hairMaterial);
    bang.scale.set(scale, 0.82, 0.74);
    bang.position.set(x, y, z + 0.03);
    group.add(bang);
  });

  if (variant === "buns") {
    [-0.33, 0.33].forEach((x) => {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), hairMaterial);
      bun.position.set(x * 1.08, 1.24, -0.02);
      bun.castShadow = true;
      group.add(bun);
      const ribbon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), accentMaterial);
      ribbon.position.set(x * 1.08, 1.19, 0.12);
      group.add(ribbon);
    });
  } else if (variant === "bob") {
    [-0.28, 0.28].forEach((x) => {
      const sideHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 5, 9), hairMaterial);
      sideHair.position.set(x * 1.05, 1.08, 0.03);
      sideHair.rotation.z = x > 0 ? -0.12 : 0.12;
      sideHair.castShadow = true;
      group.add(sideHair);
    });
  } else if (variant === "cap") {
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.39, 0.13, 20), accentMaterial);
    capTop.position.set(0, 1.52, 0.02);
    capTop.castShadow = true;
    group.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.055, 0.2), accentMaterial);
    brim.position.set(0, 1.47, 0.32);
    brim.castShadow = true;
    group.add(brim);
  } else if (variant === "tuft") {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), hairMaterial);
    tuft.position.set(0.08, 1.59, 0.02);
    tuft.rotation.z = -0.32;
    tuft.castShadow = true;
    group.add(tuft);
  }
}

function addPersonFace(group: THREE.Group, style: PersonStyle): void {
  const cheekColor = style.cheekColor ?? "#ff9eb5";
  [-0.11, 0.11].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.053, 12, 8), new THREE.MeshBasicMaterial({ color: "#1f2428" }));
    eye.scale.set(0.78, 1.18, 0.36);
    eye.position.set(x, 1.19, 0.36);
    group.add(eye);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    highlight.position.set(x - 0.014, 1.215, 0.39);
    group.add(highlight);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), new THREE.MeshBasicMaterial({ color: cheekColor, transparent: true, opacity: 0.72 }));
    cheek.scale.set(1.25, 0.72, 0.28);
    cheek.position.set(x * 1.55, 1.105, 0.345);
    group.add(cheek);
  });
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.014), new THREE.MeshBasicMaterial({ color: "#7a3a36" }));
  smile.position.set(0, 1.055, 0.38);
  group.add(smile);
  const faceSprite = createPersonFaceSprite(cheekColor);
  faceSprite.position.set(0, 1.3, 0.14);
  group.add(faceSprite);
}

function createPersonFaceSprite(cheekColor: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  canvas.width = 128;
  canvas.height = 96;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#1f2428";
  context.beginPath();
  context.ellipse(43, 36, 8, 13, 0, 0, Math.PI * 2);
  context.ellipse(85, 36, 8, 13, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(40, 31, 2.4, 0, Math.PI * 2);
  context.arc(82, 31, 2.4, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.74;
  context.fillStyle = cheekColor;
  context.beginPath();
  context.ellipse(28, 54, 9, 5, 0, 0, Math.PI * 2);
  context.ellipse(100, 54, 9, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = "#7a3a36";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(56, 61);
  context.quadraticCurveTo(64, 68, 72, 61);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 20;
  sprite.scale.set(0.72, 0.54, 1);
  return sprite;
}

function createTextSprite(text: string, color = "#1f2933", scale = 0.75): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  canvas.width = 512;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.8 * scale, 0.7 * scale, 1);
  return sprite;
}

function createFurnitureMesh(item: PlacedFurniture): THREE.Object3D {
  const spec = FURNITURE_SPECS[item.type];
  const group = new THREE.Group();
  const width = item.width * 0.82;
  const depth = item.height * 0.82;
  const color: Record<FurnitureType, string> = {
    sleepingBag: "#4dabf7",
    pillow: "#fff5f5",
    smallTable: "#a56b3f",
    lamp: "#ffd43b",
    bag: "#5c677d",
  };
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, item.type === "lamp" ? 0.85 : 0.22, depth),
    new THREE.MeshStandardMaterial({ color: color[item.type], roughness: 0.72 }),
  );
  base.position.y = item.type === "lamp" ? 0.45 : 0.16;
  base.castShadow = true;
  group.add(base);
  if (item.type === "lamp") {
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8), new THREE.MeshBasicMaterial({ color: "#fff4a3" }));
    shade.position.y = 1.0;
    group.add(shade);
  }
  const label = createTextSprite(spec.label, "#293241", 0.36);
  label.position.y = 0.8;
  group.add(label);
  return group;
}

function markClickable(object: THREE.Object3D, payload: ClickPayload): void {
  object.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      child.userData.click = payload;
      clickTargets.push(child);
    }
  });
}

function addClickBubble(parent: THREE.Object3D, payload: ClickPayload, radius: number, height: number): void {
  const bubble = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  bubble.position.y = height / 2;
  bubble.userData.click = payload;
  clickTargets.push(bubble);
  parent.add(bubble);
}

function createHud(): {
  root: HTMLDivElement;
  status: HTMLDivElement;
  quest: HTMLDivElement;
  prompt: HTMLDivElement;
  panel: HTMLDivElement;
  panelTitle: HTMLHeadingElement;
  panelBody: HTMLDivElement;
  tentButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  skewerButton: HTMLButtonElement;
} {
  const root = document.createElement("div");
  root.className = "hud";
  root.innerHTML = `
    <div class="status-strip" data-role="status"></div>
    <div class="quest-chip" data-role="quest"></div>
    <div class="top-actions">
      <button class="icon-button" data-role="tent" title="텐트 꾸미기">⛺</button>
      <button class="plain-button" data-role="exit">캠핑장</button>
    </div>
    <div class="prompt" data-role="prompt"></div>
    <div class="dpad" aria-label="화면 방향키">
      <button class="dpad-button dpad-up" data-move-key="arrowup" title="위">▲</button>
      <button class="dpad-button dpad-left" data-move-key="arrowleft" title="왼쪽">◀</button>
      <button class="dpad-button dpad-down" data-move-key="arrowdown" title="아래">▼</button>
      <button class="dpad-button dpad-right" data-move-key="arrowright" title="오른쪽">▶</button>
    </div>
    <div class="panel hidden" data-role="panel">
      <div class="panel-header">
        <h2 data-role="panel-title"></h2>
        <button class="icon-button" data-role="close" title="닫기">×</button>
      </div>
      <div data-role="panel-body"></div>
    </div>
    <button class="skewer hidden" data-role="skewer">마시멜로우꼬치</button>
  `;
  app.appendChild(root);

  const status = root.querySelector<HTMLDivElement>("[data-role='status']");
  const quest = root.querySelector<HTMLDivElement>("[data-role='quest']");
  const prompt = root.querySelector<HTMLDivElement>("[data-role='prompt']");
  const panel = root.querySelector<HTMLDivElement>("[data-role='panel']");
  const panelTitle = root.querySelector<HTMLHeadingElement>("[data-role='panel-title']");
  const panelBody = root.querySelector<HTMLDivElement>("[data-role='panel-body']");
  const tentButton = root.querySelector<HTMLButtonElement>("[data-role='tent']");
  const exitButton = root.querySelector<HTMLButtonElement>("[data-role='exit']");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-role='close']");
  const skewerButton = root.querySelector<HTMLButtonElement>("[data-role='skewer']");
  if (!status || !quest || !prompt || !panel || !panelTitle || !panelBody || !tentButton || !exitButton || !closeButton || !skewerButton) {
    throw new Error("HUD creation failed");
  }

  closeButton.addEventListener("click", closePanel);
  bindDirectionPad(root);
  tentButton.addEventListener("click", () => {
    if (mode !== "tent") {
      setMessage("텐트 안에서만 꾸미기 아이콘을 사용할 수 있어요.");
      return;
    }
    showFurniturePalette();
  });
  exitButton.addEventListener("click", () => setMode("camp"));
  skewerButton.addEventListener("click", () => {
    if (state.party.status === "called") {
      const result = startMarshmallowRoast(state);
      setMessage(result.message);
    } else if (state.party.status === "roasted") {
      const result = eatMarshmallow(state);
      setMessage(result.message);
    } else {
      setMessage("장작불 앞에서 조금만 기다려 주세요.");
    }
    updateHud();
  });

  return { root, status, quest, prompt, panel, panelTitle, panelBody, tentButton, exitButton, skewerButton };
}

function step(deltaMs: number): void {
  advanceSimulation(state, deltaMs);
  updatePlayer(deltaMs);
  updateResidents(deltaMs);
  updateAnimals(deltaMs);
  syncScene();
  updateHud();
}

function updatePlayer(deltaMs: number): void {
  if (playerSeated) {
    player.rotation.x = Math.sin(state.elapsedMs / 120) * 0.02;
    return;
  }
  const seconds = deltaMs / 1000;
  const direction = new THREE.Vector3();
  if (isInputPressed("w", "arrowup")) direction.z -= 1;
  if (isInputPressed("s", "arrowdown")) direction.z += 1;
  if (isInputPressed("a", "arrowleft")) direction.x -= 1;
  if (isInputPressed("d", "arrowright")) direction.x += 1;
  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = mode === "camp" ? 4.3 : 2.4;
    player.position.x += direction.x * speed * seconds;
    player.position.z += direction.z * speed * seconds;
    player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  if (mode === "camp") {
    player.position.x = THREE.MathUtils.clamp(player.position.x, -15.8, 15.8);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -15.8, 15.8);
  } else if (mode === "tent") {
    player.position.x = THREE.MathUtils.clamp(player.position.x, -4.5, 4.5);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -2.5, 2.5);
  } else {
    player.position.x = THREE.MathUtils.clamp(player.position.x, -4.8, 4.8);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -2.9, 2.9);
    if (state.elapsedMs > toiletSitUntilMs) {
      const nearToilet = [-1.8, 0.45, 2.7].some((x) => Math.abs(player.position.x - x) < 0.55 && player.position.z < -0.9);
      if (nearToilet && !playerSeated) {
        playerSeated = true;
        player.rotation.x = -0.35;
        setMessage("변기 가까이에 가서 앉았어요. Space를 누르면 일어나요.");
      }
    }
  }
}

function updateResidents(deltaMs: number): void {
  const seconds = deltaMs / 1000;
  state.residents.forEach((resident, index) => {
    const pos = resident.position;
    if (state.party.status !== "none" && state.party.status !== "eaten") {
      resident.zone = "party";
      resident.target = { x: 7.7 + (index % 3) * 1.2, z: -6.5 + Math.floor(index / 3) * 1.3 };
    } else if (distance(pos, resident.target) < 0.25) {
      const targets: Array<{ zone: Resident["zone"]; target: Vec2 }> = [
        { zone: "store", target: { x: -4 + Math.random() * 3, z: -10 + Math.random() * 2 } },
        { zone: "pool", target: { x: -13 + Math.random() * 3, z: -9 + Math.random() * 2 } },
        { zone: "toilet", target: { x: 4 + Math.random() * 2, z: -9 + Math.random() * 2 } },
        { zone: "camp", target: { x: -8 + Math.random() * 16, z: -2 + Math.random() * 10 } },
      ];
      const next = targets[(index + Math.floor(state.elapsedMs / 6000)) % targets.length];
      resident.zone = next.zone;
      resident.target = next.target;
    }
    moveToward(pos, resident.target, seconds * 1.1);
  });
}

function updateAnimals(deltaMs: number): void {
  if (!state.animalsReleased) return;
  const seconds = deltaMs / 1000;
  state.animals.forEach((animal, index) => {
    if (animal.activity === "petted" || animal.activity === "eating") return;
    const orbit = state.elapsedMs / 2200 + index;
    const target = {
      x: THREE.MathUtils.clamp(animal.homePosition.x * 0.45 + Math.sin(orbit) * 8, -13, 13),
      z: THREE.MathUtils.clamp(animal.homePosition.z * 0.35 + Math.cos(orbit * 0.7) * 7, -2, 15),
    };
    moveToward(animal.position, target, seconds * (animal.species === "rabbit" ? 1.6 : 0.95));
  });
}

function syncScene(): void {
  const isNight = state.timeOfDay === "night";
  scene.background = new THREE.Color(isNight ? "#15213f" : "#9fd4ff");
  scene.fog = new THREE.Fog(isNight ? "#15213f" : "#9fd4ff", isNight ? 25 : 32, isNight ? 62 : 78);
  ambientLight.intensity = isNight ? 0.55 : 1.7;
  sun.intensity = isNight ? 0.25 : 2.2;
  campfireLight.intensity = state.party.status === "none" ? 0 : isNight ? 2.2 : 0.9;
  syncPolishEffects(isNight);

  state.tents.forEach((tent) => {
    const sprite = tentNameSprites.get(tent.id);
    if (sprite && tent.claimed) {
      replaceSpriteText(sprite, tent.name ?? tent.label, "#223012");
    }
  });

  state.animals.forEach((animal) => {
    const mesh = animalMeshes.get(animal.id);
    if (!mesh) return;
    mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, animal.position.x, 0.12);
    mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, animal.position.z, 0.12);
    mesh.position.y =
      animal.activity === "petted"
        ? Math.sin(state.elapsedMs / 90) * 0.08
        : animal.activity === "eating"
          ? Math.max(0, Math.sin(state.elapsedMs / 120)) * 0.06
          : Math.max(0, Math.sin(state.elapsedMs / 180 + animal.position.x)) * 0.035;
    mesh.rotation.y = Math.sin(state.elapsedMs / 1200 + animal.position.x) * 0.35;
    mesh.visible = mode === "camp";
  });

  state.residents.forEach((resident) => {
    const mesh = residentMeshes.get(resident.id);
    if (!mesh) return;
    mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, resident.position.x, 0.1);
    mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, resident.position.z, 0.1);
    mesh.rotation.y = Math.atan2(resident.target.x - resident.position.x, resident.target.z - resident.position.z);
    mesh.visible = mode === "camp";
  });

  state.collectibles.forEach((item, index) => {
    const mesh = collectibleMeshes.get(item.id);
    if (!mesh) return;
    mesh.visible = mode === "camp" && !item.collected;
    mesh.position.y = Math.max(0, Math.sin(state.elapsedMs / 360 + index) * 0.04);
    mesh.rotation.y += 0.01;
  });

  if (mode === "tent") syncTentFurniture();
  if (mode === "toilet" && state.elapsedMs < washingUntilMs) {
    player.rotation.z = Math.sin(state.elapsedMs / 80) * 0.18;
  } else {
    player.rotation.z = 0;
  }
}

function syncPolishEffects(isNight: boolean): void {
  const seconds = state.elapsedMs / 1000;
  waterSurfaces.forEach((surface, index) => {
    const baseY = Number(surface.userData.baseY ?? surface.position.y);
    surface.position.y = baseY + Math.sin(seconds * 1.9 + index * 0.8) * 0.025;
    surface.rotation.y = Math.sin(seconds * 0.35 + index) * 0.018;
    surface.scale.x = 1 + Math.sin(seconds * 2.2 + index) * 0.006;
    surface.scale.z = 1 + Math.cos(seconds * 1.8 + index) * 0.006;
  });

  cloudMeshes.forEach((cloud, index) => {
    const baseX = Number(cloud.userData.baseX ?? cloud.position.x);
    const baseY = Number(cloud.userData.baseY ?? cloud.position.y);
    const drift = Number(cloud.userData.drift ?? index);
    cloud.position.x = baseX + Math.sin(seconds * 0.08 + drift) * 1.35;
    cloud.position.y = baseY + Math.sin(seconds * 0.18 + drift) * 0.16;
    cloud.visible = mode === "camp";
  });

  lampLights.forEach((light, index) => {
    light.intensity = isNight ? 1.08 + Math.sin(seconds * 4.0 + index) * 0.06 : 0.16;
  });
}

function syncTentFurniture(): void {
  if (!activeTentId) return;
  const tent = state.tents.find((candidate) => candidate.id === activeTentId);
  if (!tent) return;
  const activeKeys = new Set<string>();
  tent.furniture.forEach((item) => {
    const key = `${tent.id}-${item.id}`;
    activeKeys.add(key);
    let mesh = furnitureMeshes.get(key);
    if (!mesh) {
      mesh = createFurnitureMesh(item);
      furnitureMeshes.set(key, mesh);
      tentInteriorGroup.add(mesh);
    }
    mesh.position.set(-4.5 + item.gridX + item.width / 2, 0.05, -2.5 + item.gridY + item.height / 2);
    mesh.visible = true;
  });
  furnitureMeshes.forEach((mesh, key) => {
    if (!activeKeys.has(key)) mesh.visible = false;
  });
}

function renderFrame(): void {
  if (mode === "camp") {
    const desired = new THREE.Vector3(0, 25, 29);
    camera.position.lerp(desired, 0.05);
    camera.lookAt(0, 0, 0);
  } else {
    const desired = mode === "tent" ? new THREE.Vector3(0, 9, 8.2) : new THREE.Vector3(0, 9, 8.6);
    camera.position.lerp(desired, 0.12);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (mode === "tent" && selectedFurniture && tentFloor) {
    const floorHit = raycaster.intersectObject(tentFloor, false)[0];
    if (floorHit && activeTentId) {
      const gridX = Math.floor(floorHit.point.x + 5);
      const gridY = Math.floor(floorHit.point.z + 3);
      const result = placeFurniture(state, activeTentId, selectedFurniture, gridX, gridY);
      setMessage(result.message);
      if (result.ok) selectedFurniture = null;
      closePanel();
      syncTentFurniture();
      updateHud();
      return;
    }
  }

  const intersections = raycaster.intersectObjects(clickTargets, true);
  const hit = intersections.find((item) => item.object.visible && item.object.userData.click);
  if (!hit) return;
  const payload = hit.object.userData.click as ClickPayload;
  handleClick(payload);
}

function handleClick(payload: ClickPayload): void {
  if (mode === "camp") {
    if (payload.kind === "owner") showOwnerDialog();
    if (payload.kind === "freezer") showShop("freezer");
    if (payload.kind === "shelf") showShop("shelf");
    if (payload.kind === "tent" && payload.id) showTentDialog(payload.id);
    if (payload.kind === "animal" && payload.id) showAnimalDialog(payload.id);
    if (payload.kind === "resident" && payload.id) showResidentDialog(payload.id);
    if (payload.kind === "collectible" && payload.id) {
      const result = collectTownItem(state, payload.id);
      setMessage(result.message);
      syncScene();
      updateHud();
    }
    if (payload.kind === "noticeBoard") showNoticeBoard();
    if (payload.kind === "toiletBuilding") setMode("toilet");
    if (payload.kind === "pool") setMessage("수영장은 캐릭터 허리 높이라 안전하게 물놀이할 수 있어요.");
  } else if (mode === "toilet") {
    if (payload.kind === "sink") {
      washingUntilMs = state.elapsedMs + 2500;
      setMessage("세면대에서 손을 씻고 있어요.");
    }
    if (payload.kind === "toiletStall") {
      player.position.set(payload.id === "stall-1" ? -1.8 : payload.id === "stall-2" ? 0.45 : 2.7, 0, -1.35);
      playerSeated = true;
      setMessage("칸 안 변기에 앉았어요. Space를 누르면 나와요.");
    }
  }
}

function showOwnerDialog(): void {
  showPanel("사장님과 대화", [
    button("안녕히게세요", () => {
      setMessage(`사장님: ${getOwnerReply("bye")}`);
      closePanel();
    }),
    button("무엇을 좋아하시나요?", () => setMessage(`사장님: ${getOwnerReply("favorite")}`)),
    button("이제 몇살이시나요?", () => setMessage(`사장님: ${getOwnerReply("age")}`)),
  ]);
}

function showResidentDialog(residentId: string): void {
  const resident = state.residents.find((candidate) => candidate.id === residentId);
  if (!resident) return;
  showPanel(`${resident.name}와 대화`, [
    residentCard(resident),
    button("수다 떨기", () => {
      const result = talkToResident(state, resident.id);
      setMessage(result.message);
      updateHud();
      showResidentDialog(resident.id);
    }),
    button("오늘 할 일 물어보기", () => {
      setMessage(`오늘의 부탁: ${taskProgressText()}`);
    }),
  ]);
}

function residentCard(resident: Resident): HTMLDivElement {
  const personalityLabels: Record<Resident["personality"], string> = {
    cheerful: "활발함",
    kind: "다정함",
    sleepy: "느긋함",
    curious: "호기심",
    cool: "시원함",
    shy: "수줍음",
  };
  const card = document.createElement("div");
  card.className = "resident-card";
  const portrait = document.createElement("div");
  portrait.className = `portrait-token ${resident.gender}`;
  portrait.textContent = resident.name.slice(0, 1);
  const details = document.createElement("div");
  details.className = "resident-details";
  const name = document.createElement("strong");
  name.textContent = resident.name;
  const meta = document.createElement("span");
  meta.className = "resident-meta";
  meta.textContent = `${personalityLabels[resident.personality]} · 대화 ${resident.talkCount}번`;
  const catchphrase = document.createElement("p");
  catchphrase.className = "quiet";
  catchphrase.textContent = `"${resident.catchphrase}"`;
  const hearts = document.createElement("div");
  hearts.className = "heart-row";
  const filled = Math.min(5, Math.max(0, Math.ceil(resident.friendship / 20)));
  for (let i = 0; i < 5; i += 1) {
    const heart = document.createElement("span");
    heart.className = i < filled ? "heart filled" : "heart";
    heart.textContent = "♥";
    hearts.append(heart);
  }
  details.append(name, meta, catchphrase, hearts);
  card.append(portrait, details);
  return card;
}

function showNoticeBoard(): void {
  showPanel("마을 게시판", [
    text(`${state.town.name} · 마을기분 ${state.town.mood}/100`),
    text(`오늘의 부탁: ${taskProgressText()}`),
    text("반짝이는 수집품을 주우면 작은 보상도 받을 수 있어요."),
  ]);
}

function showShop(source: "freezer" | "shelf"): void {
  const title = source === "freezer" ? "아이스크림 냉동고" : "과자 진열대";
  const elements = Object.entries(SHOP_ITEMS)
    .filter(([, item]) => item.source === source)
    .map(([id, item]) =>
      button(`${item.label} ${item.price}원`, () => {
        const result = buyShopItem(state, id as ShopItemId);
        setMessage(result.message);
        updateHud();
      }),
    );
  showPanel(title, elements);
}

function showTentDialog(tentId: string): void {
  const tent = state.tents.find((candidate) => candidate.id === tentId);
  if (!tent) return;
  activeTentId = tent.id;
  if (!tent.claimed) {
    const wrapper = document.createElement("div");
    wrapper.className = "stack";
    const input = document.createElement("input");
    input.placeholder = "텐트 이름";
    input.maxLength = 16;
    input.className = "text-input";
    const note = document.createElement("p");
    note.className = "quiet";
    note.textContent = "텐트와 이름은 바꿀 수 없으니 신중히 골라야 해!";
    const done = button("완성", () => {
      const result = claimTent(state, tent.id, input.value);
      setMessage(result.message);
      if (result.ok) {
        activeTentId = tent.id;
        setMode("tent");
      }
    });
    wrapper.append(input, note, done);
    showPanel(`${tent.label} 이름 정하기`, [wrapper]);
    setTimeout(() => input.focus(), 0);
    return;
  }
  showPanel(tent.name ?? tent.label, [
    text("이미 이름이 정해져서 바꿀 수 없어요."),
    button("텐트 안으로", () => {
      activeTentId = tent.id;
      setMode("tent");
    }),
  ]);
}

function showAnimalDialog(animalId: string): void {
  const animal = state.animals.find((candidate) => candidate.id === animalId);
  if (!animal) return;
  if (!animal.released) {
    setMessage("3분이 지나 밤이 오면 동물들이 우리 밖으로 나와요.");
    return;
  }
  const petButton = button(animal.species === "duck" ? "쓰다듬기 (오리는 안돼)" : "쓰다듬기", () => {
    const result = petAnimal(state, animal.id);
    setMessage(result.message);
    updateHud();
  });
  if (animal.species === "duck") petButton.disabled = true;
  showPanel(animal.label, [petButton, button("먹이주기", () => showFeedDialog(animal.id))]);
}

function showFeedDialog(animalId: string): void {
  const foods: FoodKind[] = ["carrot", "lettuce", "cucumber"];
  showPanel("먹이 고르기", foods.map((food) => button(`${FOOD_LABELS[food]} ${state.food[food]}개`, () => {
    const result = feedAnimal(state, animalId, food);
    setMessage(result.message);
    updateHud();
    if (result.ok) closePanel();
  })));
}

function showFurniturePalette(): void {
  const entries = Object.entries(FURNITURE_SPECS) as Array<[FurnitureType, (typeof FURNITURE_SPECS)[FurnitureType]]>;
  showPanel("텐트 꾸미기", entries.map(([type, spec]) => button(spec.label, () => {
    selectedFurniture = type;
    setMessage(`${spec.label}을 선택했어요. 텐트 바닥에서 둘 장소를 클릭하세요.`);
    closePanel();
  })));
}

function showPanel(title: string, elements: HTMLElement[]): void {
  lastPanelTitle = title;
  hud.panelTitle.textContent = title;
  hud.panelBody.replaceChildren(...elements);
  hud.panel.classList.remove("hidden");
}

function closePanel(): void {
  lastPanelTitle = "";
  hud.panel.classList.add("hidden");
  hud.panelBody.replaceChildren();
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.className = "menu-button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function text(content: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.className = "quiet";
  element.textContent = content;
  return element;
}

function setMode(nextMode: Mode): void {
  mode = nextMode;
  closePanel();
  selectedFurniture = null;
  playerSeated = false;
  campGroup.visible = nextMode === "camp";
  tentInteriorGroup.visible = nextMode === "tent";
  toiletInteriorGroup.visible = nextMode === "toilet";
  player.removeFromParent();
  if (nextMode === "camp") {
    campGroup.add(player);
    player.position.set(0, 0, 3);
    activeTentId = null;
    setMessage("캠핑장으로 나왔어요.");
  } else if (nextMode === "tent") {
    tentInteriorGroup.add(player);
    player.position.set(0, 0, 2.1);
    setMessage("오른쪽 위 텐트 아이콘으로 침낭, 베개, 책상, 전등, 가방을 놓을 수 있어요.");
    syncTentFurniture();
  } else {
    toiletInteriorGroup.add(player);
    player.position.set(0, 0, 2.2);
    setMessage("화장실 안입니다. 변기 가까이 가면 앉고, Space를 누르면 일어나요.");
  }
  updateHud();
}

function setMessage(message: string): void {
  lastMessage = message;
  hud.prompt.textContent = message;
}

function updateHud(): void {
  const seconds = Math.floor(state.elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const secondRemainder = String(seconds % 60).padStart(2, "0");
  const partyText =
    state.party.status === "none"
      ? ""
      : state.party.status === "called"
        ? " · 매점 앞 마시멜로우 파티"
        : state.party.status === "skewerHeld"
          ? " · 굽는 중"
          : state.party.status === "roasted"
            ? " · 다 구워짐"
            : " · 마시멜로우 먹음";
  hud.status.textContent = `${state.town.name} · 돈 ${state.money}원 · ${minutes}:${secondRemainder} · ${state.timeOfDay === "night" ? "밤" : "여름 낮"} · 당근 ${state.food.carrot} 상추 ${state.food.lettuce} 오이 ${state.food.cucumber}${partyText}`;
  hud.quest.textContent = state.dailyTask.completed ? `오늘의 부탁 완료 · 마을기분 ${state.town.mood}/100` : `오늘의 부탁: ${taskProgressText()} · 마을기분 ${state.town.mood}/100`;
  hud.quest.classList.toggle("done", state.dailyTask.completed);
  hud.tentButton.classList.toggle("hidden", mode !== "tent");
  hud.exitButton.classList.toggle("hidden", mode === "camp");
  hud.skewerButton.classList.toggle("hidden", state.party.status === "none" || state.party.status === "eaten" || mode !== "camp");
  hud.skewerButton.textContent =
    state.party.status === "roasted"
      ? "구운 마시멜로우 먹기"
      : state.party.status === "skewerHeld"
        ? "마시멜로우 굽는 중"
        : "마시멜로우꼬치";
}

function taskProgressText(): string {
  return `${state.dailyTask.label} ${Math.min(state.dailyTask.progress, state.dailyTask.target)}/${state.dailyTask.target}`;
}

function bindDirectionPad(root: HTMLElement): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-move-key]");
  buttons.forEach((control) => {
    const key = control.dataset.moveKey;
    if (!key) return;
    const press = (event: PointerEvent) => {
      event.preventDefault();
      screenKeys.add(key);
      control.classList.add("pressed");
      control.setPointerCapture(event.pointerId);
    };
    const release = (event: PointerEvent) => {
      event.preventDefault();
      screenKeys.delete(key);
      control.classList.remove("pressed");
      if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
    };
    control.addEventListener("pointerdown", press);
    control.addEventListener("pointerup", release);
    control.addEventListener("pointercancel", release);
    control.addEventListener("lostpointercapture", () => {
      screenKeys.delete(key);
      control.classList.remove("pressed");
    });
  });
}

function isInputPressed(primary: string, alternate: string): boolean {
  return keys.has(primary) || keys.has(alternate) || screenKeys.has(primary) || screenKeys.has(alternate);
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    renderer.domElement.requestFullscreen().catch(() => setMessage("전체화면을 열 수 없어요."));
  } else {
    document.exitFullscreen().catch(() => setMessage("전체화면을 닫을 수 없어요."));
  }
}

function renderGameToText(): string {
  const visibleAnimals = state.animals.map((animal) => ({
    id: animal.id,
    species: animal.species,
    released: animal.released,
    activity: animal.activity,
    x: Number(animal.position.x.toFixed(2)),
    z: Number(animal.position.z.toFixed(2)),
  }));
  return JSON.stringify({
    coordinateSystem: "x is left/right, z is forward/back on the ground plane, y is height",
    mode,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    timeOfDay: state.timeOfDay,
    money: state.money,
    food: state.food,
    animalsReleased: state.animalsReleased,
    party: state.party.status,
    town: {
      name: state.town.name,
      mood: state.town.mood,
    },
    dailyTask: {
      label: state.dailyTask.label,
      progress: state.dailyTask.progress,
      target: state.dailyTask.target,
      completed: state.dailyTask.completed,
    },
    selectedFurniture,
    activeTent: activeTentId,
    namedTents: state.tents.filter((tent) => tent.claimed).map((tent) => ({ id: tent.id, name: tent.name, furniture: tent.furniture.length })),
    animals: visibleAnimals,
    residents: state.residents.map((resident) => ({
      id: resident.id,
      name: resident.name,
      friendship: resident.friendship,
      talkCount: resident.talkCount,
      zone: resident.zone,
    })),
    collectibles: {
      remaining: state.collectibles.filter((item) => !item.collected).length,
      collected: state.collectibles.filter((item) => item.collected).length,
    },
    player: {
      x: Number(player.position.x.toFixed(2)),
      z: Number(player.position.z.toFixed(2)),
      seated: playerSeated,
    },
    screenControls: {
      visible: true,
      pressed: Array.from(screenKeys),
    },
    panel: lastPanelTitle,
    prompt: lastMessage,
  });
}

function replaceSpriteText(sprite: THREE.Sprite, textValue: string, color: string): void {
  const material = sprite.material as THREE.SpriteMaterial;
  const oldMap = material.map;
  const nextSprite = createTextSprite(textValue, color, 0.72);
  const nextMaterial = nextSprite.material as THREE.SpriteMaterial;
  material.map = nextMaterial.map;
  material.needsUpdate = true;
  oldMap?.dispose();
}

function moveToward(position: Vec2, target: Vec2, distanceStep: number): void {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0.001) return;
  const stepSize = Math.min(distanceStep, length);
  position.x += (dx / length) * stepSize;
  position.z += (dz / length) * stepSize;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
