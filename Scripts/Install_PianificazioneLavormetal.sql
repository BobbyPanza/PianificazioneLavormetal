-- ============================================================
-- Install_PianificazioneLavormetal.sql
-- Eseguire sul database FactoryLM (o Factory del cliente)
-- Dopo questo script, eseguire anche XVIEW_CARICO_LAV.sql
-- ============================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
PRINT '=== Installazione PianificazioneLavormetal ===';

-- Tabella di log degli spostamenti data (audit trail per scritture dirette su A_LAV/A_NES)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'X_CARICO_LOG') AND type = 'U')
BEGIN
    CREATE TABLE X_CARICO_LOG (
        ID              INT           NOT NULL IDENTITY(1,1),
        IDLAV           INT           NULL,
        OLCOD           NVARCHAR(30)  NULL,
        TIPO            NVARCHAR(20)  NOT NULL,  -- LAVORAZIONE | NESTING | GRUPPO
        DataPrecedente  DATE          NULL,
        DataNuova       DATE          NOT NULL,
        DTLOG           DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_X_CARICO_LOG PRIMARY KEY (ID)
    );
    PRINT 'X_CARICO_LOG: CREATA';
END
ELSE
    PRINT 'X_CARICO_LOG: gia'' esistente';

-- Indice per la query di log per lavorazione/data
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_X_CARICO_LOG_IDLAV')
BEGIN
    CREATE INDEX IX_X_CARICO_LOG_IDLAV ON X_CARICO_LOG (IDLAV, DTLOG);
    PRINT 'Indice IX_X_CARICO_LOG_IDLAV: CREATO';
END
ELSE
    PRINT 'Indice IX_X_CARICO_LOG_IDLAV: gia'' esistente';

-- Indice filtrato su A_LAV per accelerare il join/aggregazione per reparto (FACOD)
-- sulle sole lavorazioni attive (LASTO <= 43), usato da XVIEW_CARICO_LAV.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'X_IX_A_LAV_FACOD_LASTO' AND object_id = OBJECT_ID('A_LAV'))
BEGIN
    CREATE INDEX X_IX_A_LAV_FACOD_LASTO ON A_LAV (FACOD)
        INCLUDE (IDLAV, LADIP, LAHLP, LASLP)
        WHERE LASTO <= 43;
    PRINT 'Indice X_IX_A_LAV_FACOD_LASTO: CREATO';
END
ELSE
    PRINT 'Indice X_IX_A_LAV_FACOD_LASTO: gia'' esistente';

-- Indice su A_NES(OLCOD) per accelerare il join L_ODLA -> A_NES (oggi assente)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'X_IX_A_NES_OLCOD' AND object_id = OBJECT_ID('A_NES'))
BEGIN
    CREATE INDEX X_IX_A_NES_OLCOD ON A_NES (OLCOD) INCLUDE (DTEXP, IDNES);
    PRINT 'Indice X_IX_A_NES_OLCOD: CREATO';
END
ELSE
    PRINT 'Indice X_IX_A_NES_OLCOD: gia'' esistente';

-- Verifica rapida che le tabelle ERP attese esistano nel database
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'A_LAV') AND type = 'U')
    PRINT 'ATTENZIONE: tabella A_LAV non trovata in questo database!';
ELSE
    PRINT 'A_LAV: trovata OK';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'A_FAS') AND type = 'U')
    PRINT 'ATTENZIONE: tabella A_FAS non trovata in questo database!';
ELSE
    PRINT 'A_FAS: trovata OK';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'L_ODLA') AND type = 'U')
    PRINT 'ATTENZIONE: tabella L_ODLA non trovata in questo database!';
ELSE
    PRINT 'L_ODLA: trovata OK';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'A_NES') AND type = 'U')
    PRINT 'ATTENZIONE: tabella A_NES non trovata in questo database!';
ELSE
    PRINT 'A_NES: trovata OK';

PRINT '';
PRINT '=== Riepilogo ===';
SELECT (SELECT COUNT(*) FROM X_CARICO_LOG) AS Log_Records;

PRINT '';
PRINT 'Ricordati di eseguire anche XVIEW_CARICO_LAV.sql per creare/aggiornare la vista.';
