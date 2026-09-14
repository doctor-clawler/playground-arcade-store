import { describe, expect, it } from "vitest";
import {
  advanceSimulation,
  buyShopItem,
  claimTent,
  collectTownItem,
  createInitialState,
  feedAnimal,
  eatMarshmallow,
  placeFurniture,
  petAnimal,
  startMarshmallowRoast,
  talkToResident,
} from "../src/game/simulation/state";

describe("camping simulation", () => {
  it("starts with the requested tents, animals, money, and food inventory", () => {
    const state = createInitialState();

    expect(state.tents).toHaveLength(15);
    expect(state.animals.filter((animal) => animal.species === "pig")).toHaveLength(2);
    expect(state.animals.filter((animal) => animal.species === "rabbit")).toHaveLength(9);
    expect(state.animals.filter((animal) => animal.species === "duck")).toHaveLength(3);
    expect(state.money).toBe(1200);
    expect(state.food).toEqual({ carrot: 10, lettuce: 10, cucumber: 10 });
  });

  it("pays money and grows all food once per played minute", () => {
    const state = createInitialState();

    advanceSimulation(state, 60_000);

    expect(state.money).toBe(1500);
    expect(state.food).toEqual({ carrot: 11, lettuce: 11, cucumber: 11 });
  });

  it("releases animals and turns the camp to night after three played minutes", () => {
    const state = createInitialState();

    advanceSimulation(state, 180_000);

    expect(state.animalsReleased).toBe(true);
    expect(state.timeOfDay).toBe("night");
    expect(state.party.status).toBe("called");
  });

  it("locks a tent name after the first completed claim", () => {
    const state = createInitialState();

    const first = claimTent(state, "tent-03", "구름 텐트");
    const second = claimTent(state, "tent-03", "다른 이름");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(state.tents.find((tent) => tent.id === "tent-03")?.name).toBe("구름 텐트");
  });

  it("charges the correct price and blocks purchases without enough money", () => {
    const state = createInitialState();

    expect(buyShopItem(state, "screwbar").ok).toBe(true);
    expect(state.money).toBe(600);
    expect(buyShopItem(state, "pocachip").ok).toBe(false);
    expect(state.money).toBe(600);
  });

  it("feeds animals with one selected food and prevents petting ducks", () => {
    const state = createInitialState();
    advanceSimulation(state, 180_000);

    const rabbit = state.animals.find((animal) => animal.species === "rabbit");
    const duck = state.animals.find((animal) => animal.species === "duck");

    expect(rabbit).toBeTruthy();
    expect(duck).toBeTruthy();
    expect(feedAnimal(state, rabbit!.id, "carrot").ok).toBe(true);
    expect(state.food.carrot).toBe(12);
    expect(petAnimal(state, duck!.id).ok).toBe(false);
  });

  it("places tent furniture only when grid cells do not overlap", () => {
    const state = createInitialState();
    claimTent(state, "tent-01", "노랑 텐트");

    expect(placeFurniture(state, "tent-01", "sleepingBag", 2, 2).ok).toBe(true);
    expect(placeFurniture(state, "tent-01", "pillow", 2, 2).ok).toBe(false);
    expect(placeFurniture(state, "tent-01", "pillow", 5, 2).ok).toBe(true);
  });

  it("roasts and eats a marshmallow after thirty seconds of holding the skewer", () => {
    const state = createInitialState();
    advanceSimulation(state, 180_000);

    expect(startMarshmallowRoast(state).ok).toBe(true);
    advanceSimulation(state, 29_000);
    expect(eatMarshmallow(state).ok).toBe(false);
    advanceSimulation(state, 1_000);
    expect(state.party.status).toBe("roasted");
    expect(eatMarshmallow(state).ok).toBe(true);
    expect(state.party.status).toBe("eaten");
  });

  it("starts as a cozy camping town with residents, friendships, and a daily task", () => {
    const state = createInitialState();

    expect(state.town.name).toBe("솔바람 캠핑 타운");
    expect(state.town.mood).toBe(50);
    expect(state.dailyTask.completed).toBe(false);
    expect(state.dailyTask.progress).toBe(0);
    expect(state.residents).toHaveLength(6);
    expect(state.residents.every((resident) => resident.friendship === 0)).toBe(true);
    expect(state.collectibles.filter((item) => item.kind === state.dailyTask.targetKind)).toHaveLength(5);
  });

  it("lets the player talk with residents to raise friendship and town mood", () => {
    const state = createInitialState();

    const result = talkToResident(state, "resident-1");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("하나");
    expect(state.residents[0].friendship).toBe(1);
    expect(state.residents[0].talkCount).toBe(1);
    expect(state.town.mood).toBe(52);
  });

  it("completes the daily collection task and pays a cozy-town reward", () => {
    const state = createInitialState();
    const clovers = state.collectibles.filter((item) => item.kind === state.dailyTask.targetKind).slice(0, 3);

    clovers.forEach((item) => {
      expect(collectTownItem(state, item.id).ok).toBe(true);
    });

    expect(state.dailyTask.progress).toBe(3);
    expect(state.dailyTask.completed).toBe(true);
    expect(state.money).toBe(1850);
    expect(state.town.mood).toBe(60);
  });
});
