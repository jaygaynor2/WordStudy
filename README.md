# Word Study

A Bible word-study product built from the project specification. Users can create studies, search Bible verses by English word or Strong's number, add verses to a study, and attach classified free-form notes to each verse.

## Tech Stack

- ASP.NET Core / C# REST API
- Static React frontend served by the API
- Docker container
- Kubernetes manifest for Azure Kubernetes Service
- Markdown API and deployment documentation

## Run

```bash
dotnet run --project src/WordStudy.Api
```

## Test

```bash
dotnet run --project tests/WordStudy.Tests
```

## Notes

The app stores word studies, selected verses, and notes in browser `localStorage` so the product can run locally without database setup. The King James Version verse store is loaded from `src/WordStudy.Api/Data/verses/KJV.json` and contains the full 31,102-verse Bible. Production should add cross-device persistent study storage and licensed translation providers for non-public-domain translations.
