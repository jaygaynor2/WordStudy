# Word Study API

Base URL: `/api`

## Auth

- `GET /auth/config` returns whether Google OAuth is configured.
- `POST /auth/dev-login` returns a development user for local use.
- `POST /auth/logout` clears the current session boundary.

Production Google sign-in should be connected with Azure App Service authentication or ASP.NET Core OpenID Connect using `GOOGLE_CLIENT_ID` and a client secret stored in Azure Key Vault.

## Translations

- `GET /translations` lists supported Bible translations.

Translations are discovered from the loaded corpus files in `src/WordStudy.Api/Data/verses`.

## Verse Search

- `GET /verses/catalog` returns total verse counts and which loaded translations contain a complete 31,102-verse Bible corpus.
- `GET /verses/search?query=love&strongs=G25&translation=KJV`

All parameters are optional. `query` matches references, verse text, and English keyword metadata. `strongs` matches Strong's numbers when a loaded corpus provides Strong's metadata.

## Studies

- `GET /studies`
- `GET /studies/{id}`
- `POST /studies`

```json
{
  "title": "Love in John's Gospel",
  "translation": "ESV"
}
```

## Study Verses

- `POST /studies/{id}/verses`

```json
{
  "verseId": "ESV-JHN-3-16"
}
```

## Notes

- `POST /studies/{studyId}/verses/{studyVerseId}/notes`

```json
{
  "group": "Observation",
  "text": "Love is expressed through giving."
}
```
