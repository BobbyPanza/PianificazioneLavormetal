# Carico Reparti — Lavormetal

Visualizzazione e pianificazione del carico di lavoro per reparto (Giorno / Settimana / Mese),
con grafico di saturazione (carico vs disponibilità oraria) e possibilità di spostare la data
di inizio prevista delle lavorazioni (drag&drop, selezione multipla, calendario).

Il carico considera tutte le lavorazioni (`A_LAV`) con stato `LASTO <= 43` (Rilasciata /
Pianificata / Aperta), raggruppate per reparto tramite `A_FAS.X_Suffisso` (join su `FACOD`);
i nomi dei reparti mostrati nei filtri arrivano da `X_REP_SUFFISSO.X_Descrizione`.
Per le lavorazioni di taglio laser collegate a un piano di lavoro (`L_ODLA`/`S_ODL`/`A_NES`),
la data e i secondi previsti vengono ripartiti proporzionalmente tra le bolle collegate — vedi
i commenti in `Scripts/XVIEW_CARICO_LAV.sql`.

---

## Installazione

### 1. .NET Hosting Bundle

Installa il .NET Hosting Bundle (.NET 10) sul server e riavvia IIS.

### 2. Script SQL

Nella cartella `Scripts\` esegui in SSMS, **in questo ordine**, sul database del cliente
(`Factory` o equivalente):

1. `Install_PianificazioneLavormetal.sql` — crea `X_CARICO_LOG` (audit trail degli
   spostamenti) e alcuni indici di supporto su `A_LAV`/`A_NES` (idempotente, verifica anche
   che le tabelle ERP attese esistano).
2. `XVIEW_CARICO_LAV.sql` — crea/aggiorna la vista principale `XVIEW_CARICO_LAV`.
3. `XVIEW_CARICO_COMMESSA.sql` — crea la vista per commessa/cliente/scadenza (usata solo nel
   dettaglio giornaliero, tenuta separata per non appesantire l'aggregazione del grafico).
4. `Install_X_REP_SUFFISSO.sql` — crea e popola `X_REP_SUFFISSO`, l'anagrafica dei suffissi di
   reparto: per ogni `A_FAS.X_Suffisso` la descrizione mostrata nei filtri/tab della
   pianificazione (`X_Descrizione`) e, se esiste, il reparto `A_REP.RECOD` corrispondente —
   quest'ultimo serve solo alla disponibilità oraria. `RECOD` può essere `NULL`: i suffissi
   senza reparto (lavorazioni esterne, fasi non assegnate) compaiono comunque nei filtri, ma
   senza linea di disponibilità nel grafico.
   **Verifica i due riepiloghi stampati dallo script**: se i codici RECOD del cliente sono
   diversi da `01`..`05`, o se il secondo elenco mostra suffissi usati in `A_FAS` ma non
   mappati (comparirebbero nei filtri con la sola sigla), aggiorna la sezione `MERGE` dello
   script e rieseguilo. Lo script è la fonte di verità: a ogni esecuzione riallinea le
   descrizioni, quindi le modifiche fatte a mano sulla tabella vanno perse.

**NON eseguire** `OneShot_AllineaDateScadute.sql` per ora — è lo script una tantum che sposta
a oggi tutte le lavorazioni/nesting con data prevista scaduta (`A_LAV.LADIP` / `A_NES.DTEXP`).
Va eseguito solo su richiesta esplicita, quando si decide di allineare i dati reali; la vista
già "clampa" visivamente le date scadute a oggi senza bisogno di questo script.

### 3. Configura appsettings.json

Copia `appsettings.template.json` come `appsettings.json` nella cartella del progetto e compila:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=NOMESERVER;Database=Factory;User=sa;Password=...;TrustServerCertificate=True;"
  },
  "BasePath": "/CaricoReparti/"
}
```

| Chiave | Descrizione |
|---|---|
| `DefaultConnection` | Stringa di connessione al database |
| `BasePath` | Sottocartella IIS (es. `/CaricoReparti/`) — usata per iniettare `<base href>` |

### 4. Build frontend + pubblicazione

```
cd PianificazioneLavormetal/clientapp
npm install
npm run build          # popola ../wwwroot
cd ..
dotnet publish -c Release
```

### 5. IIS

Estrai il pacchetto di pubblicazione, puntaci un sito/sotto-applicazione IIS, imposta
sull'application pool **Versione .NET CLR → Nessun codice gestito**.

### 6. Verifica rapida post-installazione

