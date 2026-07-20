using PianificazioneLavormetal.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<CaricoRepository>();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(opt =>
        opt.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.UseCors();

app.UseStaticFiles();
app.UseAuthorization();
app.MapControllers();

app.MapFallback(async (HttpContext ctx, IConfiguration config) =>
{
    var basePath = config["BasePath"] ?? "/";
    var indexPath = Path.Combine(app.Environment.WebRootPath, "index.html");
    var html = await File.ReadAllTextAsync(indexPath);
    html = html.Replace("<head>", $"<head>\n    <base href=\"{basePath}\">");
    ctx.Response.ContentType = "text/html";
    await ctx.Response.WriteAsync(html);
});

app.Run();
