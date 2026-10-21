#!/usr/bin/env node
// Test de fumée des droits à lancer en PRÉPRODUCTION (base représentative, AUTHZ_MODE=enforce).
// Il se connecte avec plusieurs comptes et vérifie, par appels HTTP directs (donc en manipulant URL et requêtes), qu'un
// utilisateur ne peut ni lire ni modifier les données d'un autre établissement.
//
// Usage : node scripts/authz-smoke.mjs scripts/authz-smoke.config.json
// Voir scripts/authz-smoke.config.example.json. Aucune donnée n'est créée : les écritures testées doivent être REFUSÉES ;
// la seule écriture « autorisée » testée est un PATCH idempotent (mêmes valeurs) sur une ressource de l'utilisateur.
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(process.argv[2] || "scripts/authz-smoke.config.json", "utf8"));
const base = cfg.baseUrl.replace(/\/$/, "");
let failures = 0, checks = 0;

async function login(email, password) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }), redirect: "manual" });
  const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  if (!r.ok || !cookie) throw new Error(`connexion impossible pour ${email} (${r.status})`);
  return cookie;
}
async function call(cookie, method, path, body) {
  const r = await fetch(`${base}${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
function expect(label, got, wanted) {
  checks++;
  const ok = wanted === "refused" ? [401, 403, 404].includes(got) : wanted === "allowed" ? got >= 200 && got < 300 : got === wanted;
  if (!ok) { failures++; console.log(`  ÉCHEC  ${label} → HTTP ${got} (attendu : ${wanted})`); } else console.log(`  ok     ${label} → HTTP ${got}`);
}

for (const user of cfg.users) {
  console.log(`\n== ${user.label} (${user.email})`);
  const cookie = await login(user.email, user.password);
  for (const t of user.mustRead || []) expect(`lecture ${t.path}`, (await call(cookie, "GET", t.path)).status, "allowed");
  for (const t of user.mustNotRead || []) expect(`lecture interdite ${t.path}`, (await call(cookie, "GET", t.path)).status, "refused");
  for (const t of user.mustNotWrite || []) expect(`écriture interdite ${t.method} ${t.path}`, (await call(cookie, t.method, t.path, t.body ?? {})).status, "refused");
  for (const t of user.mayWriteIdempotent || []) expect(`écriture autorisée ${t.method} ${t.path}`, (await call(cookie, t.method, t.path, t.body)).status, "allowed");
}
// Sans session : tout doit être refusé
for (const t of cfg.anonymousMustNotRead || []) expect(`anonyme ${t}`, (await call("", "GET", t)).status, "refused");

console.log(`\n${checks} contrôle(s), ${failures} échec(s)`);
process.exit(failures ? 1 : 0);
