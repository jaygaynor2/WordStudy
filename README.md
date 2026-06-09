# Word Study

A Bible word-study product built from the project specification. Users can create studies, search Bible verses by English word or Strong's number, add verses to a study, and attach classified free-form notes to each verse.

## Tech Stack

- Static React frontend
- Browser `localStorage` for word studies
- GitHub Pages deployment
- Markdown data and deployment documentation

## Run

```bash
cd src/WordStudy.Web
python3 -m http.server 8080
```

## Test

```bash
dotnet run --project tests/WordStudy.Tests
```

## Notes

The app stores word studies, selected verses, and notes in browser `localStorage` so the product can run locally without database setup. The King James Version verse store is loaded from `src/WordStudy.Web/data/verses/KJV.json` and contains the full 31,102-verse Bible. Production should add cross-device persistent study storage and licensed translation providers for non-public-domain translations.

## Deploy

GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`. Enable GitHub Pages for the repository with source set to GitHub Actions, then push to `main`. 
