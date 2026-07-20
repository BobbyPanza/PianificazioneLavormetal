# Changelog

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
