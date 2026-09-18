import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { esternalizza, getAggregato, getCapacita, getDettaglio, getReparti, sposta } from './api/caricoApi';
import type { Capacita, CaricoAggregato, Reparto, UnitaPianificabile, UnitaSelezionata, Vista } from './types';
import { addDays, chiaveUnita, startOfMonth, startOfWeek, toIsoDate } from './types';
import RepartoTabs from './components/RepartoTabs';
import VistaToggle from './components/VistaToggle';
import CaricoChart from './components/CaricoChart';
import GriglioGiorno from './components/GriglioGiorno';
import SpostaDataDialog from './components/SpostaDataDialog';
import ReportStampa from './components/ReportStampa';

function calcolaRange(vista: Vista, ancora: Date): { dal: Date; al: Date } {
  if (vista === 'giorno') {
    return { dal: addDays(ancora, -3), al: addDays(ancora, 10) };
  }
  if (vista === 'settimana') {
    const iniziosettimana = startOfWeek(ancora);
    return { dal: addDays(iniziosettimana, -14), al: addDays(iniziosettimana, 12 * 7 - 1) };
  }
  const inizioMese = startOfMonth(ancora);
  const dal = new Date(inizioMese);
  dal.setMonth(dal.getMonth() - 2);
  const al = new Date(inizioMese);
  al.setMonth(al.getMonth() + 10);
  al.setDate(0); // ultimo giorno del mese precedente al successivo
  return { dal, al };
}

function spostaAncora(vista: Vista, ancora: Date, direzione: 1 | -1): Date {
  if (vista === 'giorno') return addDays(ancora, direzione * 14);
  if (vista === 'settimana') return addDays(ancora, direzione * 12 * 7);
  const r = new Date(ancora);
  r.setMonth(r.getMonth() + direzione * 12);
  return r;
}

