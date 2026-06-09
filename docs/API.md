# Word Study Data

Word Study is a static browser app. It does not expose an application API.

The frontend loads the Bible corpus from `src/WordStudy.Web/data/verses/KJV.json`, searches it in the browser, and stores word studies, selected verses, and notes in browser `localStorage` under the `word-study:studies` key.
