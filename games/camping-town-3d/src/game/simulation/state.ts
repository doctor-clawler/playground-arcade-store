export type TimeOfDay = "day" | "night";
export type AnimalSpecies = "pig" | "rabbit" | "duck";
export type FoodKind = "carrot" | "lettuce" | "cucumber";
export type ShopItemId =
  | "screwbar"
  | "jawsbar"
  | "bbangppare"
  | "worldcone"
  | "pocachip"
  | "bananakick"
  | "goraebab";
export type FurnitureType = "sleepingBag" | "pillow" | "smallTable" | "lamp" | "bag";
export type CollectibleKind = "clover" | "shell" | "star";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Tent {
  id: string;
  label: string;
  claimed: boolean;
  name: string | null;
  position: Vec2;
  furniture: PlacedFurniture[];
}

export interface PlacedFurniture {
  id: string;
  type: FurnitureType;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}

export interface Animal {
  id: string;
  species: AnimalSpecies;
  label: string;
  position: Vec2;
  homePosition: Vec2;
  released: boolean;
  activity: "idle" | "wandering" | "petted" | "eating";
  animationUntilMs: number;
}

export interface Resident {
  id: string;
  name: string;
  gender: "girl" | "boy";
  position: Vec2;
  target: Vec2;
  zone: "camp" | "store" | "pool" | "toilet" | "party" | "plaza";
  personality: "cheerful" | "kind" | "sleepy" | "curious" | "cool" | "shy";
  catchphrase: string;
  friendship: number;
  talkCount: number;
}

export interface PartyState {
  status: "none" | "called" | "skewerHeld" | "roasted" | "eaten";
  calledAtMs: number | null;
  heldAtMs: number | null;
}

export interface CampingState {
  elapsedMs: number;
  money: number;
  food: Record<FoodKind, number>;
  town: TownState;
  dailyTask: DailyTask;
  collectibles: TownCollectible[];
  timeOfDay: TimeOfDay;
  animalsReleased: boolean;
  party: PartyState;
  tents: Tent[];
  animals: Animal[];
  residents: Resident[];
  purchases: Record<ShopItemId, number>;
  selectedTentId: string | null;
}

export interface TownState {
  name: string;
  mood: number;
}

export interface DailyTask {
  id: string;
  label: string;
  targetKind: CollectibleKind;
  target: number;
  progress: number;
  completed: boolean;
  reward: number;
}

export interface TownCollectible {
  id: string;
  kind: CollectibleKind;
  label: string;
  position: Vec2;
  collected: boolean;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export const SHOP_ITEMS: Record<ShopItemId, { label: string; price: number; source: "freezer" | "shelf" }> = {
  screwbar: { label: "스크류바", price: 600, source: "freezer" },
  jawsbar: { label: "죠스바", price: 600, source: "freezer" },
  bbangppare: { label: "빵빠레", price: 600, source: "freezer" },
  worldcone: { label: "월드콘", price: 600, source: "freezer" },
  pocachip: { label: "포카칩", price: 1000, source: "shelf" },
  bananakick: { label: "바나나킥", price: 1000, source: "shelf" },
  goraebab: { label: "고래밥", price: 1000, source: "shelf" },
};

export const FOOD_LABELS: Record<FoodKind, string> = {
  carrot: "당근",
  lettuce: "상추",
  cucumber: "오이",
};

export const FURNITURE_SPECS: Record<FurnitureType, { label: string; width: number; height: number }> = {
  sleepingBag: { label: "침낭", width: 3, height: 2 },
  pillow: { label: "베개", width: 1, height: 1 },
  smallTable: { label: "작은 책상", width: 2, height: 2 },
  lamp: { label: "전등", width: 1, height: 1 },
  bag: { label: "가방", width: 2, height: 1 },
};

export const COLLECTIBLE_LABELS: Record<CollectibleKind, string> = {
  clover: "네잎클로버",
  shell: "조개껍데기",
  star: "별조각",
};

const SECOND_ROW_Z = -7.5;
const FIRST_ROW_Z = -1.5;

export function createInitialState(): CampingState {
  const tents: Tent[] = Array.from({ length: 15 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      id: `tent-${String(index + 1).padStart(2, "0")}`,
      label: `텐트 ${index + 1}`,
      claimed: false,
      name: null,
      position: { x: -11 + col * 5.5, z: row === 0 ? FIRST_ROW_Z : row === 1 ? SECOND_ROW_Z : -13.5 },
      furniture: [],
    };
  });

