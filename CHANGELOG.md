# Changelog

## Non rilasciato

- **Fix script viste su SQL Server 2016 RTM**: `XVIEW_CARICO_LAV.sql` e
  `XVIEW_CARICO_COMMESSA.sql` usavano `CREATE OR ALTER`, disponibile solo da 2016 SP1 (il
  server del cliente è RTM). Ora fanno `DROP` + `CREATE` in due batch.
- `appsettings.json` (configurazione locale con le credenziali) non finisce più nel pacchetto
  di pubblicazione: sul server si parte da `appsettings.template.json`.

- `X_REP_SUFFISSO` diventa l'anagrafica dei suffissi di reparto: nuova colonna `X_Descrizione`
  (l'etichetta dei filtri/tab, prima hard-coded nel codice C#) e chiave primaria spostata da
  `RECOD` a `X_Suffisso`, con `RECOD` ora opzionale. Sono stati aggiunti i suffissi finora non
  gestiti — `M` Lavorazioni Meccaniche, `V` Trattamenti/Verniciatura, `Q` Controllo Qualità,
  `(N/D)` Non assegnato — che non hanno un reparto `A_REP` corrispondente: compaiono nei filtri
  ma restano senza linea di disponibilità oraria nel grafico.
  **Aggiornamento**: rieseguire `Scripts/Install_X_REP_SUFFISSO.sql` (migra la struttura
  esistente e ripopola; stampa anche l'elenco dei suffissi usati in `A_FAS` ma non mappati).

- Codice articolo (`A_LOT.PACOD`) sulle card delle lavorazioni singole e nel report stampabile;
  descrizione articolo (`PADSC`) nel tooltip. Sulle bolle compare solo se l'articolo è unico per
  tutta la bolla.
  **Aggiornamento**: rieseguire `Scripts/XVIEW_CARICO_COMMESSA.sql` (nuove colonne
  `Articolo`/`ArticoloDsc`).
- Monte ore del reparto nell'header di ogni colonna giorno ("ore caricate / ore disponibili",
  in rosso quando si sfora). Nessuna chiamata aggiuntiva: usa la stessa `/capacita` del grafico.
- **Fix stampa report**: il report non usa piu' `<dialog>`/`showModal()` ma un overlay in
  portale. Il dialog modale finiva nel top layer del browser, che Chrome non impagina: si
  stampava la prima pagina tagliata seguita da decine di pagine bianche.

## v1.0.0 — 2026-07-20

Prima versione funzionante.

- Visualizzazione carico di lavoro per reparto (Giorno / Settimana / Mese), grafico a piccoli
  multipli con "gobba di saturazione" per reparto.
- Disponibilità oraria per reparto (operatori L_REOP/A_OPR → `dbo.ComputeCalendarTime`)
  sovrapposta al grafico.
- Drag&drop, selezione multipla e calendario per spostare la data prevista delle lavorazioni.
- Gestione bolle/nesting (taglio laser): ripartizione proporzionale del carico su più bolle,
  piano di lavoro in evidenza, badge NST.
- Info commessa/cliente/scadenza sulle card (in evidenza per le lavorazioni singole).
- Esternalizza/Internalizza lavorazioni (FAEXE), solo se fornitura modificabile (FAEXM).
- Le lavorazioni scadute vengono mostrate "a oggi" nel grafico/griglia (nessuna scrittura sui
  dati, solo visualizzazione).
- Report stampabile per reparto/giorno.
- Audit trail di ogni spostamento in `X_CARICO_LOG`.
