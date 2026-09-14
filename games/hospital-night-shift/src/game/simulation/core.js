const ROOM_COUNT = 3;
const MAX_HEALTH = 100;
const HEALTH_REGEN_PER_SECOND = 1.5;
const ATTACK_INTERVAL_SECONDS = 1;
const ATTACK_DAMAGE = 5;
const HOLD_TO_BANISH_SECONDS = 3;
const TREATMENT_SECONDS = 7;

const SUSPICIOUS_BEHAVIORS = new Set(["repeat", "stare", "attack"]);

export function createGameState({ seed = 1 } = {}) {
  return {
    seed,
    time: 0,
    nextGuestId: 1,
    player: {
      health: MAX_HEALTH,
      inCounter: true,
      x: 0,
      z: 0,
      yaw: 0,
    },
    talisman: {
      active: false,
      cooldown: 0,
    },
    rooms: Array.from({ length: ROOM_COUNT }, (_, index) => ({
      id: index + 1,
      occupantId: null,
      doctorName: `의사 ${index + 1}`,
    })),
    guests: [],
    eventLog: [],
  };
}

export function spawnGuest(
  state,
  {
    behavior = chooseBehavior(state),
    phrase = defaultPhraseFor(behavior),
    position = { x: 0, z: -9 },
  } = {},
) {
  const guest = {
    id: state.nextGuestId++,
    behavior,
    phrase,
    repeatedPhraseCount: behavior === "repeat" ? 3 : 1,
    status: "waiting",
    position: { ...position },
    eyeTarget: { x: 0, y: 1.65 },
    dialogue: phrase,
    roomId: null,
    treatmentRemaining: TREATMENT_SECONDS,
    attackTimer: 0,
    holdProgress: 0,
    mood: SUSPICIOUS_BEHAVIORS.has(behavior) ? "suspicious" : "normal",
    admittedByMistake: false,
  };

  state.guests.push(guest);
  pushEvent(state, `guest:${guest.id}:arrived:${behavior}`);
  return guest;
}

export function chooseDialogue(state, guestId, choice) {
  const guest = findGuest(state, guestId);
  if (!guest || !["waiting", "attacking"].includes(guest.status)) {
    return { ok: false, reason: "guest-unavailable" };
  }

  if (choice === "reject") {
    guest.status = "gone";
    guest.dialogue = guest.mood === "suspicious" ? "잘가요..." : "안녕히 계세요";
    releaseRoom(state, guest.id);
    pushEvent(state, `guest:${guest.id}:rejected`);
    return { ok: true, action: "reject" };
  }

  if (choice !== "admit") {
    return { ok: false, reason: "unknown-choice" };
  }

  if (guest.mood === "suspicious") {
    guest.status = "attacking";
    guest.dialogue = "크르르...";
    guest.attackTimer = 0;
    guest.admittedByMistake = true;
    releaseRoom(state, guest.id);
    pushEvent(state, `guest:${guest.id}:admitted-suspicious`);
    return { ok: true, action: "attack" };
  }

  const room = state.rooms.find((candidate) => candidate.occupantId === null);
  if (!room) {
    guest.dialogue = "빈 진료실이 없어요";
    return { ok: false, reason: "rooms-full" };
  }

  room.occupantId = guest.id;
  guest.status = "in-room";
  guest.roomId = room.id;
  guest.dialogue = "진료실로 들어갈게요";
  guest.treatmentRemaining = TREATMENT_SECONDS;
  pushEvent(state, `guest:${guest.id}:room:${room.id}`);
  return { ok: true, action: "admit", roomId: room.id };
}

export function toggleTalisman(state) {
  state.talisman.active = !state.talisman.active;
  pushEvent(state, `talisman:${state.talisman.active ? "raised" : "lowered"}`);
  return { ok: true, active: state.talisman.active };
}

export function holdGuest(state, guestId, seconds) {
  const guest = findGuest(state, guestId);
  if (!guest || guest.status !== "attacking") {
    return { ok: false, reason: "not-attacking" };
  }

  guest.holdProgress = Math.min(HOLD_TO_BANISH_SECONDS, guest.holdProgress + Math.max(0, seconds));
  if (guest.holdProgress >= HOLD_TO_BANISH_SECONDS) {
    guest.status = "gone";
    guest.dialogue = "사라진다...";
    releaseRoom(state, guest.id);
    pushEvent(state, `guest:${guest.id}:held-banish`);
  }

  return { ok: true, holdProgress: guest.holdProgress, status: guest.status };
}

