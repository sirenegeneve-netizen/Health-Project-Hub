import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Test de COUVERTURE : aucune route API ne peut être ajoutée ou modifiée sans contrôle d'accès serveur (ou exception justifiée
// par un commentaire « authz-exempt: raison »). Fonctionne sans base de données.
const ROOT = "src/app/api";
const GUARDS = ["guardRecord(", "guardCreate(", "guardLink(", "guardInitiativeCreate(", "guardInitiative(", "guardGroup(", "guardEstablishment(",
  "guardOwner(", "guardCycle(", "guardScope(", "guardAuthenticated(", "requireConfigAccess(", "assertAdmin(", "canGlobally(", "authz-exempt:", "handleDelete(", "handlePreview("];
const WRITES = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$transaction\(/;

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? routes(p) : f === "route.ts" ? [p] : [];
  });
}

interface Handler { file: string; method: string; text: string }
function handlers(): Handler[] {
  const out: Handler[] = [];
  for (const file of routes(ROOT)) {
    const src = readFileSync(file, "utf8");
    const ms = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g)];
    ms.forEach((m, i) => out.push({ file, method: m[1], text: src.slice(m.index! + m[0].length, i + 1 < ms.length ? ms[i + 1].index : src.length) }));
  }
  return out;
}

test("toutes les routes API ont un contrôle d'accès serveur ou une exception justifiée", () => {
  const hs = handlers();
  assert.ok(hs.length > 100, `routes détectées : ${hs.length}`);
  const missing = hs.filter((h) => !GUARDS.some((g) => h.text.includes(g))).map((h) => `${h.method} ${h.file.replace(ROOT + "/", "")}`);
  assert.deepEqual(missing, [], `routes sans contrôle d'accès :\n${missing.join("\n")}`);
});

test("le contrôle d'accès précède toute écriture en base dans le handler", () => {
  const bad: string[] = [];
  for (const h of handlers()) {
    if (h.text.includes("authz-exempt:") || h.text.includes("handleDelete(") || h.text.includes("assertAdmin(") || h.text.includes("requireConfigAccess(")) continue;
    const g = Math.min(...GUARDS.map((x) => h.text.indexOf(x)).filter((i) => i >= 0));
    const w = h.text.search(WRITES);
    if (w >= 0 && w < g) bad.push(`${h.method} ${h.file.replace(ROOT + "/", "")}`);
  }
  assert.deepEqual(bad, [], `écriture avant contrôle :\n${bad.join("\n")}`);
});

test("les exceptions sont justifiées par une raison explicite", () => {
  for (const h of handlers()) {
    const m = h.text.match(/authz-exempt:\s*(.*)/);
    if (m) assert.ok(m[1].trim().length >= 15, `raison trop courte : ${h.method} ${h.file}`);
  }
});

test("aucune route de données n'utilise requireUser seul pour décider de l'accès", () => {
  const onlyAuth = handlers().filter((h) => h.text.includes("requireUser(") && !GUARDS.some((g) => h.text.includes(g)));
  assert.equal(onlyAuth.length, 0);
});
