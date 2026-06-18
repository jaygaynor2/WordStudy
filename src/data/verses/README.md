# Bible Verse Corpus

The Expo app bundles JSON corpora from this directory. `KJV.json` is the active King James Version store.

Use this folder for complete public-domain or properly licensed Bible translation corpora. A complete Protestant Bible contains 31,102 verses.

## Supported Schemas

The KJV store uses a nested book/chapter/verse schema:

```json
{
  "books": [
    {
      "name": "Genesis",
      "chapters": [
        {
          "chapter": 1,
          "name": "Genesis 1",
          "verses": [
            {
              "verse": 1,
              "chapter": 1,
              "name": "Genesis 1:1",
              "text": "Verse text"
            }
          ]
        }
      ]
    }
  ]
}
```

The loader also supports a flat translation corpus:

```json
{
  "translation": "KJV",
  "translationName": "King James Version",
  "verses": [
    {
      "book": "John",
      "chapter": 3,
      "verse": 16,
      "text": "Verse text",
      "englishKeywords": ["love"],
      "strongsNumbers": ["G25"]
    }
  ]
}
```

`englishKeywords` and `strongsNumbers` are optional in the flat schema. If keywords are omitted, they are generated from verse text. The nested KJV file does not include bundled Strong's metadata. In the current Expo app, Strong's-number searches such as `G25` or `H430` are sourced remotely from Bible SuperSearch's `kjv_strongs` module instead of this local corpus.
