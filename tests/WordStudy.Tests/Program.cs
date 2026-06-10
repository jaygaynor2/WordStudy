using System.Text.Json;

var tests = new List<(string Name, Action Body)>
{
    ("KJV corpus is available for frontend search", KjvCorpusIsAvailableForFrontendSearch),
    ("KJV corpus contains a complete Bible", KjvCorpusContainsCompleteBible)
};

var failures = 0;
foreach (var (name, body) in tests)
{
    try
    {
        body();
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception ex)
    {
        failures++;
        Console.WriteLine($"FAIL {name}: {ex.Message}");
    }
}

return failures == 0 ? 0 : 1;

static void KjvCorpusIsAvailableForFrontendSearch()
{
    using var document = JsonDocument.Parse(File.ReadAllText(KjvCorpusPath()));
    var books = document.RootElement.GetProperty("books");
    Assert(books.GetArrayLength() == 66, "Expected the KJV corpus to contain 66 books.");
}

static void KjvCorpusContainsCompleteBible()
{
    using var document = JsonDocument.Parse(File.ReadAllText(KjvCorpusPath()));
    var verseCount = document.RootElement
        .GetProperty("books")
        .EnumerateArray()
        .SelectMany(book => book.GetProperty("chapters").EnumerateArray())
        .SelectMany(chapter => chapter.GetProperty("verses").EnumerateArray())
        .Count();

    Assert(verseCount >= 31102, "Expected the KJV corpus to contain the complete 31,102-verse Bible.");
}

static string KjvCorpusPath()
{
    var current = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (current is not null)
    {
        var path = Path.Combine(current.FullName, "src", "data", "verses", "KJV.json");
        if (File.Exists(path))
        {
            return path;
        }

        current = current.Parent;
    }

    throw new InvalidOperationException("Unable to locate src/data/verses/KJV.json.");
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
