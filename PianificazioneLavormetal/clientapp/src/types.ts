export type Vista = 'giorno' | 'settimana' | 'mese';

export interface Reparto {
  suffisso: string;
  descrizione: string;
  numLavorazioni: number;
  repartiDettaglio: string[];
}

export interface CaricoAggregato {
  suffisso: string;
  periodo: string; // ISO date
  secondiTotali: number;
  numLavorazioni: number;
}

export interface Capacita {
  suffisso: string;
  periodo: string; // ISO date
  secondiDisponibili: number;
}

export type TipoUnita = 'LAVORAZIONE' | 'GRUPPO';

export interface UnitaPianificabile {
  tipo: TipoUnita;
  idLav: number | null;
  olCod: string | null;
  idNes: number | null;
  suffisso: string;
  descrizione: string;
  dataEffettiva: string; // ISO date
  secondiPrevisti: number;
  numLavorazioni: number;
  commessaCod: string | null;
  clienteDsc: string | null;
  scadenza: string | null; // ISO date
  esterna: 'E' | 'I' | null;
  modificabile: 'Y' | 'N' | null;
  pianoDiLavoro: string | null;
}

export interface UnitaSelezionata {
  tipo: TipoUnita;
  idLav?: number | null;
  olCod?: string | null;
}

export interface SpostaRequest {
  unita: UnitaSelezionata[];
  deltaGiorni: number;
}

export interface EsternalizzaRequest {
  unita: UnitaSelezionata[];
  esterna: boolean;
}

export function chiaveUnita(u: UnitaPianificabile): string {
  return u.tipo === 'GRUPPO' ? `G_${u.olCod}` : `L_${u.idLav}`;
}

export function formatOre(secondi: number): string {
  const ore = secondi / 3600;
  return `${ore.toFixed(1)} h`;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, giorni: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + giorni);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // 0 = lunedi'
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function formatDataBreve(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}
