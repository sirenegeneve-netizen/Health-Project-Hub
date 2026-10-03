// Petit utilitaire fetch partagé par les écrans de configuration des projets.
export async function callApi(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, data, error: data?.error || `Erreur ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, data: null, error: "Erreur réseau." };
  }
}
