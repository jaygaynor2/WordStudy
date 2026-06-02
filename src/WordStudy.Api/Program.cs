using Microsoft.AspNetCore.Http.HttpResults;
using WordStudy.Api.Models;
using WordStudy.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<VerseCatalog>();
builder.Services.AddSingleton<WordStudyRepository>();
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

app.MapGet("/api/auth/config", () => Results.Ok(new
{
    provider = "Google",
    configured = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")),
    clientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? ""
}));

app.MapPost("/api/auth/dev-login", () => Results.Ok(new
{
    id = "dev-user",
    name = "Dev User",
    email = "dev@example.com",
    provider = "Google"
}));

app.MapPost("/api/auth/logout", () => Results.NoContent());

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

app.MapGet("/api/studies", (WordStudyRepository repository) => repository.List());

app.MapGet("/api/studies/{id:guid}", Results<Ok<Study>, NotFound<ApiError>> (
    Guid id,
    WordStudyRepository repository) =>
{
    var study = repository.Get(id);
    return study is null
        ? TypedResults.NotFound(new ApiError("Study not found."))
        : TypedResults.Ok(study);
});

app.MapPost("/api/studies", Results<Created<Study>, BadRequest<ApiError>> (
    CreateStudyRequest request,
    WordStudyRepository repository) =>
{
    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Translation))
    {
        return TypedResults.BadRequest(new ApiError("Title and translation are required."));
    }

    var study = repository.Create(request.Title, request.Translation);
    return TypedResults.Created($"/api/studies/{study.Id}", study);
});

app.MapPost("/api/studies/{id:guid}/verses", Results<Ok<StudyVerse>, NotFound<ApiError>, BadRequest<ApiError>> (
    Guid id,
    AddVerseRequest request,
    WordStudyRepository repository) =>
{
    if (string.IsNullOrWhiteSpace(request.VerseId))
    {
        return TypedResults.BadRequest(new ApiError("Verse id is required."));
    }

    var studyVerse = repository.AddVerse(id, request.VerseId);
    return studyVerse is null
        ? TypedResults.NotFound(new ApiError("Study or verse not found."))
        : TypedResults.Ok(studyVerse);
});

app.MapPost("/api/studies/{studyId:guid}/verses/{studyVerseId:guid}/notes", Results<Created<VerseNote>, NotFound<ApiError>, BadRequest<ApiError>> (
    Guid studyId,
    Guid studyVerseId,
    AddNoteRequest request,
    WordStudyRepository repository) =>
{
    if (string.IsNullOrWhiteSpace(request.Group) || string.IsNullOrWhiteSpace(request.Text))
    {
        return TypedResults.BadRequest(new ApiError("Group and text are required."));
    }

    var note = repository.AddNote(studyId, studyVerseId, request.Group, request.Text);
    return note is null
        ? TypedResults.NotFound(new ApiError("Study verse not found."))
        : TypedResults.Created($"/api/studies/{studyId}/verses/{studyVerseId}/notes/{note.Id}", note);
});

app.MapDelete("/api/studies/{studyId:guid}/verses/{studyVerseId:guid}/notes/{noteId:guid}", Results<NoContent, NotFound<ApiError>> (
    Guid studyId,
    Guid studyVerseId,
    Guid noteId,
    WordStudyRepository repository) =>
{
    return repository.DeleteNote(studyId, studyVerseId, noteId)
        ? TypedResults.NoContent()
        : TypedResults.NotFound(new ApiError("Note not found."));
});

app.MapFallbackToFile("index.html");

app.Run();
