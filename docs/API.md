# Word Study Data

Word Study is an Expo / React Native app. It does not expose an application API.

The app bundles the Bible corpus from `src/data/verses/KJV.json`, searches ordinary words and references on-device, and stores word studies, selected verses, and notes in local app storage under the `word-study:studies` key.

Strong's-number searches are remote and on demand. Queries that look like `G25` or `H430` are sent to the Bible SuperSearch API with the `kjv_strongs` module, `markup=raw`, and `data_format=minimal`. The app strips raw Strong's markers from verse text, keeps the numbers as result metadata, and shows any returned Strong's definitions above the verse list.
