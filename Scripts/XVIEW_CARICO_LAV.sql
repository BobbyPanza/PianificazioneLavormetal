-- Vista base per il carico di lavoro per reparto (PianificazioneLavormetal).
-- Include solo le lavorazioni "attive" (LASTO <= 43: Rilasciata/Pianificata/Aperta).
-- Calcola la data effettiva e i secondi previsti da usare per il grafico e per il drag&drop:
--   - una lavorazione di taglio laser puo' essere ripartita su PIU' bolle/nesting
--     (piu' righe L_ODLA per la stessa IDLAV, con OLQTP = quantita' di quella bolla
--     rispetto a LAQTP): i secondi previsti vengono quindi ripartiti in proporzione a
--     OLQTP tra le bolle, una riga di vista per ciascuna bolla collegata;
--   - per ogni bolla/OLCOD: se ha un nesting -> A_NES.DTEXP, altrimenti -> MIN(LADIP)
--     delle lavorazioni condivise dalla stessa bolla;
--   - lavorazioni senza nessuna riga L_ODLA (non di taglio laser) -> la propria LADIP,
--     secondi previsti non ripartiti;
--   - infine, se la data risultante e' nel passato, viene "portata" a oggi (il carico
--     arretrato deve comparire come urgenza odierna, non sparire dalla finestra visibile).
-- NB: NON si usa A_LAV.OLCOD (colonna diretta, ridondante) perche' riflette solo la
-- prima/ultima bolla assegnata e non la ripartizione reale sulle bolle successive.

-- DROP + CREATE invece di CREATE OR ALTER: il server del cliente e' SQL Server 2016 RTM,
-- CREATE OR ALTER e' disponibile solo da 2016 SP1 in poi.
IF OBJECT_ID('XVIEW_CARICO_LAV', 'V') IS NOT NULL
    DROP VIEW XVIEW_CARICO_LAV;
GO

CREATE VIEW XVIEW_CARICO_LAV AS
WITH LavAttive AS (
    SELECT
        L.IDLAV, L.CONUM, L.LOCOD, L.IDFAS, L.FACOD,
        ISNULL(L.FADSC, '')                                            AS LavorazioneDsc,
        L.LADIP,
        CAST(ISNULL(L.LAHLP, 0) AS BIGINT) * 3600 + ISNULL(L.LASLP, 0)  AS SecondiTotali,
        L.LASTO,
        L.FAEXE,  -- E = esterna, I = interna
        L.FAEXM   -- Y = fornitura modificabile (puo' essere esternalizzata/internalizzata)
    FROM A_LAV L
    WHERE L.LASTO <= 43
),
Split AS (
    SELECT
        O.IDLAV, O.OLCOD, O.OLQTP, O.IDNES AS OdlaIdNes,
        SUM(O.OLQTP) OVER (PARTITION BY O.IDLAV) AS TotQtaSplit
    FROM L_ODLA O
    INNER JOIN LavAttive LA ON LA.IDLAV = O.IDLAV
    WHERE O.OLQTP > 0
),
NesMax AS (
    SELECT OLCOD, MAX(IDNES) AS IDNES FROM A_NES GROUP BY OLCOD
),
Base AS (
    SELECT
        LA.IDLAV, LA.CONUM, LA.LOCOD, LA.IDFAS, LA.FACOD,
        F.X_Suffisso,
        ISNULL(F.FADSC, '')                                                AS RepartoDsc,
        LA.LavorazioneDsc,
        LA.LADIP                                                           AS DataPrevistaPropria,
        LA.FAEXE, LA.FAEXM,
        S.OLCOD,
        -- IDNES "assegnato" alla bolla: quello sulla riga L_ODLA (S.OdlaIdNes), NON quello
        -- dedotto da A_NES.OLCOD (che puo' esistere anche se la specifica riga L_ODLA non e'
        -- ancora stata effettivamente nestata) - determina il badge "NST" in UI.
        S.OdlaIdNes,
        NPiano.NSDSC AS PianoDiLavoro,  -- descrizione del piano di nesting, se assegnato
        N.DTEXP,
        COALESCE(
            N.DTEXP,
            CASE WHEN S.OLCOD IS NOT NULL
                 THEN MIN(LA.LADIP) OVER (PARTITION BY S.OLCOD)
                 ELSE NULL END,
            LA.LADIP
        )                                                                   AS DataGrezza,
        CASE WHEN S.OLCOD IS NOT NULL
             THEN CAST(ROUND(LA.SecondiTotali * S.OLQTP / NULLIF(S.TotQtaSplit, 0), 0) AS BIGINT)
             ELSE LA.SecondiTotali
        END                                                                 AS SecondiPrevisti,
        LA.LASTO
    FROM LavAttive LA
    LEFT JOIN A_FAS F   ON F.FACOD = LA.FACOD
    LEFT JOIN Split S   ON S.IDLAV = LA.IDLAV
    LEFT JOIN NesMax NM ON NM.OLCOD = S.OLCOD
    LEFT JOIN A_NES N   ON N.IDNES = NM.IDNES
    LEFT JOIN A_NES NPiano ON NPiano.IDNES = S.OdlaIdNes
)
SELECT
    IDLAV, CONUM, LOCOD, IDFAS, FACOD,
    X_Suffisso, RepartoDsc, LavorazioneDsc, DataPrevistaPropria,
    FAEXE, FAEXM, OLCOD, OdlaIdNes, PianoDiLavoro, DTEXP,
    CASE WHEN DataGrezza < CAST(GETDATE() AS DATE) THEN CAST(GETDATE() AS DATE) ELSE DataGrezza END AS DataEffettiva,
    SecondiPrevisti, LASTO
FROM Base
GO
