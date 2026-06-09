# Word Study API

Base URL: `/api`

## Translations

- `GET /translations` lists supported Bible translations.

Translations are discovered from the loaded corpus files in `src/WordStudy.Api/Data/verses`.

## Verse Search

- `GET /verses/catalog` returns total verse counts and which loaded translations contain a complete 31,102-verse Bible corpus.
- `GET /verses/search?query=love&strongs=G25&translation=KJV`

All parameters are optional. `query` matches references, verse text, and English keyword metadata. `strongs` matches Strong's numbers when a loaded corpus provides Strong's metadata.

## Studies, Study Verses, and Notes

Word studies are stored in the browser with `localStorage` under the `word-study:studies` key. The API does not persist study, verse selection, or note data.
