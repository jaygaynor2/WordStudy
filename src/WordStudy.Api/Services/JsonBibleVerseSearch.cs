using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using WordStudy.Api.Models;

namespace WordStudy.Api.Services;

public sealed class JsonBibleVerseSearch
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyList<BookLookup> Books =
    [
        new("Genesis", "1"), new("Exodus", "2"), new("Leviticus", "3"), new("Numbers", "4"), new("Deuteronomy", "5"),
        new("Joshua", "6"), new("Judges", "7"), new("Ruth", "8"), new("1 Samuel", "9"), new("2 Samuel", "10"),
        new("1 Kings", "11"), new("2 Kings", "12"), new("1 Chronicles", "13"), new("2 Chronicles", "14"), new("Ezra", "15"),
        new("Nehemiah", "16"), new("Esther", "17"), new("Job", "18"), new("Psalms", "19"), new("Proverbs", "20"),
        new("Ecclesiastes", "21"), new("Song of Solomon", "22"), new("Isaiah", "23"), new("Jeremiah", "24"), new("Lamentations", "25"),
        new("Ezekiel", "26"), new("Daniel", "27"), new("Hosea", "28"), new("Joel", "29"), new("Amos", "30"),
        new("Obadiah", "31"), new("Jonah", "32"), new("Micah", "33"), new("Nahum", "34"), new("Habakkuk", "35"),
        new("Zephaniah", "36"), new("Haggai", "37"), new("Zechariah", "38"), new("Malachi", "39"), new("Matthew", "40"),
        new("Mark", "41"), new("Luke", "42"), new("John", "43"), new("Acts", "44"), new("Romans", "45"),
        new("1 Corinthians", "46"), new("2 Corinthians", "47"), new("Galatians", "48"), new("Ephesians", "49"), new("Philippians", "50"),
        new("Colossians", "51"), new("1 Thessalonians", "52"), new("2 Thessalonians", "53"), new("1 Timothy", "54"), new("2 Timothy", "55"),
        new("Titus", "56"), new("Philemon", "57"), new("Hebrews", "58"), new("James", "59"), new("1 Peter", "60"),
        new("2 Peter", "61"), new("1 John", "62"), new("2 John", "63"), new("3 John", "64"), new("Jude", "65"), new("Revelation", "66")
    ];

    private readonly HttpClient _httpClient;
    private readonly VerseCatalog _catalog;

    public JsonBibleVerseSearch(HttpClient httpClient, VerseCatalog catalog)
    {
        _httpClient = httpClient;
        _catalog = catalog;
        _httpClient.BaseAddress = new Uri("https://jsonbible.com/");
    }

    public async Task<IReadOnlyList<BibleVerse>?> SearchReferenceAsync(string? query, string? translation, CancellationToken cancellationToken)
    {
        if (!TryParseReference(query, out var reference) || !IsKingJames(translation))
        {
            return null;
        }

        var request = new JsonBibleRequest(
            reference.Book.Name,
            reference.Book.Bid,
            reference.Chapter.ToString(),
            ToRoman(reference.Chapter),
            reference.Verse.ToString(),
            1,
            $"read-{BookToken(reference.Book.Name)}-{reference.Chapter + 1}");

        var json = JsonSerializer.Serialize(request, JsonOptions);
        var path = $"search/verses-w-strongs.php?json={Uri.EscapeDataString(json)}&_={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        using var httpRequest = new HttpRequestMessage(HttpMethod.Get, path);
        httpRequest.Headers.Referrer = new Uri("https://jsonbible.com/");
        httpRequest.Headers.TryAddWithoutValidation("x-requested-with", "XMLHttpRequest");

        using var response = await SendAsync(httpRequest, cancellationToken);
        if (response is null || !response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var result = await JsonSerializer.DeserializeAsync<JsonBibleResponse>(stream, JsonOptions, cancellationToken);
        if (result is null || string.IsNullOrWhiteSpace(result.Text))
        {
            return null;
        }

        var localVerse = _catalog.FindById($"KJV-{Slug(reference.Book.Name)}-{reference.Chapter}-{reference.Verse}");
        var text = StripStrongMarkup(result.Text);
        return
        [
            new BibleVerse(
                localVerse?.Id ?? $"KJV-{Slug(reference.Book.Name)}-{reference.Chapter}-{reference.Verse}",
                $"{reference.Book.Name} {reference.Chapter}:{reference.Verse}",
                result.Version?.ToUpperInvariant() ?? "KJV",
                text,
                localVerse?.CanonicalIndex ?? 0,
                KeywordsFrom(text),
                StrongNumbersFrom(result.Text))
        ];
    }

    public async Task<IReadOnlyList<BibleVerse>?> SearchByStrongsAsync(string? query, string strongs, string? translation, CancellationToken cancellationToken)
    {
        var normalizedStrongs = NormalizeStrongs(strongs);
        if (string.IsNullOrWhiteSpace(normalizedStrongs) || !IsKingJames(translation))
        {
            return null;
        }

        if (TryParseReference(query, out _))
        {
            var referenceResults = await SearchReferenceAsync(query, translation, cancellationToken);
            return referenceResults?
                .Where(verse => verse.StrongsNumbers.Contains(normalizedStrongs, StringComparer.OrdinalIgnoreCase))
                .ToList() ?? [];
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        var candidates = _catalog.Search(query, null, translation)
            .OrderBy(verse => verse.CanonicalIndex)
            .Take(100)
            .ToList();
        var matches = new List<BibleVerse>();

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var enriched = await SearchReferenceAsync(candidate.Reference, candidate.Translation, cancellationToken);
            var verse = enriched?.FirstOrDefault();
            if (verse is not null && verse.StrongsNumbers.Contains(normalizedStrongs, StringComparer.OrdinalIgnoreCase))
            {
                matches.Add(verse);
            }
        }

        return matches;
    }

    private async Task<HttpResponseMessage?> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return null;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return null;
        }
    }

    private static bool TryParseReference(string? query, out VerseReference reference)
    {
        reference = default;
        if (string.IsNullOrWhiteSpace(query))
        {
            return false;
        }

        var trimmed = query.Trim();
        foreach (var book in Books.OrderByDescending(book => book.Name.Length))
        {
            if (!trimmed.StartsWith($"{book.Name} ", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var chapterVerse = trimmed[book.Name.Length..].Trim();
            var match = Regex.Match(chapterVerse, @"^(?<chapter>\d+):(?<verse>\d+)$");
            if (!match.Success)
            {
                return false;
            }

            reference = new VerseReference(book, int.Parse(match.Groups["chapter"].Value), int.Parse(match.Groups["verse"].Value));
            return true;
        }

        return false;
    }

    private static bool IsKingJames(string? translation) =>
        string.IsNullOrWhiteSpace(translation) || translation.Equals("KJV", StringComparison.OrdinalIgnoreCase);

    private static string StripStrongMarkup(string value) =>
        WebUtility.HtmlDecode(Regex.Replace(value, @"\[/?data(?: strongs=""\d+"")?\]", string.Empty));

    private static string[] StrongNumbersFrom(string value) =>
        Regex.Matches(value, @"strongs=""(?<number>\d+)""")
            .Select(match => $"G{match.Groups["number"].Value}")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static string NormalizeStrongs(string value)
    {
        var trimmed = value.Trim().ToUpperInvariant();
        if (Regex.IsMatch(trimmed, @"^\d+$"))
        {
            return $"G{trimmed}";
        }

        return Regex.IsMatch(trimmed, @"^[GH]\d+$") ? trimmed : string.Empty;
    }

    private static string[] KeywordsFrom(string text) =>
        text.Split([' ', ',', '.', ';', ':', '!', '?', '"', '\'', '(', ')', '[', ']'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(word => word.ToLowerInvariant())
            .Where(word => word.Length > 2)
            .Distinct()
            .ToArray();

    private static string Slug(string value) =>
        new(value.ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static string BookToken(string value) =>
        value.ToLowerInvariant() switch
        {
            "john" => "joh",
            "revelation" => "rev",
            _ => Regex.Replace(value.ToLowerInvariant(), @"[^a-z0-9]", string.Empty)
        };

    private static string ToRoman(int value)
    {
        var map = new (int Value, string Numeral)[]
        {
            (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")
        };

        var remaining = value;
        var result = string.Empty;
        foreach (var item in map)
        {
            while (remaining >= item.Value)
            {
                result += item.Numeral;
                remaining -= item.Value;
            }
        }

        return result;
    }

    private readonly record struct BookLookup(string Name, string Bid);
    private readonly record struct VerseReference(BookLookup Book, int Chapter, int Verse);
    private sealed record JsonBibleRequest(
        string Book,
        string Bid,
        string Chapter,
        [property: JsonPropertyName("chapter_roman")] string ChapterRoman,
        string Verse,
        int Found,
        [property: JsonPropertyName("next_chapter")] string NextChapter);
    private sealed record JsonBibleResponse(string Book, string Chapter, string Verses, string Text, string Version);
}
