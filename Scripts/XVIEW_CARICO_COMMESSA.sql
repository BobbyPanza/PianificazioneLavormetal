-- Commessa/cliente/articolo/scadenza per lavorazione (PianificazioneLavormetal).
-- Separata da XVIEW_CARICO_LAV: il join sui lotti (compattazione + L_CMPA) e' costoso se
-- valutato su tutte le lavorazioni attive; va usato solo nelle query di dettaglio gia'
-- filtrate per reparto/periodo (es. CaricoRepository.GetDettaglioAsync), mai per
-- l'aggregazione del grafico.
--
-- COCOD/cliente derivano direttamente da CONUM (A_COM.CONUM e' gia' il numero di
-- commessa); la scadenza e' invece per-lotto e richiede la stessa catena di
-- compattazione lotti usata da PianificazioneODL (A_LOT -> L_CMPA.CMDTS).
--
-- L'articolo (PACOD/PADSC) si legge sul lotto DELLA LAVORAZIONE (T, join su CONUM+LOCOD),
-- non sul lotto compattato (LC): la compattazione serve solo a risalire alla data di
-- scadenza del lotto master, mentre l'articolo prodotto e' quello del lotto proprio.

-- DROP + CREATE invece di CREATE OR ALTER: il server del cliente e' SQL Server 2016 RTM,
-- CREATE OR ALTER e' disponibile solo da 2016 SP1 in poi.
IF OBJECT_ID('XVIEW_CARICO_COMMESSA', 'V') IS NOT NULL
    DROP VIEW XVIEW_CARICO_COMMESSA;
GO

CREATE VIEW XVIEW_CARICO_COMMESSA AS
SELECT
    L.IDLAV,
    COM.COCOD,
    COM.CTDSC AS ClienteDsc,
    T.PACOD   AS Articolo,
    T.PADSC   AS ArticoloDsc,
    CMP.CMDTS AS Scadenza
FROM A_LAV L
LEFT JOIN A_COM COM ON COM.CONUM = L.CONUM
LEFT JOIN A_LOT T   ON T.CONUM = L.CONUM AND T.LOCOD = L.LOCOD
LEFT JOIN A_LOT LC  ON LC.CONUM = T.CONUM
    AND LC.LOCOD = CASE WHEN ISNULL(T.LOCLM, 0) = 0 THEN T.LOCLC ELSE T.LOCOD END
LEFT JOIN L_CMPA CMP ON CMP.CONUM = LC.CONUM AND CMP.LOCOD = LC.LOCLM
WHERE L.LASTO <= 43
GO
