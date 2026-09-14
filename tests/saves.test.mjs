import assert from "node:assert/strict";
import test from "node:test";
import "../site/assets/save-store.js";

const { createStore, keyFor, MAX_SIZE } = globalThis.LoaSaveStore;
function fixture() {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  return { data, storage, store: createStore(storage) };
}

test("progress survives a new store instance and deleting one game preserves another", () => {
  const { storage, store } = fixture();
  store.write("merge-restaurant", store.read("merge-restaurant"), { board: "[null,\"noodles\"]" });
  store.write("tooth-runner", store.read("tooth-runner"), { money: "2000" });
  const reopened = createStore(storage);
  assert.equal(reopened.read("merge-restaurant").entries.board, '[null,"noodles"]');
  reopened.remove("merge-restaurant");
  assert.equal(reopened.read("merge-restaurant").revision, 0);
  assert.equal(reopened.read("tooth-runner").entries.money, "2000");
});

test("stale tabs cannot overwrite a newer revision", () => {
  const { store } = fixture();
  const stale = store.read("merge-restaurant");
  store.write("merge-restaurant", stale, { money: "500" });
  assert.throws(() => store.write("merge-restaurant", stale, { money: "0" }), { code: "conflict" });
  assert.equal(store.read("merge-restaurant").entries.money, "500");
});

test("corrupt and changed records are preserved instead of becoming a new game", () => {
  const { data, store } = fixture();
  data.set(keyFor("mafia-midnight"), "broken");
  assert.throws(() => store.read("mafia-midnight"), { code: "corrupt" });
  assert.equal(data.get(keyFor("mafia-midnight")), "broken");
  const initial = store.write("tooth-runner", store.read("tooth-runner"), { money: "500" });
  data.set(keyFor("tooth-runner"), initial.raw.replace('"500"', '"900"'));
  assert.throws(() => store.read("tooth-runner"), { code: "corrupt" });
});

test("quota and denied storage fail visibly without replacing the last save", () => {
  const { storage, store } = fixture();
  const initial = store.write("tooth-runner", store.read("tooth-runner"), { money: "500" });
  storage.setItem = () => { throw Object.assign(new Error(), { name: "QuotaExceededError" }); };
  assert.throws(() => store.write("tooth-runner", initial, { money: "600" }), { code: "quota" });
  assert.equal(store.read("tooth-runner").raw, initial.raw);
  storage.getItem = () => { throw new Error("Blocked"); };
  assert.throws(() => store.read("tooth-runner"), { code: "unavailable" });
});

test("invalid snapshots and oversized payloads never touch existing saves", () => {
  const { store } = fixture();
  const initial = store.write("tooth-runner", store.read("tooth-runner"), { money: "500" });
  for (const entries of [null, [], { money: 12 }]) {
    assert.throws(() => store.write("tooth-runner", initial, entries), { code: "invalid" });
  }
  assert.throws(() => store.write("tooth-runner", initial, { huge: "x".repeat(MAX_SIZE) }), { code: "quota" });
  assert.throws(() => keyFor("../other"), { code: "invalid" });
  assert.equal(store.read("tooth-runner").raw, initial.raw);
});
