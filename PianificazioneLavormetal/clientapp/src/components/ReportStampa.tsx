import { useEffect, useRef } from 'react';
import type { UnitaPianificabile } from '../types';
import { formatDataBreve, formatOre } from '../types';

interface Props {
  aperto: boolean;
  reparto: string;
  giornoIso: string; // ISO date
  unita: UnitaPianificabile[];
  onChiudi: () => void;
}

export default function ReportStampa({ aperto, reparto, giornoIso, unita, onChiudi }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (aperto) ref.current?.showModal();
    else ref.current?.close();
  }, [aperto]);

  const totaleSecondi = unita.reduce((s, u) => s + u.secondiPrevisti, 0);
  const dataFormattata = new Date(giornoIso).toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <dialog ref={ref} className="report-dialog" onClose={onChiudi}>
      <div className="report-stampa-contenuto">
        <div className="report-azioni-no-stampa">
          <button className="btn-secondario" onClick={onChiudi}>Chiudi</button>
          <button className="btn-primario" onClick={() => window.print()}>Stampa</button>
        </div>

        <h2>Reparto: {reparto}</h2>
        <p className="report-sottotitolo">{dataFormattata} — {unita.length} lavorazioni — {formatOre(totaleSecondi)} totali</p>

        <table className="report-tabella">
          <thead>
            <tr>
              <th>Descrizione</th>
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
                <td>{formatOre(u.secondiPrevisti)}</td>
                <td>{u.commessaCod ?? ''}</td>
                <td>{u.clienteDsc ?? ''}</td>
                <td>{u.scadenza ? formatDataBreve(u.scadenza) : ''}</td>
                <td>{u.esterna === 'E' ? 'E' : ''}</td>
              </tr>
            ))}
            {unita.length === 0 && (
              <tr><td colSpan={6} className="report-vuoto">Nessuna lavorazione in questo giorno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
