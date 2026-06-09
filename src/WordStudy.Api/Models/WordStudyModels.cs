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