  const animals: Animal[] = [
    ...createAnimals("pig", 2, -7),
    ...createAnimals("rabbit", 9, 0),
    ...createAnimals("duck", 3, 8),
  ];

  return {
    elapsedMs: 0,
    money: 1200,
    food: { carrot: 10, lettuce: 10, cucumber: 10 },
    town: { name: "솔바람 캠핑 타운", mood: 50 },
    dailyTask: {
      id: "daily-clover",
      label: "네잎클로버 3개 모으기",
      targetKind: "clover",
      target: 3,
      progress: 0,
      completed: false,
      reward: 500,
    },
    collectibles: createCollectibles(),
    timeOfDay: "day",
    animalsReleased: false,
    party: { status: "none", calledAtMs: null, heldAtMs: null },
    tents,
    animals,
    residents: createResidents(),
    purchases: {
      screwbar: 0,
      jawsbar: 0,
      bbangppare: 0,
      worldcone: 0,
      pocachip: 0,
      bananakick: 0,
      goraebab: 0,
    },
    selectedTentId: null,
  };
}

export function advanceSimulation(state: CampingState, deltaMs: number): CampingState {
  const previousElapsed = state.elapsedMs;
  state.elapsedMs = Math.max(0, state.elapsedMs + deltaMs);

  const previousMinute = Math.floor(previousElapsed / 60_000);
  const currentMinute = Math.floor(state.elapsedMs / 60_000);
  for (let minute = previousMinute; minute < currentMinute; minute += 1) {
    state.money += 300;
    state.food.carrot += 1;
    state.food.lettuce += 1;
    state.food.cucumber += 1;
  }

  if (state.elapsedMs >= 180_000 && !state.animalsReleased) {
    state.animalsReleased = true;
    state.timeOfDay = "night";
    state.animals.forEach((animal) => {
      animal.released = true;
      animal.activity = "wandering";
    });
    state.party = { status: "called", calledAtMs: state.elapsedMs, heldAtMs: null };
    state.residents.forEach((resident, index) => {
      resident.zone = "party";
      resident.target = { x: 7 + (index % 3) * 1.1, z: -3 - Math.floor(index / 3) * 1.1 };
    });
  }

  if (state.party.status === "skewerHeld" && state.party.heldAtMs !== null && state.elapsedMs - state.party.heldAtMs >= 30_000) {
    state.party.status = "roasted";
  }

  state.animals.forEach((animal) => {
    if (animal.animationUntilMs <= state.elapsedMs && (animal.activity === "petted" || animal.activity === "eating")) {
      animal.activity = animal.released ? "wandering" : "idle";
    }
  });

  return state;
}

export function claimTent(state: CampingState, tentId: string, name: string): ActionResult {
  const tent = state.tents.find((candidate) => candidate.id === tentId);
  const trimmedName = name.trim();
  if (!tent) return { ok: false, message: "텐트를 찾을 수 없어요." };
  if (tent.claimed) return { ok: false, message: "이미 이름이 정해진 텐트예요." };
  if (!trimmedName) return { ok: false, message: "텐트 이름을 적어 주세요." };

  tent.claimed = true;
  tent.name = trimmedName;
  state.selectedTentId = tent.id;
  return { ok: true, message: `${trimmedName} 이름표를 달았어요.` };
}

export function buyShopItem(state: CampingState, itemId: ShopItemId): ActionResult {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { ok: false, message: "없는 상품이에요." };
  if (state.money < item.price) return { ok: false, message: "돈이 부족해요." };
  state.money -= item.price;
  state.purchases[itemId] += 1;
  return { ok: true, message: `${item.label}을 샀어요.` };
}

export function petAnimal(state: CampingState, animalId: string): ActionResult {
  const animal = state.animals.find((candidate) => candidate.id === animalId);
  if (!animal) return { ok: false, message: "동물을 찾을 수 없어요." };
  if (!animal.released) return { ok: false, message: "아직 우리 안에 있어요." };
  if (animal.species === "duck") return { ok: false, message: "오리는 만질 수 없어요." };

  animal.activity = "petted";
  animal.animationUntilMs = state.elapsedMs + 2_500;
  return { ok: true, message: `${animal.label}을 쓰다듬었어요.` };
}

