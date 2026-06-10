# Deployment

## Local

```bash
npm install
npm run web
```

Open the local URL printed by Expo.

Native previews:

```bash
npm run ios
npm run android
```

## GitHub Pages

The app exports a static React Native Web build for GitHub Pages.

1. In GitHub, open the repository settings.
2. Go to Pages.
3. Set Build and deployment > Source to GitHub Actions.
4. Push changes to the `main` branch.

The workflow at `.github/workflows/deploy-pages.yml` installs npm dependencies, runs `npm run export:web`, uploads `dist`, and deploys it to GitHub Pages. If Pages is set to Deploy from a branch instead of GitHub Actions, GitHub may publish the repository root and show `README.md` instead of the app.

## Native App Builds

This is an Expo project. Use Expo Application Services when you are ready to produce installable builds:

```bash
npx eas build --platform ios
npx eas build --platform android
```
