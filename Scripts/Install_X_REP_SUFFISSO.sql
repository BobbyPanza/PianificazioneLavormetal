-- ============================================================
-- Install_X_REP_SUFFISSO.sql
-- Anagrafica dei suffissi di reparto (A_FAS.X_Suffisso): per ogni suffisso
--   - X_Descrizione = l'etichetta mostrata nei filtri/tab della pianificazione
--                     (l'applicazione legge di qui, non ha piu' nomi hard-coded);
--   - RECOD         = il reparto A_REP corrispondente, se esiste: serve SOLO a
--                     calcolare la disponibilita' oraria (capacita') tramite gli
--                     operatori assegnati (L_REOP -> A_OPR.IDNUM -> ComputeCalendarTime).
--
-- La chiave e' il SUFFISSO, non il reparto: un suffisso puo' non avere un reparto
-- (lavorazioni esterne, fasi non assegnate) e in quel caso RECOD resta NULL - il
-- reparto compare comunque nei filtri, ma senza linea di disponibilita' nel grafico.
-- Viceversa un reparto senza suffisso (es. Logistica) semplicemente non compare qui.
--
-- Tabella separata (non colonne su A_REP/A_FAS) per non alterare lo schema delle
-- tabelle ERP condivise.
--
-- Per i RECOD si usano SOLO i codici reparto "macro" (01-05): sono gli unici con
-- operatori assegnati in modo stabile via L_REOP. I codici granulari (AS-ARI100,
-- TA-TLA100, ecc.) esistono in A_REP/L_REMA per altri scopi ma non vengono usati qui.
-- ============================================================

SET NOCOUNT ON;
-- Richiesto dall'indice filtrato UQ_X_REP_SUFFISSO_RECOD: sqlcmd parte con
-- QUOTED_IDENTIFIER OFF e CREATE INDEX su indice filtrato fallirebbe (errore 1934).
SET QUOTED_IDENTIFIER ON;
PRINT '=== Installazione X_REP_SUFFISSO ===';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'X_REP_SUFFISSO') AND type = 'U')
BEGIN
    CREATE TABLE X_REP_SUFFISSO (
        X_Suffisso    VARCHAR(20)   NOT NULL,
        X_Descrizione NVARCHAR(100) NOT NULL,
        RECOD         NVARCHAR(20)  NULL,
        CONSTRAINT PK_X_REP_SUFFISSO PRIMARY KEY (X_Suffisso)
    );
    PRINT 'X_REP_SUFFISSO: CREATA';
END
ELSE
BEGIN
    PRINT 'X_REP_SUFFISSO: gia'' esistente, verifica struttura';

    -- Ripulisce le righe della mappatura granulare usata da versioni precedenti
    -- dello script (RECOD tipo 'AS-ARI100'): non vanno confuse con le righe
    -- senza reparto, che hanno RECOD NULL.
    DELETE FROM X_REP_SUFFISSO WHERE RECOD IS NOT NULL AND RECOD NOT IN ('01','02','03','04','05','06');

    -- Migrazione dalla struttura v1.0.0 (PK su RECOD, nessuna descrizione).
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'X_REP_SUFFISSO') AND name = 'X_Descrizione')
    BEGIN
        ALTER TABLE X_REP_SUFFISSO ADD X_Descrizione NVARCHAR(100) NULL;
        PRINT '  + colonna X_Descrizione aggiunta';
    END
END
GO

-- Batch separato: X_Descrizione puo' essere appena stata aggiunta e SQL Server risolve
-- i nomi di colonna alla compilazione del batch, non riga per riga.
IF EXISTS (SELECT 1 FROM X_REP_SUFFISSO GROUP BY X_Suffisso HAVING COUNT(*) > 1)
BEGIN
    ;THROW 50001, 'X_REP_SUFFISSO contiene suffissi duplicati: eliminare i doppioni (un suffisso = al massimo un reparto) e rieseguire lo script.', 1;
END

-- Migrazione dalla struttura v1.0.0 (PK su RECOD, nessuna descrizione).
IF EXISTS (SELECT 1 FROM sys.key_constraints K
           JOIN sys.index_columns IC ON IC.object_id = K.parent_object_id AND IC.index_id = K.unique_index_id
           JOIN sys.columns C ON C.object_id = IC.object_id AND C.column_id = IC.column_id
           WHERE K.parent_object_id = OBJECT_ID(N'X_REP_SUFFISSO') AND K.type = 'PK' AND C.name = 'RECOD')
BEGIN
    ALTER TABLE X_REP_SUFFISSO DROP CONSTRAINT PK_X_REP_SUFFISSO;
    ALTER TABLE X_REP_SUFFISSO ALTER COLUMN RECOD NVARCHAR(20) NULL;
    ALTER TABLE X_REP_SUFFISSO ALTER COLUMN X_Suffisso VARCHAR(20) NOT NULL;
    -- Le righe preesistenti hanno descrizione NULL: valorizzata col suffisso stesso,
    -- il MERGE qui sotto la sovrascrive con l'etichetta definitiva.
    UPDATE X_REP_SUFFISSO SET X_Descrizione = X_Suffisso WHERE X_Descrizione IS NULL;
    ALTER TABLE X_REP_SUFFISSO ALTER COLUMN X_Descrizione NVARCHAR(100) NOT NULL;
    ALTER TABLE X_REP_SUFFISSO ADD CONSTRAINT PK_X_REP_SUFFISSO PRIMARY KEY (X_Suffisso);
    PRINT '  + chiave primaria spostata da RECOD a X_Suffisso (RECOD ora opzionale)';
