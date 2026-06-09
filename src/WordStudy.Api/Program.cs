using WordStudy.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<VerseCatalog>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/translations", (VerseCatalog catalog) => catalog.Translations);

app.MapGet("/api/verses/catalog", (VerseCatalog catalog) => Results.Ok(new
{
    totalVerseCount = catalog.TotalVerseCount,
    verseCountsByTranslation = catalog.VerseCountsByTranslation,
    completeTranslations = catalog.Translations
        .Where(translation => catalog.HasCompleteBible(translation.Code))
        .Select(translation => translation.Code)
        .ToArray()
}));

app.MapGet("/api/verses/search", (
    string? query,
    string? strongs,
    string? translation,
    VerseCatalog catalog) => catalog.Search(query, strongs, translation));

app.MapFallbackToFile("index.html");

app.Run();
