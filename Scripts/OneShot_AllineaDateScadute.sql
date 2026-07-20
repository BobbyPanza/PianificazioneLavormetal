-- ============================================================
-- OneShot_AllineaDateScadute.sql
-- Operazione UNA TANTUM: porta a oggi tutte le lavorazioni/nesting attivi
-- con data prevista nel passato. Ogni riga modificata viene loggata in
-- X_CARICO_LOG (DataPrecedente/DataNuova) per tracciabilita' e rollback manuale.
-- Non modifica l'ora (LAHIP) delle lavorazioni, solo la data (LADIP/DTEXP).
-- ============================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
PRINT '=== Allineamento date scadute a oggi ===';

-- 1) Lavorazioni (A_LAV) attive con LADIP nel passato
UPDATE A_LAV
SET LADIP = CAST(GETDATE() AS DATE)
OUTPUT inserted.IDLAV, 'LAVORAZIONE', deleted.LADIP, inserted.LADIP
    INTO X_CARICO_LOG (IDLAV, TIPO, DataPrecedente, DataNuova)
WHERE LASTO <= 43 AND LADIP < CAST(GETDATE() AS DATE);

PRINT CONCAT('A_LAV aggiornate: ', @@ROWCOUNT);

-- 2) Nesting (A_NES) con DTEXP nel passato, collegati a lavorazioni attive
UPDATE N
SET DTEXP = CAST(GETDATE() AS DATE)
OUTPUT NULL, 'NESTING', deleted.DTEXP, inserted.DTEXP, inserted.OLCOD
    INTO X_CARICO_LOG (IDLAV, TIPO, DataPrecedente, DataNuova, OLCOD)
FROM A_NES N
WHERE N.DTEXP < CAST(GETDATE() AS DATE)
  AND N.OLCOD IN (
      SELECT DISTINCT O.OLCOD
      FROM L_ODLA O
      JOIN A_LAV L ON L.IDLAV = O.IDLAV
      WHERE L.LASTO <= 43
  );

PRINT CONCAT('A_NES aggiornate: ', @@ROWCOUNT);

PRINT '';
PRINT '=== Riepilogo ===';
SELECT COUNT(*) AS RigheLoggateOraSessione FROM X_CARICO_LOG WHERE DTLOG >= DATEADD(MINUTE, -2, GETDATE());
