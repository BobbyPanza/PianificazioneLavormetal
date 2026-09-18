import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { UnitaPianificabile } from '../types';
import { chiaveUnita, formatDataBreve, formatOre } from '../types';

interface Props {
  unita: UnitaPianificabile;
  selezionata: boolean;
  onToggleSelezione: (chiave: string) => void;
}

export default function LavorazioneCard({ unita, selezionata, onToggleSelezione }: Props) {
  const chiave = chiaveUnita(unita);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chiave,
    data: { unita },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  // Lavorazione singola: la commessa/cliente e' l'informazione rilevante (titolo).
  // Gruppo/nesting: il piano di lavoro e' il titolo, la bolla (OLCOD) resta visibile sotto.
  const titolo = unita.tipo === 'GRUPPO'
    ? (unita.pianoDiLavoro ?? unita.olCod ?? unita.descrizione)
    : (unita.clienteDsc ?? unita.commessaCod ?? unita.descrizione);
  const sottotitolo = unita.tipo === 'GRUPPO'
    ? `Bolla ${unita.olCod}`
    : unita.descrizione;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`carico-card ${selezionata ? 'carico-card-selezionata' : ''} ${unita.tipo === 'GRUPPO' ? 'carico-card-gruppo' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelezione(chiave);
      }}
      title={unita.commessaCod
        ? `Commessa ${unita.commessaCod}${unita.clienteDsc ? ` — ${unita.clienteDsc}` : ''}${unita.articolo ? `\nArticolo ${unita.articolo}${unita.articoloDsc ? ` — ${unita.articoloDsc}` : ''}` : ''}${unita.scadenza ? `\nScadenza ${formatDataBreve(unita.scadenza)}` : ''}`
        : undefined}
    >
      <div className="carico-card-badge-riga">
        {unita.tipo === 'GRUPPO' && unita.idNes != null && <span className="badge-gruppo">NST</span>}
        {unita.esterna === 'E' && <span className="badge-esterna">ESTERNA</span>}
      </div>
      <div className="carico-card-desc">{titolo}</div>
      <div className="carico-card-sotto">{sottotitolo}</div>
      {unita.articolo && (
        <div className="carico-card-articolo" title={unita.articoloDsc ?? unita.articolo}>
          🔩 {unita.articolo}
        </div>
      )}
      <div className="carico-card-meta">
        {formatOre(unita.secondiPrevisti)}
        {unita.numLavorazioni > 1 ? ` · ${unita.numLavorazioni} lav.` : ''}
      </div>
      {unita.tipo === 'GRUPPO' && unita.commessaCod && (
        <div className="carico-card-commessa">
          {unita.clienteDsc ?? unita.commessaCod}
          {unita.scadenza ? ` · ${formatDataBreve(unita.scadenza)}` : ''}
        </div>
      )}
      {unita.tipo === 'LAVORAZIONE' && unita.scadenza && (
        <div className="carico-card-commessa">
          {unita.commessaCod ? `${unita.commessaCod} · ` : ''}{formatDataBreve(unita.scadenza)}
        </div>
      )}
    </div>
  );
}