- Apri l'app: i tab reparto (Taglio, Punzonatura, Piega e Pannellatura, Saldatura,
  Assemblaggio, Non assegnato) devono essere popolati.
- Seleziona un reparto in vista Giorno: deve comparire il grafico con eventualmente la linea
  tratteggiata di disponibilità (se `X_REP_SUFFISSO`/`L_REOP` sono popolati correttamente per
  quel cliente) e la griglia drag&drop sotto. Nell'header di ogni colonna giorno il monte ore
  compare come `ore caricate / ore disponibili`: se manca la seconda cifra, quel reparto non ha
  operatori in `L_REOP`.
- Prova a spostare una card e verifica in `X_CARICO_LOG` che la scrittura sia stata loggata.

---

## Logica di scrittura (spostamento date)

Quando si sposta una lavorazione:

- **Lavorazione singola** (non collegata a nessuna bolla): aggiorna `A_LAV.LADIP`.
- **Gruppo con nesting attivo e `DTEXP` valorizzato**: aggiorna `A_NES.DTEXP` (l'intero gruppo
  si sposta in un colpo).
- **Gruppo senza nesting, o con nesting ma `DTEXP` NULL**: sposta tutte le `A_LAV.LADIP` delle
  lavorazioni collegate alla stessa bolla (`L_ODLA.OLCOD`), mantenendo invariata la distanza
  relativa tra loro.

Le lavorazioni con data scaduta vengono mostrate "a oggi" (`XVIEW_CARICO_LAV`, senza toccare i
dati): il delta di spostamento inviato al backend viene quindi applicato allo stesso valore
"clampato", non alla data grezza, altrimenti un trascinamento su una lavorazione arretrata la
sposterebbe alla data sbagliata (vedi `CaricoRepository.SpostaAsync`).

Ogni scrittura (su `A_LAV.LADIP` o `A_NES.DTEXP`) viene registrata in `X_CARICO_LOG` con
data precedente/nuova, utile per controllo e rollback manuale in caso di errore.

## Esternalizza / Internalizza

Selezionando una o più card e cliccando "Esternalizza"/"Internalizza" si aggiorna `A_LAV.FAEXE`
('E'/'I'). L'operazione si applica **solo** alle lavorazioni con `FAEXM='Y'` (fornitura
modificabile); le altre vengono ignorate silenziosamente.

## Report stampabile

Il pulsante 🖨 su ogni colonna giorno apre un report stampabile (descrizione, articolo, ore,
commessa, cliente, scadenza, esterna) per quel reparto/giorno.

## Codice articolo

Il codice articolo (`A_LOT.PACOD`, con descrizione `PADSC` nel tooltip) viene mostrato sulla card
e nel report. Per una lavorazione singola è l'articolo del suo lotto; per una bolla/gruppo viene
mostrato **solo se tutte le lavorazioni della bolla producono lo stesso articolo** (un nesting può
contenere articoli diversi, in quel caso il campo resta vuoto come già accade per commessa e
cliente).

## Note tecniche

- `L_ODLA` non è 1:1 con `A_LAV`: una lavorazione di taglio laser può essere ripartita su più
  bolle/nesting. La vista `XVIEW_CARICO_LAV` ripartisce i secondi previsti in proporzione a
  `OLQTP` invece di sceglierne una sola — **non usare `A_LAV.OLCOD`** per determinare
  l'appartenenza a una bolla: quel campo è denormalizzato e può riferirsi a una bolla diversa
  da quelle effettivamente in `L_ODLA` per la stessa lavorazione.
- Il badge "NST" compare solo se `L_ODLA.IDNES` è valorizzato per la bolla (nesting
  effettivamente assegnato), non se esiste semplicemente un `A_NES` collegato all'OLCOD.
- Il report stampabile è un overlay in portale su `document.body`, **non** un `<dialog>`
  modale: gli elementi nel top layer del browser non vengono impaginati in stampa (Chrome
  stampa solo la prima pagina, tagliata). In `@media print` si nasconde `#root` e si stampa il
  solo contenuto del portale.
- La disponibilità oraria per reparto si basa sugli **operatori** (`L_REOP`/`A_OPR.IDNUM` →
  `dbo.ComputeCalendarTime`), non sulle macchine: verificare che il cliente abbia operatori
  assegnati ai 6 reparti principali in `L_REOP` (i codici granulari `L_REMA` non sono usati per
  questo calcolo).
- Vincolo di sequenza tra fasi (non spostare una lavorazione oltre una fase successiva già
  pianificata, se non a cascata) è previsto ma non ancora implementato in questa versione.
