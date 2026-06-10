# Word Study

A Bible word-study product built from the project specification. Users can create studies, search Bible verses by English word or Strong's number, add verses to a study, and attach classified free-form notes to each verse.

## Tech Stack

- Expo / React Native app
- React Native Web static export for GitHub Pages
- AsyncStorage-backed local study storage
- Markdown data and deployment documentation

## Run

```bash
npm install
npm run web
```

Native previews:

```bash
npm run ios
npm run android
```

## Test

```bash
dotnet run --project tests/WordStudy.Tests
```

## Notes

The app stores word studies, selected verses, and notes in local device/browser storage so the product can run without database setup. The King James Version verse store is bundled from `src/data/verses/KJV.json` and contains the full 31,102-verse Bible. Production should add cross-device persistent study storage and licensed translation providers for non-public-domain translations.

## Deploy

GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`. Enable GitHub Pages for the repository with source set to GitHub Actions, then push to `main`. The workflow runs `npm run export:web` and publishes the Expo web export.
