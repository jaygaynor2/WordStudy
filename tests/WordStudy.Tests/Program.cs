using WordStudy.Api.Services;

var tests = new List<(string Name, Action Body)>
{
    ("Search finds verses by English keyword", SearchFindsEnglishKeyword),
    ("Search matches whole words only", SearchMatchesWholeWordsOnly),
    ("Search finds verses by reference", SearchFindsReference),
    ("Catalog loads complete KJV Bible", CatalogLoadsCompleteKjvBible)
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

static void SearchFindsEnglishKeyword()
{
    var catalog = new VerseCatalog();
    var results = catalog.Search("love", null, "KJV");
    Assert(results.Count >= 3, "Expected at least three KJV love results.");
}

static void SearchFindsReference()
{
    var catalog = new VerseCatalog();
    var results = catalog.Search("John 3:16", null, "KJV");
    Assert(results.Any(verse => verse.Reference == "John 3:16"), "Expected John 3:16 by reference search.");
}

static void SearchMatchesWholeWordsOnly()
{
    var catalog = new VerseCatalog();
    var fullWordResults = catalog.Search("beginning", null, "KJV");
    var partialWordResults = catalog.Search("beginn", null, "KJV");

    Assert(fullWordResults.Any(verse => verse.Reference == "Genesis 1:1"), "Expected whole word search to find Genesis 1:1.");
    Assert(!partialWordResults.Any(verse => verse.Reference == "Genesis 1:1"), "Expected partial word search not to find Genesis 1:1.");
}

static void CatalogLoadsCompleteKjvBible()
{
    var catalog = new VerseCatalog();
    Assert(catalog.TotalVerseCount >= 31102, "Expected catalog to load the complete KJV Bible.");
    Assert(catalog.HasCompleteBible("KJV"), "Expected KJV to report complete Bible coverage.");
    var firstVerse = catalog.FindById("KJV-GENESIS-1-1");
    var lastVerse = catalog.FindById("KJV-REVELATION-22-21");
    Assert(firstVerse?.Reference == "Genesis 1:1" && firstVerse.CanonicalIndex == 1, "Expected Genesis 1:1 to be index 1.");
    Assert(lastVerse?.Reference == "Revelation 22:21" && lastVerse.CanonicalIndex == 31102, "Expected Revelation 22:21 to be index 31102.");
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
