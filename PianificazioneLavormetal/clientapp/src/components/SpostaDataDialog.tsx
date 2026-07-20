import { useEffect, useRef, useState } from 'react';

interface Props {
  aperto: boolean;
  numSelezionati: number;
  dataRiferimento: string; // ISO, data minima tra le unita' selezionate
  onConferma: (nuovaDataIso: string) => void;
  onChiudi: () => void;
}

export default function SpostaDataDialog({
  aperto, numSelezionati, dataRiferimento, onConferma, onChiudi,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [nuovaData, setNuovaData] = useState(dataRiferimento);

  useEffect(() => {
    if (aperto) {
      setNuovaData(dataRiferimento);
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [aperto, dataRiferimento]);

  return (
    <dialog ref={ref} className="sposta-dialog" onClose={onChiudi}>
      <h3>Sposta {numSelezionati} {numSelezionati === 1 ? 'elemento' : 'elementi'}</h3>
      <p>La nuova data si applica all'elemento di riferimento (il piu' anticipato tra i selezionati); gli altri mantengono la stessa distanza in giorni.</p>
      <label className="sposta-dialog-label">
        Nuova data
        <input
          type="date"
          value={nuovaData}
          onChange={(e) => setNuovaData(e.target.value)}
        />
      </label>
      <div className="sposta-dialog-azioni">
        <button className="btn-secondario" onClick={onChiudi}>Annulla</button>
        <button
          className="btn-primario"
          onClick={() => {
            if (nuovaData) onConferma(nuovaData);
          }}
        >
          Sposta
        </button>
      </div>
    </dialog>
  );
}
