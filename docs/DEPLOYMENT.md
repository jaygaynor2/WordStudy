# Deployment

## Local

```bash
cd src/WordStudy.Web
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

The site is a static app and can be deployed directly from `src/WordStudy.Web`.

1. In GitHub, open the repository settings.
2. Go to Pages.
3. Set Source to GitHub Actions.
4. Push changes to the `main` branch.

The workflow at `.github/workflows/deploy-pages.yml` uploads `src/WordStudy.Web` and deploys it to GitHub Pages.
