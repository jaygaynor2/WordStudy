namespace WordStudy.Api.Models;

public sealed record Translation(string Code, string Name);

public sealed record BibleVerse(
    string Id,
    string Reference,
    string Translation,
    string Text,
    int CanonicalIndex,
    string[] EnglishKeywords,
    string[] StrongsNumbers);

public sealed record BibleCorpus(
    string Translation,
    string TranslationName,
    BibleCorpusVerse[] Verses);

public sealed record BibleCorpusVerse(
    string Book,
    int Chapter,
    int Verse,
    string Text,
    string[]? EnglishKeywords = null,
    string[]? StrongsNumbers = null);

public sealed record VerseNote(Guid Id, string Group, string Text, DateTimeOffset CreatedAt);

public sealed class StudyVerse
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required BibleVerse Verse { get; init; }
    public List<VerseNote> Notes { get; init; } = [];
}

public sealed class Study
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Title { get; set; }
    public required string Translation { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public List<StudyVerse> Verses { get; init; } = [];
}

public sealed record CreateStudyRequest(string Title, string Translation);
public sealed record AddVerseRequest(string VerseId);
public sealed record AddNoteRequest(string Group, string Text);
public sealed record ApiError(string Message);
