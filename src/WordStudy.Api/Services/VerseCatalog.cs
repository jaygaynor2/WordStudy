using WordStudy.Api.Models;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace WordStudy.Api.Services;

public sealed class VerseCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyDictionary<string, int> CanonicalVerseCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["Genesis"] = 1533, ["Exodus"] = 1213, ["Leviticus"] = 859, ["Numbers"] = 1288, ["Deuteronomy"] = 959,
        ["Joshua"] = 658, ["Judges"] = 618, ["Ruth"] = 85, ["1 Samuel"] = 810, ["2 Samuel"] = 695,
        ["1 Kings"] = 816, ["2 Kings"] = 719, ["1 Chronicles"] = 942, ["2 Chronicles"] = 822, ["Ezra"] = 280,
        ["Nehemiah"] = 406, ["Esther"] = 167, ["Job"] = 1070, ["Psalms"] = 2461, ["Proverbs"] = 915,
        ["Ecclesiastes"] = 222, ["Song of Solomon"] = 117, ["Isaiah"] = 1292, ["Jeremiah"] = 1364, ["Lamentations"] = 154,
        ["Ezekiel"] = 1273, ["Daniel"] = 357, ["Hosea"] = 197, ["Joel"] = 73, ["Amos"] = 146,
        ["Obadiah"] = 21, ["Jonah"] = 48, ["Micah"] = 105, ["Nahum"] = 47, ["Habakkuk"] = 56,
        ["Zephaniah"] = 53, ["Haggai"] = 38, ["Zechariah"] = 211, ["Malachi"] = 55, ["Matthew"] = 1071,
        ["Mark"] = 678, ["Luke"] = 1151, ["John"] = 879, ["Acts"] = 1007, ["Romans"] = 433,
        ["1 Corinthians"] = 437, ["2 Corinthians"] = 257, ["Galatians"] = 149, ["Ephesians"] = 155, ["Philippians"] = 104,
        ["Colossians"] = 95, ["1 Thessalonians"] = 89, ["2 Thessalonians"] = 47, ["1 Timothy"] = 113, ["2 Timothy"] = 83,
        ["Titus"] = 46, ["Philemon"] = 25, ["Hebrews"] = 303, ["James"] = 108, ["1 Peter"] = 105,
        ["2 Peter"] = 61, ["1 John"] = 105, ["2 John"] = 13, ["3 John"] = 14, ["Jude"] = 25, ["Revelation"] = 404
    };

    private readonly List<BibleVerse> _verses;

    public VerseCatalog(IHostEnvironment? environment = null)
    {
        var dataDirectory = ResolveDataDirectory(environment?.ContentRootPath);
        var loadedVerses = LoadFromDirectory(dataDirectory);

        _verses = loadedVerses.Count > 0 ? loadedVerses : SampleVerses();
        Translations = _verses
            .GroupBy(verse => verse.Translation, StringComparer.OrdinalIgnoreCase)
            .Select(group => new Translation(group.Key.ToUpperInvariant(), TranslationNameFor(group.Key)))
            .OrderBy(translation => translation.Code)
            .ToList();
    }

    public IReadOnlyList<Translation> Translations { get; }

    public int TotalVerseCount => _verses.Count;

    public IReadOnlyDictionary<string, int> VerseCountsByTranslation =>
        _verses
            .GroupBy(verse => verse.Translation, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key.ToUpperInvariant(), group => group.Count(), StringComparer.OrdinalIgnoreCase);

    public bool HasCompleteBible(string translation) =>
        VerseCountsByTranslation.TryGetValue(translation.Trim().ToUpperInvariant(), out var count)
        && count >= CanonicalVerseCounts.Values.Sum();

    public IReadOnlyList<BibleVerse> Search(string? query, string? strongs, string? translation)
    {
        var normalizedQuery = query?.Trim().ToLowerInvariant();
        var normalizedStrongs = strongs?.Trim().ToUpperInvariant();
        var normalizedTranslation = translation?.Trim().ToUpperInvariant();

        return _verses
            .Where(verse => string.IsNullOrWhiteSpace(normalizedTranslation) || verse.Translation.Equals(normalizedTranslation, StringComparison.OrdinalIgnoreCase))
            .Where(verse => string.IsNullOrWhiteSpace(normalizedQuery)
                || IsWholeTermMatch(verse.Reference, normalizedQuery)
                || IsWholeTermMatch(verse.Text, normalizedQuery)
                || verse.EnglishKeywords.Any(keyword => keyword.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase)))
            .Where(verse => string.IsNullOrWhiteSpace(normalizedStrongs)
                || verse.StrongsNumbers.Any(number => number.Equals(normalizedStrongs, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(verse => verse.Reference)
            .ToList();
    }

    public BibleVerse? FindById(string verseId) =>
        _verses.FirstOrDefault(verse => verse.Id.Equals(verseId, StringComparison.OrdinalIgnoreCase));

    private static bool IsWholeTermMatch(string value, string query)
    {
        var pattern = $@"(?<![A-Za-z0-9]){Regex.Escape(query)}(?![A-Za-z0-9])";
        return Regex.IsMatch(value, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static List<BibleVerse> LoadFromDirectory(string dataDirectory)
    {
        if (!Directory.Exists(dataDirectory))
        {
            return [];
        }

        return Directory
            .EnumerateFiles(dataDirectory, "*.json", SearchOption.TopDirectoryOnly)
            .Where(path => !Path.GetFileName(path).Equals("sample.json", StringComparison.OrdinalIgnoreCase))
            .SelectMany(LoadCorpus)
            .ToList();
    }

    private static IReadOnlyList<BibleVerse> LoadCorpus(string path)
    {
        using var stream = File.OpenRead(path);
        using var document = JsonDocument.Parse(stream);
        if (document.RootElement.TryGetProperty("books", out var books))
        {
            return LoadNestedBookCorpus(path, books);
        }

        stream.Position = 0;
        var corpus = JsonSerializer.Deserialize<BibleCorpus>(stream, JsonOptions)
            ?? throw new InvalidOperationException($"Unable to read Bible corpus file: {path}");

        var translation = corpus.Translation.Trim().ToUpperInvariant();
        return corpus.Verses.Select((verse, index) =>
        {
            var reference = $"{verse.Book} {verse.Chapter}:{verse.Verse}";
            return new BibleVerse(
                $"{translation}-{Slug(verse.Book)}-{verse.Chapter}-{verse.Verse}",
                reference,
                translation,
                verse.Text,
                index + 1,
                verse.EnglishKeywords ?? KeywordsFrom(verse.Text),
                verse.StrongsNumbers ?? []);
        }).ToList();
    }

    private static IReadOnlyList<BibleVerse> LoadNestedBookCorpus(string path, JsonElement books)
    {
        var translation = Path.GetFileNameWithoutExtension(path).ToUpperInvariant();
        var verses = new List<BibleVerse>();
        var canonicalIndex = 1;

        foreach (var book in books.EnumerateArray())
        {
            var sourceBookName = book.GetProperty("name").GetString()
                ?? throw new InvalidOperationException($"Book name is missing in {path}.");
            var bookName = CanonicalBookName(sourceBookName);

            foreach (var chapter in book.GetProperty("chapters").EnumerateArray())
            {
                var chapterNumber = chapter.GetProperty("chapter").GetInt32();

                foreach (var verse in chapter.GetProperty("verses").EnumerateArray())
                {
                    var verseNumber = verse.GetProperty("verse").GetInt32();
                    var reference = $"{bookName} {chapterNumber}:{verseNumber}";
                    var text = verse.GetProperty("text").GetString()
                        ?? throw new InvalidOperationException($"Verse text is missing for {reference} in {path}.");

                    verses.Add(new BibleVerse(
                        $"{translation}-{Slug(bookName)}-{chapterNumber}-{verseNumber}",
                        reference,
                        translation,
                        text,
                        canonicalIndex,
                        KeywordsFrom(text),
                        []));
                    canonicalIndex++;
                }
            }
        }

        return verses;
    }

    private static string CanonicalBookName(string sourceBookName) =>
        sourceBookName.Equals("Revelation of John", StringComparison.OrdinalIgnoreCase)
            ? "Revelation"
            : sourceBookName;

    private static string ResolveDataDirectory(string? contentRoot)
    {
        var candidates = new[]
        {
            contentRoot,
            AppContext.BaseDirectory,
            Directory.GetCurrentDirectory()
        };

        foreach (var candidate in candidates.Where(candidate => !string.IsNullOrWhiteSpace(candidate)))
        {
            var direct = Path.Combine(candidate!, "Data", "verses");
            if (Directory.Exists(direct))
            {
                return direct;
            }

            var fromProject = Path.Combine(candidate!, "src", "WordStudy.Api", "Data", "verses");
            if (Directory.Exists(fromProject))
            {
                return fromProject;
            }
        }

        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var fromAncestor = Path.Combine(current.FullName, "src", "WordStudy.Api", "Data", "verses");
            if (Directory.Exists(fromAncestor))
            {
                return fromAncestor;
            }

            current = current.Parent;
        }

        return Path.Combine(contentRoot ?? AppContext.BaseDirectory, "Data", "verses");
    }

    private static string TranslationNameFor(string code) =>
        code.ToUpperInvariant() switch
        {
            "ESV" => "English Standard Version",
            "KJV" => "King James Version",
            "NASB" => "New American Standard Bible",
            "NIV" => "New International Version",
            "WEB" => "World English Bible",
            _ => code.ToUpperInvariant()
        };

    private static string[] KeywordsFrom(string text) =>
        text.Split([' ', ',', '.', ';', ':', '!', '?', '"', '\'', '(', ')', '[', ']'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(word => word.ToLowerInvariant())
            .Where(word => word.Length > 2)
            .Distinct()
            .ToArray();

    private static string Slug(string value) =>
        new(value.ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static List<BibleVerse> SampleVerses() =>
    [
        new("ESV-JOHN-3-16", "John 3:16", "ESV", "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.", 1, ["god", "love", "world", "believe", "life"], ["G25", "G2889", "G4100", "G2222"]),
        new("ESV-1CORINTHIANS-13-4", "1 Corinthians 13:4", "ESV", "Love is patient and kind; love does not envy or boast; it is not arrogant.", 2, ["love", "patient", "kind", "envy"], ["G26", "G3114", "G5541", "G2206"]),
        new("ESV-GALATIANS-5-22", "Galatians 5:22", "ESV", "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness.", 3, ["fruit", "spirit", "love", "joy", "peace"], ["G2590", "G4151", "G26", "G5479", "G1515"]),
        new("ESV-ROMANS-8-28", "Romans 8:28", "ESV", "And we know that for those who love God all things work together for good, for those who are called according to his purpose.", 4, ["know", "love", "god", "good", "purpose"], ["G1492", "G25", "G2316", "G18", "G4286"]),
        new("ESV-HEBREWS-11-1", "Hebrews 11:1", "ESV", "Now faith is the assurance of things hoped for, the conviction of things not seen.", 5, ["faith", "assurance", "hope", "conviction", "seen"], ["G4102", "G5287", "G1679", "G1650", "G991"]),
        new("KJV-JOHN-3-16", "John 3:16", "KJV", "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", 1, ["god", "love", "world", "believe", "life"], ["G25", "G2889", "G4100", "G2222"]),
        new("KJV-1CORINTHIANS-13-4", "1 Corinthians 13:4", "KJV", "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.", 2, ["charity", "love", "patient", "kind", "envy"], ["G26", "G3114", "G5541", "G2206"]),
        new("NASB-JOHN-3-16", "John 3:16", "NASB", "For God so loved the world, that He gave His only Son, so that everyone who believes in Him will not perish, but have eternal life.", 1, ["god", "love", "world", "believe", "life"], ["G25", "G2889", "G4100", "G2222"]),
        new("NIV-JOHN-3-16", "John 3:16", "NIV", "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", 1, ["god", "love", "world", "believe", "life"], ["G25", "G2889", "G4100", "G2222"])
    ];
}
