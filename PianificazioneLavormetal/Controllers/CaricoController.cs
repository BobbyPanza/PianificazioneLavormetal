using Microsoft.AspNetCore.Mvc;
using PianificazioneLavormetal.Models;
using PianificazioneLavormetal.Services;

namespace PianificazioneLavormetal.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CaricoController(CaricoRepository repo) : ControllerBase
{
    [HttpGet("reparti")]
    public async Task<IActionResult> GetReparti() =>
        Ok(await repo.GetRepartiAsync());

    [HttpGet("aggregato")]
    public async Task<IActionResult> GetAggregato(
        [FromQuery] string granularita, [FromQuery] DateTime dal, [FromQuery] DateTime al,
        [FromQuery] string? suffisso) =>
        Ok(await repo.GetAggregatoAsync(granularita, dal, al, suffisso));

    [HttpGet("dettaglio")]
    public async Task<IActionResult> GetDettaglio(
        [FromQuery] DateTime dal, [FromQuery] DateTime al, [FromQuery] string? suffisso) =>
        Ok(await repo.GetDettaglioAsync(suffisso, dal, al));

    [HttpGet("capacita")]
    public async Task<IActionResult> GetCapacita(
        [FromQuery] string granularita, [FromQuery] DateTime dal, [FromQuery] DateTime al,
        [FromQuery] string? suffisso) =>
        Ok(await repo.GetCapacitaAsync(granularita, dal, al, suffisso));

    [HttpPost("sposta")]
    public async Task<IActionResult> Sposta([FromBody] SpostaRequest req)
    {
        await repo.SpostaAsync(req);
        return Ok();
    }

    [HttpPost("esternalizza")]
    public async Task<IActionResult> Esternalizza([FromBody] EsternalizzaRequest req)
    {
        await repo.EsternalizzaAsync(req);
        return Ok();
    }
}
