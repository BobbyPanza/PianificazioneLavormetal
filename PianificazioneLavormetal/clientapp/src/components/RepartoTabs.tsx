import type { Reparto } from '../types';

interface Props {
  reparti: Reparto[];
  selezionato: string | null;
  onSeleziona: (suffisso: string | null) => void;
}

export default function RepartoTabs({ reparti, selezionato, onSeleziona }: Props) {
  return (
    <div className="reparto-tabs">
      <button
        className={selezionato === null ? 'tab tab-attivo' : 'tab'}
        onClick={() => onSeleziona(null)}
      >
        Tutti i reparti
      </button>
      {reparti.map((r) => (
        <button
          key={r.suffisso}
          className={selezionato === r.suffisso ? 'tab tab-attivo' : 'tab'}
          onClick={() => onSeleziona(r.suffisso)}
          title={[
            `${r.descrizione} — ${r.numLavorazioni} lavorazioni attive`,
            ...(r.repartiDettaglio.length > 0 ? [r.repartiDettaglio.join(', ')] : []),
          ].join('\n')}
        >
          {r.descrizione}
        </button>
      ))}
    </div>
  );
}