END

-- Un reparto non puo' essere associato a due suffissi diversi: la capacita' oraria
-- verrebbe conteggiata due volte (stessi operatori su due reparti del grafico).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'X_REP_SUFFISSO') AND name = 'UQ_X_REP_SUFFISSO_RECOD')
    CREATE UNIQUE INDEX UQ_X_REP_SUFFISSO_RECOD ON X_REP_SUFFISSO (RECOD) WHERE RECOD IS NOT NULL;

-- Elenco completo dei suffissi presenti in A_FAS. Le descrizioni sono le etichette
-- dei filtri di pianificazione: modificarle qui (il MERGE le riallinea a ogni
-- esecuzione dello script, eventuali modifiche fatte a mano sulla tabella si perdono).
MERGE X_REP_SUFFISSO AS target
USING (VALUES
    -- Suffisso, Etichetta nei filtri,          RECOD reparto (NULL = nessuno)
    ('T',     N'Taglio',                   '01'),  -- Reparto Taglio Laser
    ('Z',     N'Punzonatura',              '02'),  -- Reparto Punzonatura
    ('P',     N'Piega e Pannellatura',     '03'),  -- Reparto Piegatura (Piega e pannellatura)
    ('S',     N'Saldatura',                '04'),  -- Reparto Saldatura
    ('A',     N'Assemblaggio',             '05'),  -- Reparto Assemblaggio
    -- '06' Logistica: reparto senza suffisso, volutamente non mappato.
    ('M',     N'Lavorazioni Meccaniche',   NULL),  -- fasi conto terzi (fresatura, burattatura, filettatura...)
    ('V',     N'Trattamenti/Verniciatura', NULL),  -- verniciatura, zincatura, cataforesi...
    -- NCHAR(224) = 'a' accentata: i file .sql del progetto sono ASCII puro senza BOM, gli
    -- accenti scritti direttamente verrebbero mangiati a seconda dell'editor/sqlcmd usato.
    ('Q',     N'Controllo Qualit' + NCHAR(224), NULL),  -- fase 120, nessun reparto dedicato
    ('(N/D)', N'Non assegnato',            NULL)   -- fasi con X_Suffisso NULL o vuoto (categoria di fallback dell'app)
) AS source (X_Suffisso, X_Descrizione, RECOD)
ON target.X_Suffisso = source.X_Suffisso
WHEN MATCHED AND (target.X_Descrizione <> source.X_Descrizione
              OR ISNULL(target.RECOD, '') <> ISNULL(source.RECOD, '')) THEN
    UPDATE SET X_Descrizione = source.X_Descrizione, RECOD = source.RECOD
WHEN NOT MATCHED THEN
    INSERT (X_Suffisso, X_Descrizione, RECOD) VALUES (source.X_Suffisso, source.X_Descrizione, source.RECOD);

PRINT '';
PRINT '=== Riepilogo ===';
SELECT
    X.X_Suffisso,
    X.X_Descrizione,
    X.RECOD,
    ISNULL(R.REDSC, '(nessun reparto: niente disponibilita'' oraria)') AS Reparto,
    (SELECT COUNT(*) FROM A_FAS F
     WHERE ISNULL(NULLIF(RTRIM(CAST(ISNULL(F.X_Suffisso, '') AS VARCHAR(20))), ''), '(N/D)') = X.X_Suffisso) AS FasiAssociate
FROM X_REP_SUFFISSO X
LEFT JOIN A_REP R ON R.RECOD = X.RECOD
ORDER BY X.X_Descrizione;

-- Suffissi presenti in A_FAS ma non ancora in anagrafica: nei filtri comparirebbero
-- con la sigla al posto del nome.
PRINT '';
PRINT '=== Suffissi usati in A_FAS ma non mappati (attesi: nessuno) ===';
SELECT
    ISNULL(NULLIF(RTRIM(CAST(ISNULL(F.X_Suffisso, '') AS VARCHAR(20))), ''), '(N/D)') AS X_Suffisso,
    COUNT(*) AS FasiAssociate
FROM A_FAS F
WHERE NOT EXISTS (
    SELECT 1 FROM X_REP_SUFFISSO X
    WHERE X.X_Suffisso = ISNULL(NULLIF(RTRIM(CAST(ISNULL(F.X_Suffisso, '') AS VARCHAR(20))), ''), '(N/D)'))
GROUP BY ISNULL(NULLIF(RTRIM(CAST(ISNULL(F.X_Suffisso, '') AS VARCHAR(20))), ''), '(N/D)');
