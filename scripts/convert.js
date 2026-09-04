#!/usr/bin/env node
/**
 * Convert AdGuard DNS filter (Adblock syntax) into an unbound.conf include file.
 *
 * Input : filter.txt (downloaded by the workflow from AdGuard before this script runs)
 * Output: adguard-dns.conf (one "local-zone ... always_nxdomain" line per domain)
 *
 * Supported rules:
 *   ||domain^            -> blocked
 *   @@||domain^          -> exception (whitelisted, excluded from the block list)
 *   @@|domain^           -> same as @@|| (exact-anchor exception)
 *
 * Rules that are skipped because they can't be represented as a simple
 * unbound local-zone entry:
 *   - lines containing a wildcard "*" in the domain
 *   - lines that are plain IP addresses (not domain names)
 *   - regex-based lines (starting with "/")
 *   - $badfilter lines (these negate other rules, they don't block anything)
 *   - other complex/path-fragment patterns
 */

const fs = require("fs");

const SRC = "filter.txt";
const OUT = "adguard-dns.conf";

const MIN_EXPECTED_DOMAINS = 50_000; // sanity check

const ipRe = /^[0-9]+(\.[0-9]+){3}$/;
const blockRe = /^\|\|([A-Za-z0-9][A-Za-z0-9.\-]*)\^/;
const allowRe = /^@@\|{1,2}([A-Za-z0-9][A-Za-z0-9.\-]*)\^/;

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`ERROR: ${SRC} not found. Make sure the download step succeeded.`);
    process.exit(1);
  }

  const blockDomains = new Set();
  const allowDomains = new Set();

  const stats = { badfilter: 0, wildcard: 0, ip: 0, other: 0 };

  const content = fs.readFileSync(SRC, "utf-8");
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("!")) continue;

    if (line.includes("$badfilter")) {
      stats.badfilter++;
      continue;
    }

    if (line.startsWith("@@")) {
      const m = line.match(allowRe);
      if (!m) {
        stats.other++;
        continue;
      }
      const domain = m[1].toLowerCase();
      if (domain.includes("*")) {
        stats.wildcard++;
        continue;
      }
      allowDomains.add(domain);
      continue;
    }

    if (line.startsWith("||")) {
      const m = line.match(blockRe);
      if (!m) {
        stats.other++;
        continue;
      }
      const domain = m[1].toLowerCase();
      if (domain.includes("*")) {
        stats.wildcard++;
        continue;
      }
      if (ipRe.test(domain)) {
        stats.ip++;
        continue;
      }
      blockDomains.add(domain);
      continue;
    }

    stats.other++;
  }

  const finalDomains = [...blockDomains]
    .filter((d) => !allowDomains.has(d))
    .sort();

  console.log(`Total block domains extracted : ${blockDomains.size}`);
  console.log(`Total allow(exception) domains: ${allowDomains.size}`);
  console.log(`Final domains to block        : ${finalDomains.length}`);
  console.log(`Skipped ($badfilter)          : ${stats.badfilter}`);
  console.log(`Skipped (wildcard *)          : ${stats.wildcard}`);
  console.log(`Skipped (bare IP)             : ${stats.ip}`);
  console.log(`Skipped (other/unsupported)   : ${stats.other}`);

  if (finalDomains.length < MIN_EXPECTED_DOMAINS) {
    console.error(
      `ERROR: only ${finalDomains.length} domains produced, below the ` +
        `${MIN_EXPECTED_DOMAINS} threshold. The filter.txt download was likely ` +
        `incomplete or broken. Aborting so we don't overwrite a previously valid file.`
    );
    process.exit(1);
  }

  const header = [
    "# Auto-generated from the AdGuard DNS filter by GitHub Actions",
    "# Source: https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
    `# Total blocked domains: ${finalDomains.length}`,
    "# Include this file from the server: section of your main unbound.conf",
    "",
    "",
  ].join("\n");

  const body = finalDomains.map((d) => `local-zone: "${d}" always_nxdomain`).join("\n") + "\n";

  fs.writeFileSync(OUT, header + body, "utf-8");

  console.log(`\nDone -> ${OUT}`);
}

main();