function differenzaGiorni(isoA: string, isoB: string): number {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function App() {
  const [reparti, setReparti] = useState<Reparto[]>([]);
  const [repartoSelezionato, setRepartoSelezionato] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('giorno');
  const [ancora, setAncora] = useState<Date>(new Date());
  const [aggregato, setAggregato] = useState<CaricoAggregato[]>([]);
  const [capacita, setCapacita] = useState<Capacita[]>([]);
  const [dettaglio, setDettaglio] = useState<UnitaPianificabile[]>([]);
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [dialogAperto, setDialogAperto] = useState(false);
  const [giornoReport, setGiornoReport] = useState<string | null>(null);

  const { dal, al } = useMemo(() => calcolaRange(vista, ancora), [vista, ancora]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    getReparti().then(setReparti);
  }, []);

  const ricaricaAggregato = useCallback(() => {
    getAggregato(vista, toIsoDate(dal), toIsoDate(al), repartoSelezionato ?? undefined).then(setAggregato);
    getCapacita(vista, toIsoDate(dal), toIsoDate(al), repartoSelezionato ?? undefined).then(setCapacita);
  }, [vista, dal, al, repartoSelezionato]);

  const ricaricaDettaglio = useCallback(() => {
    if (vista === 'giorno' && repartoSelezionato) {
      getDettaglio(toIsoDate(dal), toIsoDate(al), repartoSelezionato).then(setDettaglio);
    } else {
      setDettaglio([]);
    }
  }, [vista, dal, al, repartoSelezionato]);

  useEffect(() => { ricaricaAggregato(); }, [ricaricaAggregato]);
  useEffect(() => { ricaricaDettaglio(); setSelezione(new Set()); }, [ricaricaDettaglio]);

  const giorni = useMemo(() => {
    const arr: Date[] = [];
    for (let d = new Date(dal); d <= al; d = addDays(d, 1)) arr.push(new Date(d));
    return arr;
  }, [dal, al]);

  // Monte ore per giorno del reparto selezionato: in vista giorno /capacita e' gia' aggregata
  // per singolo giorno, quindi la stessa risposta che alimenta il grafico serve anche gli header
  // delle colonne (nessuna chiamata aggiuntiva).
  const capacitaPerGiorno = useMemo(() => {
    const m = new Map<string, number>();
    if (vista !== 'giorno') return m;
    for (const c of capacita) {
      const iso = c.periodo.slice(0, 10);
      m.set(iso, (m.get(iso) ?? 0) + c.secondiDisponibili);
    }
    return m;
  }, [capacita, vista]);

  const perChiave = useMemo(() => {
    const m = new Map<string, UnitaPianificabile>();
    for (const u of dettaglio) m.set(chiaveUnita(u), u);
    return m;
  }, [dettaglio]);

  const toggleSelezione = useCallback((chiave: string) => {
    setSelezione((prev) => {
      const next = new Set(prev);
      if (next.has(chiave)) next.delete(chiave); else next.add(chiave);
      return next;
    });
  }, []);

  const eseguiSpostamento = useCallback(async (chiavi: string[], deltaGiorni: number) => {
    if (deltaGiorni === 0 || chiavi.length === 0) return;
    const unitaSelezionate: UnitaSelezionata[] = chiavi
      .map((c) => perChiave.get(c))
      .filter((u): u is UnitaPianificabile => !!u)
      .map((u) => ({ tipo: u.tipo, idLav: u.idLav, olCod: u.olCod }));

    // aggiornamento ottimistico locale per una risposta immediata
    setDettaglio((prev) => prev.map((u) => {
      if (!chiavi.includes(chiaveUnita(u))) return u;
      const nuovaData = addDays(new Date(u.dataEffettiva), deltaGiorni);
      return { ...u, dataEffettiva: toIsoDate(nuovaData) };
    }));
    setSelezione(new Set());

    await sposta({ unita: unitaSelezionate, deltaGiorni });
    ricaricaAggregato();
    ricaricaDettaglio();
  }, [perChiave, ricaricaAggregato, ricaricaDettaglio]);

  const eseguiEsternalizzazione = useCallback(async (chiavi: string[], esterna: boolean) => {
    if (chiavi.length === 0) return;
    const unitaSelezionate: UnitaSelezionata[] = chiavi
      .map((c) => perChiave.get(c))
      .filter((u): u is UnitaPianificabile => !!u)
      .map((u) => ({ tipo: u.tipo, idLav: u.idLav, olCod: u.olCod }));

    setSelezione(new Set());
    await esternalizza({ unita: unitaSelezionate, esterna });
    ricaricaDettaglio();
  }, [perChiave, ricaricaDettaglio]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const draggedUnita = (active.data.current as { unita?: UnitaPianificabile } | undefined)?.unita;
    if (!draggedUnita) return;
    const draggedChiave = chiaveUnita(draggedUnita);
    const sourceIso = draggedUnita.dataEffettiva.slice(0, 10);
    const targetIso = String(over.id);
    const delta = differenzaGiorni(sourceIso, targetIso);
    if (delta === 0) return;

    const chiavi = selezione.has(draggedChiave) && selezione.size > 0
      ? Array.from(selezione)
      : [draggedChiave];

    eseguiSpostamento(chiavi, delta);
  }, [selezione, eseguiSpostamento]);

  const chiaviSelezionate = Array.from(selezione);
  const unitaSelezionate = chiaviSelezionate.map((c) => perChiave.get(c)).filter((u): u is UnitaPianificabile => !!u);
  const dataRiferimentoSelezione = unitaSelezionate.length > 0
    ? unitaSelezionate.reduce((min, u) => (u.dataEffettiva < min ? u.dataEffettiva : min), unitaSelezionate[0].dataEffettiva).slice(0, 10)
    : toIsoDate(new Date());

  const etichettaPeriodo = `${dal.toLocaleDateString('it-IT')} – ${al.toLocaleDateString('it-IT')}`;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Carico Reparti</h1>
      </header>

      <RepartoTabs reparti={reparti} selezionato={repartoSelezionato} onSeleziona={setRepartoSelezionato} />

      <VistaToggle
        vista={vista}
        onVista={setVista}
        onPrecedente={() => setAncora((a) => spostaAncora(vista, a, -1))}
        onSuccessivo={() => setAncora((a) => spostaAncora(vista, a, 1))}
        onOggi={() => setAncora(new Date())}
        etichettaPeriodo={etichettaPeriodo}
      />

      <CaricoChart
        dati={aggregato}
        capacita={capacita}
        reparti={reparti}
        vista={vista}
        onClickPeriodo={(periodoIso) => {
          setAncora(new Date(periodoIso));
          setVista('giorno');
        }}
      />

      {vista === 'giorno' && !repartoSelezionato && (
        <div className="hint-box">Seleziona un reparto per pianificare le date delle lavorazioni.</div>
      )}

      {vista === 'giorno' && repartoSelezionato && (
        <>
          <div className="toolbar-selezione">
            <span>{selezione.size} selezionati</span>
            <button
              className="btn-primario"
              disabled={selezione.size === 0}
              onClick={() => setDialogAperto(true)}
            >
              Sposta selezionati…
            </button>
            <button
              className="btn-secondario"
              disabled={selezione.size === 0}
              onClick={() => eseguiEsternalizzazione(chiaviSelezionate, true)}
              title="Applica solo alle lavorazioni con fornitura modificabile"
            >
              Esternalizza
            </button>
            <button
              className="btn-secondario"
              disabled={selezione.size === 0}
              onClick={() => eseguiEsternalizzazione(chiaviSelezionate, false)}
              title="Applica solo alle lavorazioni con fornitura modificabile"
            >
              Internalizza
            </button>
          </div>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <GriglioGiorno
              giorni={giorni}
              unita={dettaglio}
              capacitaPerGiorno={capacitaPerGiorno}
              selezione={selezione}
              onToggleSelezione={toggleSelezione}
              onStampa={setGiornoReport}
            />
          </DndContext>
        </>
      )}

      <ReportStampa
        aperto={giornoReport !== null}
        reparto={reparti.find((r) => r.suffisso === repartoSelezionato)?.descrizione ?? repartoSelezionato ?? ''}
        giornoIso={giornoReport ?? toIsoDate(new Date())}
        unita={dettaglio.filter((u) => u.dataEffettiva.slice(0, 10) === giornoReport)}
        onChiudi={() => setGiornoReport(null)}
      />

      <SpostaDataDialog
        aperto={dialogAperto}
        numSelezionati={selezione.size}
        dataRiferimento={dataRiferimentoSelezione}
        onChiudi={() => setDialogAperto(false)}
        onConferma={(nuovaDataIso) => {
          const delta = differenzaGiorni(dataRiferimentoSelezione, nuovaDataIso);
          setDialogAperto(false);
          eseguiSpostamento(chiaviSelezionate, delta);
        }}
      />
    </div>
  );
}
