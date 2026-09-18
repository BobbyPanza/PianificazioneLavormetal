using Dapper;
using Microsoft.Data.SqlClient;
using PianificazioneLavormetal.Models;

namespace PianificazioneLavormetal.Services;

file class NestingInfo
{
    public int IdNes { get; set; }
    public DateTime? Dtexp { get; set; }
}

file class NomeRepartoRow
{
    public string Suffisso { get; set; } = "";
    public string Nome { get; set; } = "";
}

public class CaricoRepository(IConfiguration config)
{
    private SqlConnection CreateConnection() =>
        new(config.GetConnectionString("DefaultConnection"));

    // Espressione SQL del bucket periodo, indipendente da @@DATEFIRST per la settimana
    // (1900-01-01, giorno 0, era un lunedi': DATEDIFF(DAY,0,d) % 7 e' sempre l'offset da lunedi').
    private static string PeriodoExpr(string granularita) => granularita switch
    {
        "settimana" => "DATEADD(DAY, -(DATEDIFF(DAY, 0, DataEffettiva) % 7), CAST(DataEffettiva AS DATE))",
        "mese" => "DATEFROMPARTS(YEAR(DataEffettiva), MONTH(DataEffettiva), 1)",
        _ => "CAST(DataEffettiva AS DATE)", // giorno
    };

    // Normalizza X_Suffisso (NULL e blank/spazi diventano un'unica categoria '(N/D)'),
    // cast a VARCHAR largo PRIMA di ISNULL/NULLIF per evitare che il tipo troncato di
    // X_Suffisso (varchar(1)) tronchi anche i letterali di fallback piu' lunghi.
    private const string SuffissoExpr =
        "ISNULL(NULLIF(RTRIM(CAST(ISNULL(X_Suffisso, '') AS VARCHAR(20))), ''), '(N/D)')";

