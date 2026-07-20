import type { Capacita, CaricoAggregato, EsternalizzaRequest, Reparto, SpostaRequest, UnitaPianificabile, Vista } from '../types';

const BASE = 'api/carico';

export async function getReparti(): Promise<Reparto[]> {
  const r = await fetch(`${BASE}/reparti`);
  return r.json();
}

export async function getAggregato(
  vista: Vista, dal: string, al: string, suffisso?: string
): Promise<CaricoAggregato[]> {
  const params = new URLSearchParams({ granularita: vista, dal, al });
  if (suffisso) params.set('suffisso', suffisso);
  const r = await fetch(`${BASE}/aggregato?${params}`);
  return r.json();
}

export async function getCapacita(
  vista: Vista, dal: string, al: string, suffisso?: string
): Promise<Capacita[]> {
  const params = new URLSearchParams({ granularita: vista, dal, al });
  if (suffisso) params.set('suffisso', suffisso);
  const r = await fetch(`${BASE}/capacita?${params}`);
  return r.json();
}

export async function getDettaglio(
  dal: string, al: string, suffisso?: string
): Promise<UnitaPianificabile[]> {
  const params = new URLSearchParams({ dal, al });
  if (suffisso) params.set('suffisso', suffisso);
  const r = await fetch(`${BASE}/dettaglio?${params}`);
  return r.json();
}

export async function sposta(req: SpostaRequest): Promise<void> {
  await fetch(`${BASE}/sposta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function esternalizza(req: EsternalizzaRequest): Promise<void> {
  await fetch(`${BASE}/esternalizza`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}