export function updateSimulation(state, dtSeconds) {
  const dt = Math.max(0, dtSeconds);
  let tookDamage = false;
  state.time += dt;
  state.talisman.cooldown = Math.max(0, state.talisman.cooldown - dt);

  if (state.talisman.active) {
    resolveTalisman(state);
  }

  for (const guest of state.guests) {
    if (guest.status === "waiting" && guest.behavior === "attack") {
      guest.attackTimer += dt;
      if (guest.attackTimer >= 1) {
        guest.status = "attacking";
        guest.dialogue = "문을 열고 들어온다!";
        guest.attackTimer = 0;
        pushEvent(state, `guest:${guest.id}:counter-breach`);
      }
    }

    if (guest.status === "attacking") {
      guest.attackTimer += dt;
      while (guest.attackTimer >= ATTACK_INTERVAL_SECONDS) {
        guest.attackTimer -= ATTACK_INTERVAL_SECONDS;
        state.player.health = Math.max(0, state.player.health - ATTACK_DAMAGE);
        tookDamage = true;
        pushEvent(state, `guest:${guest.id}:damage:${ATTACK_DAMAGE}`);
      }
    }

    if (guest.status === "in-room") {
      guest.treatmentRemaining -= dt;
      if (guest.treatmentRemaining <= 0) {
        guest.status = "treated";
        guest.dialogue = "고마워요!";
        releaseRoom(state, guest.id);
        pushEvent(state, `guest:${guest.id}:treated`);
      }
    }
  }

  if (state.player.health > 0 && !tookDamage) {
    state.player.health = Math.min(MAX_HEALTH, state.player.health + HEALTH_REGEN_PER_SECOND * dt);
  }

  return state;
}

export function serializeGameState(state) {
  return {
    time: round(state.time),
    player: {
      health: Math.round(state.player.health),
      inCounter: state.player.inCounter,
      position: { x: round(state.player.x), z: round(state.player.z) },
    },
    talisman: { active: state.talisman.active, cooldown: round(state.talisman.cooldown) },
    rooms: state.rooms.map((room) => ({ id: room.id, occupantId: room.occupantId })),
    guests: state.guests
      .filter((guest) => guest.status !== "gone")
      .map((guest) => ({
        id: guest.id,
        behavior: guest.behavior,
        status: guest.status,
        dialogue: guest.dialogue,
        roomId: guest.roomId,
        holdProgress: round(guest.holdProgress),
        position: { x: round(guest.position.x), z: round(guest.position.z) },
      })),
    recentEvents: state.eventLog.slice(-6),
  };
}

function resolveTalisman(state) {
  const target = state.guests.find(
    (guest) =>
      (["waiting", "in-room"].includes(guest.status) ||
        (guest.status === "attacking" && guest.admittedByMistake)) &&
      (guest.mood === "suspicious" || guest.mood === "normal"),
  );

  if (!target) {
    return;
  }

  target.status = "gone";
  target.dialogue = target.mood === "suspicious" ? "부적이 싫어!" : "뭐에요?!";
  releaseRoom(state, target.id);
  state.talisman.active = false;
  state.talisman.cooldown = 0.5;
  pushEvent(state, `guest:${target.id}:talisman:${target.mood}`);
}

function releaseRoom(state, guestId) {
  for (const room of state.rooms) {
    if (room.occupantId === guestId) {
      room.occupantId = null;
    }
  }
}

function findGuest(state, guestId) {
  return state.guests.find((guest) => guest.id === guestId);
}

function chooseBehavior(state) {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  const roll = state.seed / 0xffffffff;
  if (roll < 0.55) return "normal";
  if (roll < 0.75) return "repeat";
  if (roll < 0.9) return "stare";
  return "attack";
}

function defaultPhraseFor(behavior) {
  switch (behavior) {
    case "repeat":
      return "괜찮아요, 괜찮아요, 괜찮아요";
    case "stare":
      return "눈을 마주치고 싶어요";
    case "attack":
      return "문 좀 열어줘";
    default:
      return "진료 받고 싶어요";
  }
}

function pushEvent(state, message) {
  state.eventLog.push(message);
  if (state.eventLog.length > 30) {
    state.eventLog.shift();
  }
}

function round(value) {
  return Math.round(value * 100) / 100;
}
