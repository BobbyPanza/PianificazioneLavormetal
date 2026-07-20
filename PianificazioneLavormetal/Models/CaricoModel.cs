namespace PianificazioneLavormetal.Models;

public class RepartoDto
{
    public string Suffisso { get; set; } = "";
    public string Descrizione { get; set; } = "";
    public int NumLavorazioni { get; set; }
    public List<string> RepartiDettaglio { get; set; } = [];
}

public class CaricoAggregatoDto
{
    public string Suffisso { get; set; } = "";
    public DateTime Periodo { get; set; }
    public long SecondiTotali { get; set; }
    public int NumLavorazioni { get; set; }
}

public class CapacitaDto
{
    public string Suffisso { get; set; } = "";
    public DateTime Periodo { get; set; }
    public long SecondiDisponibili { get; set; }
}

public class UnitaPianificabileDto
{
    public string Tipo { get; set; } = "";              // LAVORAZIONE | GRUPPO
    public int? IdLav { get; set; }
    public string? OlCod { get; set; }
    public int? IdNes { get; set; }
    public string Suffisso { get; set; } = "";
    public string Descrizione { get; set; } = "";
    public DateTime DataEffettiva { get; set; }
    public long SecondiPrevisti { get; set; }
    public int NumLavorazioni { get; set; }
    public string? CommessaCod { get; set; }
    public string? ClienteDsc { get; set; }
    public DateTime? Scadenza { get; set; }
    public string? Esterna { get; set; }       // 'E' | 'I' (solo se uniforme nel gruppo)
    public string? Modificabile { get; set; }  // 'Y' | 'N' (solo se uniforme nel gruppo)
    public string? PianoDiLavoro { get; set; } // descrizione nesting (A_NES.NSDSC), solo se assegnato
}

public class UnitaSelezionata
{
    public string Tipo { get; set; } = "";              // LAVORAZIONE | GRUPPO
    public int? IdLav { get; set; }
    public string? OlCod { get; set; }
}

public class SpostaRequest
{
    public List<UnitaSelezionata> Unita { get; set; } = [];
    public int DeltaGiorni { get; set; }
}

public class EsternalizzaRequest
{
    public List<UnitaSelezionata> Unita { get; set; } = [];
    public bool Esterna { get; set; }
}
