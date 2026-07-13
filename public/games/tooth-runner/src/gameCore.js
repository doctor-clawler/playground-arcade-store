export const ITEM_DEFS = {
  invincible: {
    id: "invincible",
    name: "무적",
    cost: 10000,
    inventoryKey: "invincible",
  },
  hammer: {
    id: "hammer",
    name: "이빨을 죽이세요",
    cost: 2000,
    inventoryKey: "hammer",
  },
};

export const ARENA = {
  width: 960,
  height: 600,
};

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function placeHammer(next) {
  next.hammer.visible = next.inventory.hammer;
  next.hammer.carried = false;
  next.hammer.x = next.arena.width / 2;
  next.hammer.y = next.arena.height - 44;
}

function finishRun(next, result, award) {
  next.mode = "lobby";
  next.money += award;
  next.lastResult = result;
  next.hammer.visible = false;
  next.hammer.carried = false;
  return next;
}

function respawnTooth(next) {
  const side = next.run.kills % 4;
  const margin = 72;
  if (side === 0) {
    next.tooth.x = margin;
    next.tooth.y = margin;
  } else if (side === 1) {
    next.tooth.x = next.arena.width - margin;
    next.tooth.y = margin;
  } else if (side === 2) {
    next.tooth.x = next.arena.width - margin;
    next.tooth.y = next.arena.height - margin;
  } else {
    next.tooth.x = margin;
    next.tooth.y = next.arena.height - margin;
  }
  next.tooth.alive = true;
  next.tooth.respawnTimer = 0;
}

export function createInitialState({ money = 0, inventory = {} } = {}) {
  return {
    mode: "lobby",
    money,
    lastResult: null,
    lastShopMessage: null,
    savedAt: null,
    arena: { ...ARENA },
    inventory: {
      invincible: Boolean(inventory.invincible),
      hammer: Boolean(inventory.hammer),
    },
    run: {
      elapsed: 0,
      duration: 60,
      kills: 0,
    },
    player: {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      r: 18,
      speed: 250,
    },
    tooth: {
      x: 86,
      y: 86,
      r: 30,
      speed: 118,
      alive: true,
      respawnTimer: 0,
    },
    hammer: {
      x: ARENA.width / 2,
      y: ARENA.height - 44,
      r: 18,
      visible: false,
      carried: false,
    },
  };
}

export function startRun(state) {
  const next = cloneState(state);
  next.mode = "playing";
  next.lastResult = null;
  next.lastShopMessage = null;
  next.run = {
    elapsed: 0,
    duration: 60,
    kills: 0,
  };
  next.player.x = next.arena.width / 2;
  next.player.y = next.arena.height / 2;
  next.tooth.x = 86;
  next.tooth.y = 86;
  next.tooth.alive = true;
  next.tooth.respawnTimer = 0;
  placeHammer(next);
  return next;
}

export function buyItem(state, itemId) {
  const item = ITEM_DEFS[itemId];
  const next = cloneState(state);
  if (!item) {
    next.lastShopMessage = "unknown-item";
    return next;
  }
  if (next.inventory[item.inventoryKey]) {
    next.lastShopMessage = "already-owned";
    return next;
  }
  if (next.money < item.cost) {
    next.lastShopMessage = "not-enough-money";
    return next;
  }
  next.money -= item.cost;
  next.inventory[item.inventoryKey] = true;
  next.lastShopMessage = `bought-${itemId}`;
  return next;
}

