import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDomain } from "../scripts/connect-domain.mjs";

const config = { hostname: "loa.example.test", repository: "owner/portal", dns: { name: "loa", value: "owner.github.io" } };
const expected = { storeVersion: "1", games: [{}] };
function fixture({ cname = null, certificateError, catalog = { version: "1", games: [{}] } } = {}) {
  const writes = [];
  const state = { cname, https_enforced: false };
  const gh = args => {
    if (!args.includes("PUT")) return JSON.stringify(state);
    writes.push(args.at(-1));
    if (args.at(-1).startsWith("cname=")) state.cname = config.hostname;
    else { if (certificateError) throw certificateError; state.https_enforced = true; }
    return "";
  };
  return { config, expected, gh, writes, lookup: async () => ["owner.github.io."],
    request: async () => ({ ok: true, status: 200, json: async () => catalog }), apply: true };
}

test("inspection does not mutate Pages", async () => {
  const f = fixture();
  assert.equal((await reconcileDomain({ ...f, apply: false })).status, "inspection");
  assert.deepEqual(f.writes, []);
});
test("claims Pages before DNS check and reports missing DNS without enabling HTTPS", async () => {
  const f = fixture();
  const result = await reconcileDomain({ ...f, lookup: async () => {
    assert.deepEqual(f.writes, [`cname=${config.hostname}`]); return ["parking.example.test"];
  } });
  assert.equal(result.status, "waiting_dns");
  assert.deepEqual(f.writes, [`cname=${config.hostname}`]);
});
test("refuses to replace an unrelated custom domain", async () => {
  const f = fixture({ cname: "unrelated.example.test" });
  await assert.rejects(reconcileDomain(f), /Unexpected existing Pages domain/);
  assert.deepEqual(f.writes, []);
});
test("certificate provisioning waits but authentication failures surface", async () => {
  const pending = Object.assign(new Error("gh failed"), { stdout: JSON.stringify({status: "404", message: "The certificate does not exist yet"}) });
  assert.equal((await reconcileDomain(fixture({ certificateError: pending }))).status, "waiting_certificate");
  await assert.rejects(reconcileDomain(fixture({ certificateError: new Error("Bad credentials") })), /Bad credentials/);
});
test("verifies enforced HTTPS and expected catalog; TLS or stale content never pass", async () => {
  const result = await reconcileDomain(fixture());
  assert.equal(result.status, "verified");
  assert.equal(result.httpsEnforced, true);
  assert.equal(result.games, 1);
  assert.equal((await reconcileDomain({ ...fixture(), request: async () => { throw new Error("TLS mismatch"); } })).status, "waiting_https");
  await assert.rejects(reconcileDomain(fixture({ catalog: { version: "old", games: [{}] } })), /Live catalog differs/);
});
