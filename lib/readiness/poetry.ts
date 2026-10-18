import { canonical, list, object, text } from "./core";
import type { AdapterContext } from "./adapter-context";

/** Native Poetry has already matched names, constraints and source identities.
 * Preserve every alternative with markers; this is not an installed environment. */
export function resolvePoetry(data: Record<string, unknown>, ctx: AdapterContext) {
  if (data.formatVersion !== 1 || object(object(data.lock).metadata)["lock-version"] !== "2.1") throw new Error("Unsupported Poetry capture format");
  const metadata = list(object(data.lock).package).map((p) => object(p));
  const packages = list(data.packages).map((p) => object(p));
  if (packages.length !== metadata.length) throw new Error("Poetry native/lock package count mismatch");
  const root = object(data.root);
  const directory = text(data.sourceDirectory);
  if (ctx.input.rootNames.some((name) => name !== root.name)) throw new Error("Selected Poetry root is absent");
  ctx.node("root", text(root.name), text(root.version), `source:${ctx.input.revision}:${directory}`, null);
  if (ctx.input.rootNames.includes(text(root.name))) ctx.root("root");
  for (const [i, pkg] of packages.entries()) {
    const entry = metadata[i];
    if (pkg.id !== String(i) || pkg.version !== entry.version || text(pkg.name) !== text(entry.name).toLowerCase().replace(/[-_.]+/g, "-")) throw new Error("Poetry native package identity differs from lock");
    const source = entry.source ? canonical(entry.source) : canonical({ registry: "https://pypi.org/simple" });
    // Hashes are for candidate wheels/sdists, never one installed distribution.
    ctx.node(`package:${i}`, text(pkg.name), text(pkg.version), source, null);
  }
  function dependencies(from: string, pkg: Record<string, unknown>) {
    for (const raw of list(pkg.dependencies)) {
      const dep = object(raw);
      const targets = list(dep.targets).map((id) => text(id));
      if (!targets.length) ctx.gap(`Poetry dependency ${text(dep.name)} ${text(dep.constraint)} from ${from} has no locked match.`);
      for (const target of targets) {
        const entry = metadata[Number(target)];
        if (!entry || !/^\d+$/.test(target)) throw new Error("Invalid Poetry dependency target");
        const native = object(dep.condition);
        const conditions = [native.marker !== "" ? `marker:${text(native.marker)}` : null, native.python !== "*" ? `python:${text(native.python)}` : null, ...["extras", "inExtras"].filter((key) => list(native[key]).length).map((key) => `${key}:${canonical(native[key])}`), entry.markers ? `locked markers:${canonical(entry.markers)}` : null, entry["python-versions"] !== "*" ? `locked python:${text(entry["python-versions"])}` : null, targets.length > 1 ? "alternative locked selection" : null].filter(Boolean);
        for (const group of list(dep.groups).map((g) => text(g))) {
          const groupConditions = [...conditions, ...(group === "main" ? [] : [`dependency group:${group}`]), ...(dep.optional === true || entry.optional === true ? ["optional dependency / extra activation unverified"] : [])];
          ctx.edge(from, `package:${target}`, group === "main" ? "runtime" : "development", dep.optional === true || groupConditions.length > 0, groupConditions.join("; ") || null, text(dep.constraint));
        }
      }
    }
  }
  dependencies("root", root);
  packages.forEach((pkg, i) => dependencies(`package:${i}`, pkg));
  ctx.gap("Poetry lock retains all packages, groups, markers, extras and candidate distribution hashes. Target Python/platform and extra activation are not evaluated; installed wheel/sdist selection, build-backend dependencies, native libraries and published artifact correspondence remain unverified.");
}