export function updateGame(state, dt, input = {}) {
  const next = cloneState(state);
  if (next.mode !== "playing") return next;

  const elapsedDelta = Math.max(0, dt);
  next.run.elapsed += elapsedDelta;
  if (next.run.elapsed >= next.run.duration) {
    return finishRun(next, "survived", 100);
  }

  const moveDt = Math.min(elapsedDelta, 1 / 15);
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  if (input.pointerActive && Number.isFinite(input.targetX) && Number.isFinite(input.targetY)) {
    dx = input.targetX - next.player.x;
    dy = input.targetY - next.player.y;
    const pointerDistance = Math.hypot(dx, dy);
    if (pointerDistance < 8) {
      dx = 0;
      dy = 0;
    }
  }

  const moveLength = Math.hypot(dx, dy);
  if (moveLength > 0) {
    next.player.x += (dx / moveLength) * next.player.speed * moveDt;
    next.player.y += (dy / moveLength) * next.player.speed * moveDt;
    next.player.x = clamp(next.player.x, next.player.r, next.arena.width - next.player.r);
    next.player.y = clamp(next.player.y, next.player.r, next.arena.height - next.player.r);
  }

  if (next.hammer.visible && !next.hammer.carried && distance(next.player, next.hammer) <= next.player.r + next.hammer.r) {
    next.hammer.carried = true;
    next.hammer.visible = false;
  }

  if (!next.tooth.alive) {
    next.tooth.respawnTimer -= elapsedDelta;
    if (next.tooth.respawnTimer <= 0) respawnTooth(next);
    return next;
  }

  const toothDx = next.player.x - next.tooth.x;
  const toothDy = next.player.y - next.tooth.y;
  const toothDistance = Math.hypot(toothDx, toothDy);
  if (toothDistance > 0) {
    const step = Math.min(toothDistance, next.tooth.speed * moveDt);
    next.tooth.x += (toothDx / toothDistance) * step;
    next.tooth.y += (toothDy / toothDistance) * step;
  }

  if (distance(next.player, next.tooth) <= next.player.r + next.tooth.r) {
    if (!next.inventory.invincible) {
      return finishRun(next, "eaten", 0);
    }
    const pushDx = next.tooth.x - next.player.x || 1;
    const pushDy = next.tooth.y - next.player.y || 0;
    const pushLength = Math.hypot(pushDx, pushDy);
    next.tooth.x = clamp(next.player.x + (pushDx / pushLength) * 72, next.tooth.r, next.arena.width - next.tooth.r);
    next.tooth.y = clamp(next.player.y + (pushDy / pushLength) * 72, next.tooth.r, next.arena.height - next.tooth.r);
  }

  return next;
}

export function attackTooth(state) {
  const next = cloneState(state);
  if (next.mode !== "playing") return next;
  if (!next.hammer.carried || !next.tooth.alive) return next;

  if (distance(next.player, next.tooth) <= 92) {
    next.money += 100;
    next.run.kills += 1;
    next.tooth.alive = false;
    next.tooth.respawnTimer = 2;
    placeHammer(next);
    next.hammer.x = 120 + ((next.run.kills * 211) % (next.arena.width - 240));
    next.hammer.y = next.arena.height - 44;
  }

  return next;
}

export function saveStatePayload(state) {
  return JSON.stringify({
    money: state.money,
    inventory: state.inventory,
    savedAt: new Date().toISOString(),
  });
}

export function loadStatePayload(raw) {
  if (!raw) return createInitialState();
  try {
    const parsed = JSON.parse(raw);
    const state = createInitialState({
      money: Number.isFinite(parsed.money) ? parsed.money : 0,
      inventory: parsed.inventory || {},
    });
    state.savedAt = parsed.savedAt || null;
    return state;
  } catch {
    return createInitialState();
  }
}

export function renderStateToText(state) {
  return JSON.stringify({
    coordinateSystem: "origin top-left, x right, y down",
    mode: state.mode,
    money: state.money,
    timeRemaining: Math.max(0, Math.ceil(state.run.duration - state.run.elapsed)),
    lastResult: state.lastResult,
    inventory: state.inventory,
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      r: state.player.r,
      hammer: state.hammer.carried,
    },
    tooth: {
      x: Math.round(state.tooth.x),
      y: Math.round(state.tooth.y),
      r: state.tooth.r,
      alive: state.tooth.alive,
    },
    hammer: {
      x: Math.round(state.hammer.x),
      y: Math.round(state.hammer.y),
      visible: state.hammer.visible,
      carried: state.hammer.carried,
    },
    run: state.run,
  });
}
