import { useDroppable } from '@dnd-kit/core';
import type { UnitaPianificabile } from '../types';
import { chiaveUnita, formatOre, toIsoDate } from '../types';
import LavorazioneCard from './LavorazioneCard';

interface ColonnaProps {
  giorno: Date;
  unita: UnitaPianificabile[];
  selezione: Set<string>;
  onToggleSelezione: (chiave: string) => void;
  onStampa: (giornoIso: string) => void;
}

function Colonna({ giorno, unita, selezione, onToggleSelezione, onStampa }: ColonnaProps) {
  const iso = toIsoDate(giorno);
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const oggi = toIsoDate(new Date()) === iso;
  const totaleSecondi = unita.reduce((s, u) => s + u.secondiPrevisti, 0);

  return (
    <div ref={setNodeRef} className={`giorno-colonna ${isOver ? 'giorno-colonna-over' : ''} ${oggi ? 'giorno-colonna-oggi' : ''}`}>
      <div className="giorno-colonna-header">
        <div>{giorno.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
        <div className="giorno-colonna-totale">{formatOre(totaleSecondi)}</div>
        <button
          className="btn-stampa-giorno"
          onClick={(e) => { e.stopPropagation(); onStampa(iso); }}
          title="Stampa report di questo giorno"
        >
          🖨
        </button>
      </div>
      <div className="giorno-colonna-body">
        {unita.map((u) => (
          <LavorazioneCard
            key={chiaveUnita(u)}
            unita={u}
            selezionata={selezione.has(chiaveUnita(u))}
            onToggleSelezione={onToggleSelezione}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  giorni: Date[];
  unita: UnitaPianificabile[];
  selezione: Set<string>;
  onToggleSelezione: (chiave: string) => void;
  onStampa: (giornoIso: string) => void;
}

export default function GriglioGiorno({ giorni, unita, selezione, onToggleSelezione, onStampa }: Props) {
  const perGiorno = new Map<string, UnitaPianificabile[]>();
  for (const u of unita) {
    const iso = u.dataEffettiva.slice(0, 10);
    if (!perGiorno.has(iso)) perGiorno.set(iso, []);
    perGiorno.get(iso)!.push(u);
  }

  return (
    <div className="griglio-giorno">
      {giorni.map((g) => (
        <Colonna
          key={toIsoDate(g)}
          giorno={g}
          unita={perGiorno.get(toIsoDate(g)) ?? []}
          selezione={selezione}
          onToggleSelezione={onToggleSelezione}
          onStampa={onStampa}
        />
      ))}
    </div>
  );
}