    public async Task<IEnumerable<RepartoDto>> GetRepartiAsync()
    {
        using var conn = CreateConnection();
        // L'etichetta mostrata nei filtri/tab e' X_REP_SUFFISSO.X_Descrizione (anagrafica dei
        // suffissi, vedi Scripts/Install_X_REP_SUFFISSO.sql): un suffisso non ancora mappato
        // resta visibile nei filtri, ma con la sola sigla al posto del nome.
        // L'aggregazione e' in subquery perche' sia la vista sia X_REP_SUFFISSO hanno una
        // colonna X_Suffisso e SuffissoExpr la referenzia senza qualificatore.
        var reparti = (await conn.QueryAsync<RepartoDto>($@"
            SELECT
                S.Suffisso,
                ISNULL(X.X_Descrizione, S.Suffisso) AS Descrizione,
                S.NumLavorazioni
            FROM (
                SELECT
                    {SuffissoExpr} AS Suffisso,
                    COUNT(DISTINCT IDLAV) AS NumLavorazioni
                FROM XVIEW_CARICO_LAV
                GROUP BY {SuffissoExpr}
            ) S
            LEFT JOIN X_REP_SUFFISSO X ON X.X_Suffisso = S.Suffisso
            ORDER BY S.Suffisso")).ToList();

        var nomi = await conn.QueryAsync<NomeRepartoRow>(@"
            SELECT X.X_Suffisso AS Suffisso, R.REDSC AS Nome
            FROM X_REP_SUFFISSO X JOIN A_REP R ON R.RECOD = X.RECOD
            ORDER BY R.REDSC");

        var nomiPerSuffisso = nomi
            .GroupBy(n => n.Suffisso)
            .ToDictionary(g => g.Key, g => g.Select(n => n.Nome).ToList());

        foreach (var r in reparti)
            if (nomiPerSuffisso.TryGetValue(r.Suffisso, out var elenco))
                r.RepartiDettaglio = elenco;

        return reparti;
    }

    public async Task<IEnumerable<CapacitaDto>> GetCapacitaAsync(
        string granularita, DateTime dal, DateTime al, string? suffisso)
    {
        var periodo = PeriodoExpr(granularita).Replace("DataEffettiva", "d");
        using var conn = CreateConnection();
        return await conn.QueryAsync<CapacitaDto>($@"
            ;WITH Giorni AS (
                SELECT @Dal AS d
                UNION ALL SELECT DATEADD(DAY, 1, d) FROM Giorni WHERE d < @Al
            ),
            Operatori AS (
                -- Capacita' calcolata sugli operatori assegnati al reparto (L_REOP/A_OPR.IDNUM),
                -- non sulle macchine: i 6 codici reparto principali (01-06) hanno operatori
                -- assegnati in modo stabile, a differenza dei codici granulari in L_REMA.
                SELECT DISTINCT RS.X_Suffisso, O.IDNUM
                FROM X_REP_SUFFISSO RS
                JOIN L_REOP L ON L.RECOD = RS.RECOD
                JOIN A_OPR O ON O.OPCOD = L.OPCOD
                WHERE (@Suffisso IS NULL OR RS.X_Suffisso = @Suffisso)
            ),
            Grezzo AS (
                SELECT OP.X_Suffisso, G.d, v.sec
                FROM Giorni G
                CROSS JOIN Operatori OP
                CROSS APPLY (SELECT dbo.ComputeCalendarTime(OP.IDNUM, CAST(G.d AS datetime)) AS sec) v
            )
            SELECT
                X_Suffisso AS Suffisso,
                {periodo} AS Periodo,
                SUM(CASE WHEN sec > 0 THEN sec ELSE 0 END) AS SecondiDisponibili
            FROM Grezzo
            GROUP BY X_Suffisso, {periodo}
            ORDER BY Periodo
            OPTION (MAXRECURSION 400)",
            new { Dal = dal.Date, Al = al.Date, Suffisso = suffisso });
    }

    public async Task<IEnumerable<CaricoAggregatoDto>> GetAggregatoAsync(
        string granularita, DateTime dal, DateTime al, string? suffisso)
    {
        var periodo = PeriodoExpr(granularita);
        using var conn = CreateConnection();
        return await conn.QueryAsync<CaricoAggregatoDto>($@"
            SELECT
                {SuffissoExpr} AS Suffisso,
                {periodo} AS Periodo,
                SUM(SecondiPrevisti) AS SecondiTotali,
                COUNT(DISTINCT IDLAV) AS NumLavorazioni
            FROM XVIEW_CARICO_LAV
            WHERE DataEffettiva BETWEEN @Dal AND @Al
              AND (@Suffisso IS NULL OR {SuffissoExpr} = @Suffisso)
            GROUP BY {SuffissoExpr}, {periodo}
            ORDER BY Periodo",
            new { Dal = dal.Date, Al = al.Date, Suffisso = suffisso });
    }

    public async Task<IEnumerable<UnitaPianificabileDto>> GetDettaglioAsync(
        string? suffisso, DateTime dal, DateTime al)
    {
        using var conn = CreateConnection();
        return await conn.QueryAsync<UnitaPianificabileDto>($@"
            SELECT
                CASE WHEN MAX(V.OLCOD) IS NOT NULL THEN 'GRUPPO' ELSE 'LAVORAZIONE' END AS Tipo,
                MAX(CASE WHEN V.OLCOD IS NULL THEN V.IDLAV END) AS IdLav,
                MAX(V.OLCOD) AS OlCod,
                -- Badge NST solo se L_ODLA.IDNES e' valorizzato per (almeno) una riga della
                -- bolla, NON se esiste semplicemente un A_NES collegato all'OLCOD.
                MAX(V.OdlaIdNes) AS IdNes,
                MAX({SuffissoExpr}) AS Suffisso,
                CAST(MAX(CASE WHEN V.OLCOD IS NULL THEN V.LavorazioneDsc ELSE V.OLCOD END) AS NVARCHAR(200)) AS Descrizione,
                MAX(V.DataEffettiva) AS DataEffettiva,
                SUM(V.SecondiPrevisti) AS SecondiPrevisti,
                COUNT(DISTINCT V.IDLAV) AS NumLavorazioni,
                -- Commessa/cliente/scadenza mostrati solo se tutte le lavorazioni del
                -- gruppo appartengono alla stessa commessa (CONUM): altrimenti sarebbero
                -- ambigui (una bolla puo' contenere lavorazioni di commesse diverse).
                CASE WHEN COUNT(DISTINCT V.CONUM) = 1 THEN MAX(C.COCOD) END AS CommessaCod,
                CASE WHEN COUNT(DISTINCT V.CONUM) = 1 THEN MAX(C.ClienteDsc) END AS ClienteDsc,
                CASE WHEN COUNT(DISTINCT V.CONUM) = 1 THEN MIN(C.Scadenza) END AS Scadenza,
                -- Articolo: per una lavorazione singola e' quello del suo lotto; per una bolla
                -- viene mostrato solo se tutte le lavorazioni producono lo stesso articolo
                -- (una bolla di nesting puo' contenere piu' articoli diversi).
                CASE WHEN COUNT(DISTINCT C.Articolo) = 1 THEN MAX(C.Articolo) END AS Articolo,
                CASE WHEN COUNT(DISTINCT C.Articolo) = 1 THEN MAX(C.ArticoloDsc) END AS ArticoloDsc,
                -- Esterna/modificabile mostrati solo se uniformi in tutta la bolla.
                CASE WHEN COUNT(DISTINCT V.FAEXE) = 1 THEN MAX(V.FAEXE) END AS Esterna,
                CASE WHEN COUNT(DISTINCT V.FAEXM) = 1 THEN MAX(V.FAEXM) END AS Modificabile,
                MAX(V.PianoDiLavoro) AS PianoDiLavoro
            FROM XVIEW_CARICO_LAV V
            LEFT JOIN XVIEW_CARICO_COMMESSA C ON C.IDLAV = V.IDLAV
            WHERE V.DataEffettiva BETWEEN @Dal AND @Al
              AND (@Suffisso IS NULL OR {SuffissoExpr} = @Suffisso)
            GROUP BY COALESCE(V.OLCOD, CAST(V.IDLAV AS NVARCHAR(20)))
            ORDER BY DataEffettiva",
            new { Dal = dal.Date, Al = al.Date, Suffisso = suffisso });
    }

    public async Task SpostaAsync(SpostaRequest req)
    {
        if (req.DeltaGiorni == 0 || req.Unita.Count == 0)
            return;

        using var conn = CreateConnection();
        await conn.OpenAsync();
        using var tx = conn.BeginTransaction();

        foreach (var u in req.Unita)
        {
            if (u.Tipo == "LAVORAZIONE" && u.IdLav is int idLav)
            {
                // Le lavorazioni scadute vengono mostrate "a oggi" in XVIEW_CARICO_LAV: il delta
                // ricevuto dal client e' calcolato rispetto a quella data mostrata, quindi va
                // applicato allo stesso valore "clampato", non alla LADIP grezza (altrimenti un
                // trascinamento su una lavorazione arretrata la sposterebbe alla data sbagliata).
                await conn.ExecuteAsync(@"
                    UPDATE A_LAV
                    SET LADIP = DATEADD(DAY, @Delta, CASE WHEN LADIP < CAST(GETDATE() AS DATE) THEN CAST(GETDATE() AS DATE) ELSE LADIP END)
                    OUTPUT @IdLav, 'LAVORAZIONE', deleted.LADIP, inserted.LADIP
                        INTO X_CARICO_LOG (IDLAV, TIPO, DataPrecedente, DataNuova)
                    WHERE IDLAV = @IdLav",
                    new { Delta = req.DeltaGiorni, IdLav = idLav }, tx);
            }
            else if (u.Tipo == "GRUPPO" && !string.IsNullOrEmpty(u.OlCod))
            {
                // Prendiamo lo stesso nesting "attivo" usato da XVIEW_CARICO_LAV (MAX(IDNES) per OLCOD).
                // Se il nesting esiste ma DTEXP e' NULL, la vista ricade comunque su MIN(LADIP): in quel
                // caso lo spostamento deve toccare le lavorazioni, non un DTEXP che non guida il grafico.
                var nesting = await conn.QueryFirstOrDefaultAsync<NestingInfo>(@"
                    SELECT TOP 1 IDNES AS IdNes, DTEXP AS Dtexp
                    FROM A_NES WHERE OLCOD = @OlCod ORDER BY IDNES DESC",
                    new { u.OlCod }, tx);

                if (nesting is { Dtexp: not null })
                {
                    var nes = nesting.IdNes;
                    await conn.ExecuteAsync(@"
                        UPDATE A_NES
                        SET DTEXP = DATEADD(DAY, @Delta, CASE WHEN DTEXP < CAST(GETDATE() AS DATE) THEN CAST(GETDATE() AS DATE) ELSE DTEXP END)
                        OUTPUT @OlCod, 'NESTING', deleted.DTEXP, inserted.DTEXP
                            INTO X_CARICO_LOG (OLCOD, TIPO, DataPrecedente, DataNuova)
                        WHERE IDNES = @IdNes",
                        new { Delta = req.DeltaGiorni, u.OlCod, IdNes = nes }, tx);
                }
                else
                {
                    // Nessun nesting: sposta tutte le lavorazioni collegate alla stessa bolla,
                    // mantenendo coerente il MIN(LADIP) che guida la posizione nel grafico. Il
                    // clamp "oggi" si applica al MIN del gruppo (non riga per riga, altrimenti si
                    // distorcerebbe la distanza relativa tra le lavorazioni della stessa bolla).
                    var minLadip = await conn.ExecuteScalarAsync<DateTime?>(@"
                        SELECT MIN(LADIP) FROM A_LAV WHERE IDLAV IN (SELECT IDLAV FROM L_ODLA WHERE OLCOD = @OlCod)",
                        new { u.OlCod }, tx);
                    var oggi = DateTime.Today;
                    var extraClamp = minLadip is DateTime m && m < oggi ? (oggi - m).Days : 0;

                    await conn.ExecuteAsync(@"
                        UPDATE A_LAV
                        SET LADIP = DATEADD(DAY, @DeltaTotale, LADIP)
                        OUTPUT @OlCod, 'GRUPPO', deleted.IDLAV, deleted.LADIP, inserted.LADIP
                            INTO X_CARICO_LOG (OLCOD, TIPO, IDLAV, DataPrecedente, DataNuova)
                        WHERE IDLAV IN (SELECT IDLAV FROM L_ODLA WHERE OLCOD = @OlCod)",
                        new { DeltaTotale = req.DeltaGiorni + extraClamp, u.OlCod }, tx);
                }
            }
        }

        await tx.CommitAsync();
    }

    public async Task EsternalizzaAsync(EsternalizzaRequest req)
    {
        if (req.Unita.Count == 0)
            return;

        var nuovoValore = req.Esterna ? "E" : "I";
        using var conn = CreateConnection();
        await conn.OpenAsync();
        using var tx = conn.BeginTransaction();

        foreach (var u in req.Unita)
        {
            // Solo le lavorazioni con fornitura modificabile (FAEXM='Y') possono essere
            // esternalizzate/internalizzate; le altre vengono silenziosamente ignorate.
            if (u.Tipo == "LAVORAZIONE" && u.IdLav is int idLav)
            {
                await conn.ExecuteAsync(@"
                    UPDATE A_LAV SET FAEXE = @NuovoValore
                    WHERE IDLAV = @IdLav AND FAEXM = 'Y'",
                    new { NuovoValore = nuovoValore, IdLav = idLav }, tx);
            }
            else if (u.Tipo == "GRUPPO" && !string.IsNullOrEmpty(u.OlCod))
            {
                await conn.ExecuteAsync(@"
                    UPDATE A_LAV SET FAEXE = @NuovoValore
                    WHERE FAEXM = 'Y' AND IDLAV IN (SELECT IDLAV FROM L_ODLA WHERE OLCOD = @OlCod)",
                    new { NuovoValore = nuovoValore, u.OlCod }, tx);
            }
        }

        await tx.CommitAsync();
    }
}
