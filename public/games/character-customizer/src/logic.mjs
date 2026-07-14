export const WHITE = "#ffffff";

export const SKIN_COLORS = [
  { name: "하양", value: WHITE },
  { name: "복숭아", value: "#f5d0b5" },
  { name: "살구", value: "#eab48b" },
  { name: "구릿빛", value: "#bd7d52" },
  { name: "갈색", value: "#865334" },
  { name: "진한 갈색", value: "#553124" },
];

export const OUTFIT_COLORS = [
  { name: "하양", value: WHITE },
  { name: "빨강", value: "#f05f56" },
  { name: "노랑", value: "#f4c84a" },
  { name: "초록", value: "#4cb78e" },
  { name: "파랑", value: "#4d84d8" },
  { name: "남색", value: "#334b78" },
  { name: "보라", value: "#a779c9" },
  { name: "검정", value: "#34343d" },
];

export const OUTFITS = [
  { id: "short", name: "반팔티" },
  { id: "long", name: "긴팔티" },
  { id: "coat", name: "겨울코트" },
  { id: "windbreaker", name: "바람막이" },
];

const allowedSkinColors = new Set(SKIN_COLORS.map((color) => color.value));
const allowedOutfitColors = new Set(OUTFIT_COLORS.map((color) => color.value));
const allowedOutfits = new Set(OUTFITS.map((outfit) => outfit.id));

export function createDefaultCharacter() {
  return {
    skinColor: WHITE,
    outfit: null,
    outfitColor: WHITE,
    eyes: false,
    mouth: false,
  };
}

export function normalizeCharacter(value) {
  const fallback = createDefaultCharacter();
  if (!value || typeof value !== "object") return fallback;

  return {
    skinColor: allowedSkinColors.has(value.skinColor) ? value.skinColor : fallback.skinColor,
    outfit: allowedOutfits.has(value.outfit) ? value.outfit : null,
    outfitColor: allowedOutfitColors.has(value.outfitColor) ? value.outfitColor : fallback.outfitColor,
    eyes: false,
    mouth: false,
  };
}

export function cloneCharacter(character) {
  return normalizeCharacter(character);
}

export function createInitialState(savedCharacter = null) {
  const saved = savedCharacter ? normalizeCharacter(savedCharacter) : null;
  return {
    mode: "start",
    activeTab: "skin",
    saved,
    draft: cloneCharacter(saved || createDefaultCharacter()),
    time: 0,
    modeStartedAt: 0,
    hoverId: null,
    pressedId: null,
  };
}

export function startCustomizing(state) {
  state.mode = "customize";
  state.activeTab = "skin";
  state.draft = cloneCharacter(state.saved || createDefaultCharacter());
  state.modeStartedAt = state.time;
  return state;
}

export function exitWithoutSaving(state) {
  state.mode = "start";
  state.draft = cloneCharacter(state.saved || createDefaultCharacter());
  state.activeTab = "skin";
  state.modeStartedAt = state.time;
  return state;
}

export function saveAndExit(state) {
  state.saved = cloneCharacter(state.draft);
  state.mode = "start";
  state.activeTab = "skin";
  state.modeStartedAt = state.time;
  return state;
}

export function setActiveTab(state, tab) {
  if (tab === "skin" || tab === "clothes") state.activeTab = tab;
  return state;
}

export function setSkinColor(state, color) {
  if (allowedSkinColors.has(color)) state.draft.skinColor = color;
  return state;
}

export function selectOutfit(state, outfit) {
  if (!allowedOutfits.has(outfit)) return state;
  if (state.draft.outfit !== outfit) state.draft.outfitColor = WHITE;
  state.draft.outfit = outfit;
  return state;
}

export function setOutfitColor(state, color) {
  if (state.draft.outfit && allowedOutfitColors.has(color)) state.draft.outfitColor = color;
  return state;
}

export function eraseCurrentSelection(state) {
  if (state.activeTab === "skin") {
    state.draft.skinColor = WHITE;
  } else {
    state.draft.outfit = null;
    state.draft.outfitColor = WHITE;
  }
  return state;
}