export function feedAnimal(state: CampingState, animalId: string, food: FoodKind): ActionResult {
  const animal = state.animals.find((candidate) => candidate.id === animalId);
  if (!animal) return { ok: false, message: "동물을 찾을 수 없어요." };
  if (!animal.released) return { ok: false, message: "아직 우리 안에 있어요." };
  if (state.food[food] <= 0) return { ok: false, message: `${FOOD_LABELS[food]}가 없어요.` };

  state.food[food] -= 1;
  animal.activity = "eating";
  animal.animationUntilMs = state.elapsedMs + 3_000;
  return { ok: true, message: `${animal.label}에게 ${FOOD_LABELS[food]}를 줬어요.` };
}

export function placeFurniture(
  state: CampingState,
  tentId: string,
  type: FurnitureType,
  gridX: number,
  gridY: number,
): ActionResult {
  const tent = state.tents.find((candidate) => candidate.id === tentId);
  const spec = FURNITURE_SPECS[type];
  if (!tent) return { ok: false, message: "텐트를 찾을 수 없어요." };
  if (!tent.claimed) return { ok: false, message: "먼저 텐트 이름을 정해야 해요." };
  if (!spec) return { ok: false, message: "없는 물건이에요." };
  if (gridX < 0 || gridY < 0 || gridX + spec.width > 10 || gridY + spec.height > 6) {
    return { ok: false, message: "텐트 안쪽에 놓아 주세요." };
  }

  const overlaps = tent.furniture.some((item) =>
    rectanglesOverlap(gridX, gridY, spec.width, spec.height, item.gridX, item.gridY, item.width, item.height),
  );
  if (overlaps) return { ok: false, message: "물건을 겹쳐서 놓을 수 없어요." };

  tent.furniture.push({
    id: `${type}-${tent.furniture.length + 1}`,
    type,
    gridX,
    gridY,
    width: spec.width,
    height: spec.height,
  });
  return { ok: true, message: `${spec.label}을 놓았어요.` };
}

export function startMarshmallowRoast(state: CampingState): ActionResult {
  if (state.party.status !== "called") return { ok: false, message: "아직 마시멜로우 파티 시간이 아니에요." };
  state.party.status = "skewerHeld";
  state.party.heldAtMs = state.elapsedMs;
  return { ok: true, message: "마시멜로우 꼬치를 들었어요." };
}

export function eatMarshmallow(state: CampingState): ActionResult {
  if (state.party.status !== "roasted") return { ok: false, message: "아직 덜 구워졌어요." };
  state.party.status = "eaten";
  return { ok: true, message: "구운 마시멜로우를 먹었어요." };
}

export function talkToResident(state: CampingState, residentId: string): ActionResult {
  const resident = state.residents.find((candidate) => candidate.id === residentId);
  if (!resident) return { ok: false, message: "주민을 찾을 수 없어요." };

  resident.friendship += 1;
  resident.talkCount += 1;
  state.town.mood = clampNumber(state.town.mood + 2, 0, 100);

  const lines: Record<Resident["personality"], string[]> = {
    cheerful: ["오늘 광장이 반짝반짝해!", "같이 산책하면 기분이 좋아져!"],
    kind: ["네가 와서 마을이 더 따뜻해졌어.", "힘들면 매점 앞 벤치에서 쉬어."],
    sleepy: ["낮잠 자기 좋은 바람이네.", "마시멜로우 냄새가 나면 꼭 깨워줘."],
    curious: ["오늘은 어떤 걸 발견할까?", "게시판에 새 부탁이 붙었대."],
    cool: ["텐트 배치가 꽤 멋진데.", "밤에는 장작불 쪽이 제일 좋아."],
    shy: ["안녕... 오늘도 만나서 좋아.", "작은 선물을 모으면 마음이 포근해져."],
  };
  const line = lines[resident.personality][resident.talkCount % lines[resident.personality].length];
  return { ok: true, message: `${resident.name}: ${line} ${resident.catchphrase}` };
}

