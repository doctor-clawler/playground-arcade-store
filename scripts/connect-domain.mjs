import { readFile } from "node:fs/promises";
import { resolveCname } from "node:dns/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export async function reconcileDomain({ config, expected, gh, lookup = resolveCname, request = fetch, apply = false }) {
  const endpoint = `repos/${config.repository}/pages`;
  let state = JSON.parse(gh(["api", endpoint]));
  if (apply && state.cname && state.cname !== config.hostname) {
    throw new Error(`Unexpected existing Pages domain: ${state.cname}`);
  }
  // Claim the hostname at GitHub before directing public DNS to Pages.
  if (apply && state.cname !== config.hostname) {
    gh(["api", "--method", "PUT", endpoint, "-f", `cname=${config.hostname}`]);
    state = JSON.parse(gh(["api", endpoint]));
    if (state.cname !== config.hostname) throw new Error("Pages domain update was not confirmed");
  }
  const cname = await lookup(config.hostname).catch(() => []);
  const result = { hostname: config.hostname, cname, pagesDomain: state.cname,
    httpsEnforced: state.https_enforced, certificate: state.https_certificate ?? null };
  if (!apply) return { ...result, status: "inspection" };
  if (!cname.some(value => value.replace(/\.$/, "") === config.dns.value)) {
    return { ...result, status: "waiting_dns", detail: `Add CNAME ${config.dns.name} -> ${config.dns.value} at your DNS provider; Pages hostname is already configured.` };
  }
  if (!state.https_enforced) {
    try {
      gh(["api", "--method", "PUT", endpoint, "-F", "https_enforced=true"]);
    } catch (error) {
      // Retry only the known provisioning boundary, never auth/API failures.
      let response;
      try { response = JSON.parse(String(error.stdout)); } catch { /* Not a GitHub API response. */ }
      if (String(response?.status) === "404" && response.message === "The certificate does not exist yet") {
        return { ...result, status: "waiting_certificate" };
      }
      throw error;
    }
    state = JSON.parse(gh(["api", endpoint]));
    if (!state.https_enforced) throw new Error("HTTPS enforcement update was not confirmed");
    result.httpsEnforced = true;
    result.certificate = state.https_certificate ?? null;
  }
  let root, catalogResponse;
  try {
    [root, catalogResponse] = await Promise.all([
      request(`https://${config.hostname}/`, { method: "HEAD", signal: AbortSignal.timeout(20_000) }),
      request(`https://${config.hostname}/catalog.json`, { signal: AbortSignal.timeout(20_000) })
    ]);
  } catch (error) {
    return { ...result, status: "waiting_https", detail: error.message };
  }
  if (!root.ok || !catalogResponse.ok) {
    return { ...result, status: "waiting_https", detail: `root=${root.status}, catalog=${catalogResponse.status}` };
  }
  const catalog = await catalogResponse.json();
  if (catalog.version !== expected.storeVersion || catalog.games?.length !== expected.games.length) {
    throw new Error("Live catalog differs from this checkout");
  }
  return { ...result, status: "verified", games: catalog.games.length, version: catalog.version };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--apply", "--wait"].includes(arg)) || (args.includes("--wait") && !args.includes("--apply"))) {
    throw new Error("Usage: node scripts/connect-domain.mjs [--apply [--wait]]");
  }
  const config = JSON.parse(await readFile(new URL("../config/domain.json", import.meta.url), "utf8"));
  const expected = JSON.parse(await readFile(new URL("../config/games.json", import.meta.url), "utf8"));
  const gh = args => execFileSync("gh", args, { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
  const deadline = Date.now() + (args.includes("--wait") ? 15 * 60_000 : 0);
  do {
    const result = await reconcileDomain({ config, expected, gh, apply: args.includes("--apply") });
    console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
    if (["inspection", "verified"].includes(result.status)) return;
    if (Date.now() >= deadline) { process.exitCode = 2; return; }
    await delay(Math.min(30_000, deadline - Date.now()));
  } while (true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
