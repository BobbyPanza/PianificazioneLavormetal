import type { Vista } from '../types';

interface Props {
  vista: Vista;
  onVista: (v: Vista) => void;
  onPrecedente: () => void;
  onSuccessivo: () => void;
  onOggi: () => void;
  etichettaPeriodo: string;
}

const VISTE: { key: Vista; label: string }[] = [
  { key: 'giorno', label: 'Giorno' },
  { key: 'settimana', label: 'Settimana' },
  { key: 'mese', label: 'Mese' },
];

export default function VistaToggle({
  vista, onVista, onPrecedente, onSuccessivo, onOggi, etichettaPeriodo,
}: Props) {
  return (
    <div className="vista-toggle">
      <div className="vista-toggle-buttons">
        {VISTE.map((v) => (
          <button
            key={v.key}
            className={vista === v.key ? 'tab tab-attivo' : 'tab'}
            onClick={() => onVista(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="periodo-nav">
        <button className="btn-icona" onClick={onPrecedente} aria-label="Periodo precedente">◀</button>
        <button className="btn-oggi" onClick={onOggi}>Oggi</button>
        <button className="btn-icona" onClick={onSuccessivo} aria-label="Periodo successivo">▶</button>
        <span className="periodo-label">{etichettaPeriodo}</span>
      </div>
    </div>
  );
}