export function collectTownItem(state: CampingState, itemId: string): ActionResult {
  const item = state.collectibles.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, message: "수집할 물건을 찾을 수 없어요." };
  if (item.collected) return { ok: false, message: "이미 주웠어요." };

  item.collected = true;
  state.money += 50;
  state.town.mood = clampNumber(state.town.mood + 1, 0, 100);

  if (!state.dailyTask.completed && item.kind === state.dailyTask.targetKind) {
    state.dailyTask.progress += 1;
    if (state.dailyTask.progress >= state.dailyTask.target) {
      state.dailyTask.completed = true;
      state.money += state.dailyTask.reward;
      state.town.mood = clampNumber(state.town.mood + 7, 0, 100);
      return {
        ok: true,
        message: `${item.label}을 주웠어요. 오늘의 부탁 완료! 보상 ${state.dailyTask.reward}원을 받았어요.`,
      };
    }
  }

  return { ok: true, message: `${item.label}을 주웠어요. 작은 보상 50원을 받았어요.` };
}

export function getOwnerReply(option: "bye" | "favorite" | "age"): string {
  if (option === "bye") return "잘가";
  if (option === "favorite") return "나는 수박을 좋아해";
  return "그런건....때론 나도 까먹는다네 허허";
}

function createAnimals(species: AnimalSpecies, count: number, xOffset: number): Animal[] {
  return Array.from({ length: count }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const position = { x: xOffset + column * 1.2, z: 12 + row * 1.2 };
    return {
      id: `${species}-${index + 1}`,
      species,
      label: animalLabel(species, index + 1),
      position,
      homePosition: { ...position },
      released: false,
      activity: "idle",
      animationUntilMs: 0,
    };
  });
}

function createResidents(): Resident[] {
  const profiles: Array<Pick<Resident, "name" | "gender" | "personality" | "catchphrase">> = [
    { name: "하나", gender: "girl", personality: "cheerful", catchphrase: "랄라!" },
    { name: "미나", gender: "girl", personality: "kind", catchphrase: "포근하게." },
    { name: "소율", gender: "girl", personality: "shy", catchphrase: "살짝..." },
    { name: "준", gender: "boy", personality: "curious", catchphrase: "궁금해!" },
    { name: "도윤", gender: "boy", personality: "cool", catchphrase: "좋지." },
    { name: "이안", gender: "boy", personality: "sleepy", catchphrase: "하암." },
  ];
  return profiles.map((profile, index) => ({
    id: `resident-${index + 1}`,
    name: profile.name,
    gender: profile.gender,
    position: { x: -6 + index * 2.4, z: 4 + (index % 2) * 2 },
    target: { x: -2 + index, z: 2 + (index % 3) * 1.5 },
    zone: "camp",
    personality: profile.personality,
    catchphrase: profile.catchphrase,
    friendship: 0,
    talkCount: 0,
  }));
}

function createCollectibles(): TownCollectible[] {
  const items: Array<Omit<TownCollectible, "collected">> = [
    { id: "clover-1", kind: "clover", label: COLLECTIBLE_LABELS.clover, position: { x: -7.5, z: -4.2 } },
    { id: "clover-2", kind: "clover", label: COLLECTIBLE_LABELS.clover, position: { x: -1.5, z: -5.3 } },
    { id: "clover-3", kind: "clover", label: COLLECTIBLE_LABELS.clover, position: { x: 5.7, z: -4.1 } },
    { id: "clover-4", kind: "clover", label: COLLECTIBLE_LABELS.clover, position: { x: 10.8, z: 1.2 } },
    { id: "clover-5", kind: "clover", label: COLLECTIBLE_LABELS.clover, position: { x: -10.4, z: 2.6 } },
    { id: "shell-1", kind: "shell", label: COLLECTIBLE_LABELS.shell, position: { x: -14.2, z: -8.4 } },
    { id: "shell-2", kind: "shell", label: COLLECTIBLE_LABELS.shell, position: { x: -11.1, z: -8.0 } },
    { id: "shell-3", kind: "shell", label: COLLECTIBLE_LABELS.shell, position: { x: -13.4, z: -5.6 } },
    { id: "star-1", kind: "star", label: COLLECTIBLE_LABELS.star, position: { x: 11.7, z: -7.2 } },
    { id: "star-2", kind: "star", label: COLLECTIBLE_LABELS.star, position: { x: 13.2, z: -2.8 } },
    { id: "star-3", kind: "star", label: COLLECTIBLE_LABELS.star, position: { x: 8.8, z: 6.2 } },
  ];
  return items.map((item) => ({ ...item, collected: false }));
}

function animalLabel(species: AnimalSpecies, number: number): string {
  const prefix: Record<AnimalSpecies, string> = {
    pig: "돼지",
    rabbit: "토끼",
    duck: "오리",
  };
  return `${prefix[species]} ${number}`;
}

function rectanglesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
