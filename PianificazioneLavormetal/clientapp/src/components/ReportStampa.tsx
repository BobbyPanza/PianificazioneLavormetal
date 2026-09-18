import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { UnitaPianificabile } from '../types';
import { formatDataBreve, formatOre } from '../types';

interface Props {
  aperto: boolean;
  reparto: string;
  giornoIso: string; // ISO date
  unita: UnitaPianificabile[];
  onChiudi: () => void;
}

// NB: il report NON usa <dialog>/showModal(): un dialog modale finisce nel "top layer" del
// browser, che Chrome non impagina in stampa (si ottiene la prima pagina tagliata seguita da
// decine di pagine bianche, perche' il resto del documento resta comunque nel flusso). Qui il
// pannello e' un normale overlay in portale su document.body, cosi' in @media print basta
// nascondere #root e stampare il solo contenuto del report.
export default function ReportStampa({ aperto, reparto, giornoIso, unita, onChiudi }: Props) {
  useEffect(() => {
    if (!aperto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  const totaleSecondi = unita.reduce((s, u) => s + u.secondiPrevisti, 0);
  const dataFormattata = new Date(giornoIso).toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return createPortal(
    <div className="report-overlay" onClick={onChiudi}>
      <div className="report-pannello" onClick={(e) => e.stopPropagation()}>
        <div className="report-azioni-no-stampa">
          <button className="btn-secondario" onClick={onChiudi}>Chiudi</button>
          <button className="btn-primario" onClick={() => window.print()}>Stampa</button>
        </div>

        <div className="report-stampa-contenuto">
          <h2>Reparto: {reparto}</h2>
          <p className="report-sottotitolo">{dataFormattata} — {unita.length} lavorazioni — {formatOre(totaleSecondi)} totali</p>

          <table className="report-tabella">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th>Articolo</th>
                <th>Ore</th>
                <th>Commessa</th>
                <th>Cliente</th>
                <th>Scadenza</th>
                <th>Est.</th>
              </tr>
            </thead>
            <tbody>
              {unita.map((u) => (
                <tr key={u.tipo === 'GRUPPO' ? `G_${u.olCod}` : `L_${u.idLav}`}>
                  <td>
                    {u.tipo === 'GRUPPO' ? (u.pianoDiLavoro ?? u.olCod) : u.descrizione}
                    {u.tipo === 'GRUPPO' && <span className="report-bolla"> (bolla {u.olCod})</span>}
                  </td>
                  <td title={u.articoloDsc ?? ''}>{u.articolo ?? ''}</td>
                  <td>{formatOre(u.secondiPrevisti)}</td>
                  <td>{u.commessaCod ?? ''}</td>
                  <td>{u.clienteDsc ?? ''}</td>
                  <td>{u.scadenza ? formatDataBreve(u.scadenza) : ''}</td>
                  <td>{u.esterna === 'E' ? 'E' : ''}</td>
                </tr>
              ))}
              {unita.length === 0 && (
                <tr><td colSpan={7} className="report-vuoto">Nessuna lavorazione in questo giorno.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
