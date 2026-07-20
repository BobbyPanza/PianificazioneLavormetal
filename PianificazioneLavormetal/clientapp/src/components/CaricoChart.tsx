import { useMemo } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Capacita, CaricoAggregato, Reparto, Vista } from '../types';
import { formatDataBreve, formatOre } from '../types';

interface Props {
  dati: CaricoAggregato[];
  capacita: Capacita[];
  reparti: Reparto[];
  vista: Vista;
  onClickPeriodo?: (periodoIso: string) => void;
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#9333ea'];

function formatTick(iso: string, vista: Vista): string {
  const d = new Date(iso);
  if (vista === 'mese') return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  if (vista === 'settimana') return `Sett. ${formatDataBreve(iso)}`;
  return formatDataBreve(iso);
}

interface RigaReparto {
  periodo: string;
  ore: number;
  oreDisponibili?: number;
}

export default function CaricoChart({ dati, capacita, reparti, vista, onClickPeriodo }: Props) {
  const nomiPerSuffisso = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of reparti) m.set(r.suffisso, r.repartiDettaglio);
    return m;
  }, [reparti]);

  const descrizionePerSuffisso = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reparti) m.set(r.suffisso, r.descrizione);
    return m;
  }, [reparti]);

  const perReparto = useMemo(() => {
    const mappa = new Map<string, Map<string, RigaReparto>>();
    const getRiga = (suffisso: string, periodo: string) => {
      if (!mappa.has(suffisso)) mappa.set(suffisso, new Map());
      const perPeriodo = mappa.get(suffisso)!;
      if (!perPeriodo.has(periodo)) perPeriodo.set(periodo, { periodo, ore: 0 });
      return perPeriodo.get(periodo)!;
    };
    for (const d of dati) getRiga(d.suffisso, d.periodo).ore += d.secondiTotali / 3600;
    for (const c of capacita) {
      const riga = getRiga(c.suffisso, c.periodo);
      riga.oreDisponibili = (riga.oreDisponibili ?? 0) + c.secondiDisponibili / 3600;
    }
    const risultato = new Map<string, RigaReparto[]>();
    for (const [suffisso, perPeriodo] of mappa) {
      risultato.set(suffisso, Array.from(perPeriodo.values()).sort((a, b) => a.periodo.localeCompare(b.periodo)));
    }
    return risultato;
  }, [dati, capacita]);

  const tuttiSuffissi = useMemo(() => Array.from(perReparto.keys()).sort(), [perReparto]);

  if (tuttiSuffissi.length === 0) {
    return <div className="chart-vuoto">Nessun dato nel periodo selezionato.</div>;
  }

  const espansa = tuttiSuffissi.length === 1;

  return (
    <div className={espansa ? 'chart-grid chart-grid-singola' : 'chart-grid'}>
      {tuttiSuffissi.map((suffisso) => {
        const righe = perReparto.get(suffisso)!;
        const colore = PALETTE[tuttiSuffissi.indexOf(suffisso) % PALETTE.length];
        const totaleOre = righe.reduce((s, r) => s + r.ore, 0);
        const nomiReparto = nomiPerSuffisso.get(suffisso) ?? [];
        const gradientId = `grad-${suffisso.replace(/[^a-zA-Z0-9]/g, '_')}`;

        return (
          <div key={suffisso} className={espansa ? 'chart-cella chart-cella-espansa' : 'chart-cella'}>
            <div className="chart-cella-header">
              <span className="chart-cella-pallino" style={{ background: colore }} />
              <span className="chart-cella-titolo">{descrizionePerSuffisso.get(suffisso) ?? suffisso}</span>
              <span className="chart-cella-totale">{formatOre(totaleOre * 3600)}</span>
            </div>
            {nomiReparto.length > 0 && (
              <div className="chart-cella-reparti" title={nomiReparto.join(', ')}>
                {nomiReparto.join(', ')}
              </div>
            )}
            <ResponsiveContainer width="100%" height={espansa ? 340 : 180}>
              <ComposedChart
                data={righe}
                onClick={(e) => {
                  const periodo = e?.activeLabel;
                  if (periodo && onClickPeriodo) onClickPeriodo(periodo);
                }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colore} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={colore} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periodo" tickFormatter={(v) => formatTick(v, vista)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={32} />
                <Tooltip
                  labelFormatter={(v) => formatTick(String(v), vista)}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)} h`,
                    name === 'oreDisponibili' ? 'Ore disponibili' : 'Ore previste',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="ore"
                  stroke={colore}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                />
                <Line
                  type="monotone"
                  dataKey="oreDisponibili"
                  stroke="#111827"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
