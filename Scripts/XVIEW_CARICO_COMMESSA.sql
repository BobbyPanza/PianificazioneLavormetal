-- Commessa/cliente/scadenza per lavorazione (PianificazioneLavormetal).
-- Separata da XVIEW_CARICO_LAV: il join sui lotti (compattazione + L_CMPA) e' costoso se
-- valutato su tutte le lavorazioni attive; va usato solo nelle query di dettaglio gia'
-- filtrate per reparto/periodo (es. CaricoRepository.GetDettaglioAsync), mai per
-- l'aggregazione del grafico.
--
-- COCOD/cliente derivano direttamente da CONUM (A_COM.CONUM e' gia' il numero di
-- commessa); la scadenza e' invece per-lotto e richiede la stessa catena di
-- compattazione lotti usata da PianificazioneODL (A_LOT -> L_CMPA.CMDTS).

CREATE OR ALTER VIEW XVIEW_CARICO_COMMESSA AS
SELECT
    L.IDLAV,
    COM.COCOD,
    COM.CTDSC AS ClienteDsc,
    CMP.CMDTS AS Scadenza
FROM A_LAV L
LEFT JOIN A_COM COM ON COM.CONUM = L.CONUM
LEFT JOIN A_LOT T   ON T.CONUM = L.CONUM AND T.LOCOD = L.LOCOD
LEFT JOIN A_LOT LC  ON LC.CONUM = T.CONUM
    AND LC.LOCOD = CASE WHEN ISNULL(T.LOCLM, 0) = 0 THEN T.LOCLC ELSE T.LOCOD END
LEFT JOIN L_CMPA CMP ON CMP.CONUM = LC.CONUM AND CMP.LOCOD = LC.LOCLM
WHERE L.LASTO <= 43
GO
