// O que dispensaste no Explorar ("não me interessa"). Fica só local, no kv:
// é uma preferência de descoberta, não faz parte da biblioteca nem vale a
// pena ocupar espaço na cloud.
import { kvGet, kvSet } from "./db";

const KEY = "explorar:dispensados";

/** Chave estável por item — o mesmo id pode existir em série e em filme. */
function itemKey(kind: "tv" | "movie", tmdbId: number): string {
  return `${kind}:${tmdbId}`;
}

export async function loadDismissed(): Promise<Set<string>> {
  const stored = await kvGet<string[]>(KEY);
  return new Set(stored ?? []);
}

export async function dismiss(kind: "tv" | "movie", tmdbId: number): Promise<void> {
  const current = await loadDismissed();
  current.add(itemKey(kind, tmdbId));
  await kvSet(KEY, [...current]);
}

export async function undismiss(kind: "tv" | "movie", tmdbId: number): Promise<void> {
  const current = await loadDismissed();
  current.delete(itemKey(kind, tmdbId));
  await kvSet(KEY, [...current]);
}

export function isDismissed(
  set: Set<string>,
  kind: "tv" | "movie",
  tmdbId: number,
): boolean {
  return set.has(itemKey(kind, tmdbId));
}
