using WordStudy.Api.Models;

namespace WordStudy.Api.Services;

public sealed class WordStudyRepository
{
    private readonly VerseCatalog _catalog;
    private readonly List<Study> _studies = [];

    public WordStudyRepository(VerseCatalog catalog)
    {
        _catalog = catalog;
    }

    public IReadOnlyList<Study> List() =>
        _studies.OrderByDescending(study => study.CreatedAt).ToList();

    public Study? Get(Guid id) =>
        _studies.FirstOrDefault(study => study.Id == id);

    public Study Create(string title, string translation)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(translation);

        var study = new Study
        {
            Title = title.Trim(),
            Translation = translation.Trim().ToUpperInvariant()
        };

        _studies.Add(study);
        return study;
    }

    public StudyVerse? AddVerse(Guid studyId, string verseId)
    {
        var study = Get(studyId);
        var verse = _catalog.FindById(verseId);
        if (study is null || verse is null)
        {
            return null;
        }

        var existing = study.Verses.FirstOrDefault(studyVerse => studyVerse.Verse.Id == verse.Id);
        if (existing is not null)
        {
            return existing;
        }

        var entry = new StudyVerse { Verse = verse };
        study.Verses.Add(entry);
        return entry;
    }

    public VerseNote? AddNote(Guid studyId, Guid studyVerseId, string group, string text)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(group);
        ArgumentException.ThrowIfNullOrWhiteSpace(text);

        var studyVerse = Get(studyId)?.Verses.FirstOrDefault(verse => verse.Id == studyVerseId);
        if (studyVerse is null)
        {
            return null;
        }

        var note = new VerseNote(Guid.NewGuid(), group.Trim(), text.Trim(), DateTimeOffset.UtcNow);
        studyVerse.Notes.Add(note);
        return note;
    }

    public bool DeleteNote(Guid studyId, Guid studyVerseId, Guid noteId)
    {
        var studyVerse = Get(studyId)?.Verses.FirstOrDefault(verse => verse.Id == studyVerseId);
        var note = studyVerse?.Notes.FirstOrDefault(item => item.Id == noteId);
        if (studyVerse is null || note is null)
        {
            return false;
        }

        studyVerse.Notes.Remove(note);
        return true;
    }
}
