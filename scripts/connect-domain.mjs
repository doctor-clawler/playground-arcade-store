import { readFile } from "node:fs/promises";
import { resolveCname } from "node:dns/promises";
import { execFileSync } from "node:child_process";

const config = JSON.parse(await readFile(new URL("../config/domain.json", import.meta.url), "utf8"));
const endpoint = `repos/${config.repository}/pages`;
const gh = (args) => execFileSync("gh", args, { encoding: "utf8", timeout: 30_000 });
const current = JSON.parse(gh(["api", endpoint]));
const cname = await resolveCname(config.hostname).catch(() => []);
console.log(JSON.stringify({ hostname: config.hostname, cname, pagesDomain: current.cname, httpsEnforced: current.https_enforced }, null, 2));
if (process.argv.includes("--apply")) {
  if (!cname.some(value => value.replace(/\.$/, "") === config.dns.value)) {
    throw new Error(`DNS not ready: add CNAME ${config.dns.name} -> ${config.dns.value} in Porkbun first. Pages was not changed.`);
  }
  if (current.cname && current.cname !== config.hostname) throw new Error(`Unexpected existing Pages domain: ${current.cname}`);
  if (current.cname !== config.hostname) gh(["api", "--method", "PUT", endpoint, "-f", `cname=${config.hostname}`]);
  const state = JSON.parse(gh(["api", endpoint]));
  console.log(JSON.stringify({ pagesDomain: state.cname, certificate: state.https_certificate ?? null }, null, 2));
  if (!state.https_enforced) gh(["api", "--method", "PUT", endpoint, "-F", "https_enforced=true"]);
  const response = await fetch(`https://${config.hostname}/catalog.json`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTPS catalog failed: ${response.status}`);
  const catalog = await response.json();
  const expected = JSON.parse(await readFile(new URL("../config/games.json", import.meta.url), "utf8"));
  if (catalog.version !== expected.storeVersion || catalog.games.length !== expected.games.length) throw new Error("Live catalog differs from this checkout");
  console.log(`Verified HTTPS catalog: ${catalog.games.length} games at https://${config.hostname}/`);
}
