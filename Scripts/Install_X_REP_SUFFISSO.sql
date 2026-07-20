-- ============================================================
-- Install_X_REP_SUFFISSO.sql
-- Crea e popola la tabella di mappatura reparto (A_REP.RECOD) -> suffisso,
-- usata per calcolare la disponibilita' oraria per reparto (capacita'),
-- tramite gli operatori assegnati (L_REOP -> A_OPR.IDNUM -> ComputeCalendarTime).
-- Tabella separata (non una colonna su A_REP) per non alterare lo schema
-- della tabella ERP condivisa.
--
-- Si usano SOLO i 6 codici reparto "macro" (01-06): sono gli unici con
-- operatori assegnati in modo stabile via L_REOP per il calcolo capacita'.
-- I codici granulari (AS-ARI100, TA-TLA100, ecc.) esistono in A_REP/L_REMA
-- per altri scopi ma non vengono usati qui.
-- ============================================================

SET NOCOUNT ON;
PRINT '=== Installazione X_REP_SUFFISSO ===';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'X_REP_SUFFISSO') AND type = 'U')
BEGIN
    CREATE TABLE X_REP_SUFFISSO (
        RECOD      NVARCHAR(20) NOT NULL,
        X_Suffisso VARCHAR(20)  NOT NULL,
        CONSTRAINT PK_X_REP_SUFFISSO PRIMARY KEY (RECOD)
    );
    PRINT 'X_REP_SUFFISSO: CREATA';
END
ELSE
    PRINT 'X_REP_SUFFISSO: gia'' esistente';

-- Ripulisce eventuali righe da versioni precedenti dello script (mappatura granulare)
DELETE FROM X_REP_SUFFISSO WHERE RECOD NOT IN ('01','02','03','04','05','06');

MERGE X_REP_SUFFISSO AS target
USING (VALUES
    ('01', 'T'),  -- Reparto Taglio Laser
    ('02', 'Z'),  -- Reparto Punzonatura
    ('03', 'P'),  -- Reparto Piegatura (Piega e pannellatura)
    ('04', 'S'),  -- Reparto Saldatura
    ('05', 'A')   -- Reparto Assemblaggio
    -- '06' Logistica volutamente esclusa: nessun suffisso di reparto produttivo corrispondente
) AS source (RECOD, X_Suffisso)
ON target.RECOD = source.RECOD
WHEN MATCHED AND target.X_Suffisso <> source.X_Suffisso THEN
    UPDATE SET X_Suffisso = source.X_Suffisso
WHEN NOT MATCHED THEN
    INSERT (RECOD, X_Suffisso) VALUES (source.RECOD, source.X_Suffisso);

PRINT '';
PRINT '=== Riepilogo ===';
SELECT X.RECOD, X.X_Suffisso, R.REDSC FROM X_REP_SUFFISSO X JOIN A_REP R ON R.RECOD = X.RECOD ORDER BY X.RECOD;
