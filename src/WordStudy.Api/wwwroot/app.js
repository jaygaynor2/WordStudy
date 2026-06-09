const { createElement: h, useEffect, useMemo, useState } = React;
const STUDIES_STORAGE_KEY = "word-study:studies";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message || "Request failed.");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function loadStoredStudies() {
  try {
    const stored = window.localStorage.getItem(STUDIES_STORAGE_KEY);
    const studies = stored ? JSON.parse(stored) : [];
    return Array.isArray(studies) ? studies : [];
  } catch {
    return [];
  }
}

function createId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const [translations, setTranslations] = useState([]);
  const [studies, setStudies] = useState(loadStoredStudies);
  const [activeStudyId, setActiveStudyId] = useState("");
  const [title, setTitle] = useState("Love in John's Gospel");
  const [translation, setTranslation] = useState("KJV");
  const [query, setQuery] = useState("love");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState("studies");
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [error, setError] = useState("");

  const activeStudy = useMemo(
    () => studies.find(study => study.id === activeStudyId),
    [studies, activeStudyId]
  );
  const canAddVerses = Boolean(activeStudy);
  const canOpenNotes = Boolean(activeStudy?.verses.length);

  useEffect(() => {
    Promise.all([
      api("/api/translations"),
      api("/api/verses/search?query=love&translation=KJV")
    ])
      .then(([translationData, verseData]) => {
        setTranslations(translationData);
        setResults(verseData);
      })
      .catch(showError);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STUDIES_STORAGE_KEY, JSON.stringify(studies));
  }, [studies]);

  function showError(err) {
    setError(err.message || "Something went wrong.");
  }

  function createStudy(event) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Study title is required.");
      return;
    }

    const study = {
      id: createId(),
      title: title.trim(),
      translation,
      createdAt: new Date().toISOString(),
      verses: []
    };
    setStudies(current => [study, ...current]);
    setActiveStudyId(study.id);
    setPage("verses");
  }

  async function searchVerses(event) {
    event.preventDefault();
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    params.set("translation", translation);
    try {
      setResults(await api(`/api/verses/search?${params.toString()}`));
    } catch (err) {
      showError(err);
    }
  }

  function addVerse(verseId) {
    if (!activeStudy) {
      setError("Create or select a study first.");
      return;
    }

    const verse = results.find(item => item.id === verseId);
    if (!verse) {
      setError("Search for the verse before adding it.");
      return;
    }

    setError("");
    setStudies(current => current.map(study => {
      if (study.id !== activeStudy.id) {
        return study;
      }

      if (study.verses.some(studyVerse => studyVerse.verse.id === verse.id)) {
        return study;
      }

      return {
        ...study,
        verses: [
          ...study.verses,
          { id: createId(), verse, notes: [] }
        ]
      };
    }));
  }

  function addAllSearchResults() {
    if (!activeStudy) {
      setError("Create or select a study first.");
      return;
    }

    if (!results.length) {
      setError("Search for verses before adding all results.");
      return;
    }

    setError("");
    setIsAddingAll(true);
    setStudies(current => current.map(study => {
      if (study.id !== activeStudy.id) {
        return study;
      }

      const existingVerseIds = new Set(study.verses.map(studyVerse => studyVerse.verse.id));
      const newEntries = results
        .filter(verse => !existingVerseIds.has(verse.id))
        .map(verse => ({ id: createId(), verse, notes: [] }));

      return {
        ...study,
        verses: [...study.verses, ...newEntries]
      };
    }));
    setIsAddingAll(false);
  }

  function addNote(studyVerseId, form) {
    const formData = new FormData(form);
    const group = String(formData.get("group") || "");
    const text = String(formData.get("text") || "");

    setError("");
    setStudies(current => current.map(study => {
      if (study.id !== activeStudy.id) {
        return study;
      }

      return {
        ...study,
        verses: study.verses.map(studyVerse => {
          if (studyVerse.id !== studyVerseId) {
            return studyVerse;
          }

          return {
            ...studyVerse,
            notes: [
              ...studyVerse.notes,
              {
                id: createId(),
                group: group.trim(),
                text: text.trim(),
                createdAt: new Date().toISOString()
              }
            ]
          };
        })
      };
    }));
    form.reset();
    form.elements.group.focus();
  }

  function deleteNote(studyVerseId, noteId) {
    if (!activeStudy) {
      setError("Create or select a study first.");
      return;
    }

    setError("");
    setStudies(current => current.map(study => {
      if (study.id !== activeStudy.id) {
        return study;
      }

      return {
        ...study,
        verses: study.verses.map(studyVerse => {
          if (studyVerse.id !== studyVerseId) {
            return studyVerse;
          }

          return {
            ...studyVerse,
            notes: studyVerse.notes.filter(note => note.id !== noteId)
          };
        })
      };
    }));
  }

  function selectStudy(studyId) {
    setActiveStudyId(studyId);
    setPage("verses");
  }

  function exportStudyCsv() {
    if (!activeStudy) {
      setError("Create or select a study before exporting.");
      return;
    }

    if (!activeStudy.verses.length) {
      setError("Add verses to the study before exporting.");
      return;
    }

    const rows = [
      ["Index", "Scripture reference", "Text of the verse", "Note group", "Note text"]
    ];

    [...activeStudy.verses]
      .sort((left, right) => left.verse.canonicalIndex - right.verse.canonicalIndex)
      .forEach(studyVerse => {
      if (studyVerse.notes.length) {
        studyVerse.notes.forEach(note => {
          rows.push([studyVerse.verse.canonicalIndex, studyVerse.verse.reference, studyVerse.verse.text, note.group, note.text]);
        });
      } else {
        rows.push([studyVerse.verse.canonicalIndex, studyVerse.verse.reference, studyVerse.verse.text, "", ""]);
      }
    });

    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileNameSafe(activeStudy.title)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setError("");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  function fileNameSafe(value) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "word-study";
  }

  return h("div", { className: "app-shell" },
    h("header", null,
      h("div", { className: "topbar" },
        h("div", { className: "brand" },
          h("h1", null, "Word Study"),
          h("span", null, "Build a verse list, compare translations, and classify notes.")
        )
      )
    ),
    h("main", null,
      error && h("div", { className: "alert", role: "alert" }, error),
      h("div", { className: "workspace" },
        h("section", { className: "content" },
          h("nav", { className: "page-tabs", "aria-label": "Study workflow" },
            h("button", {
              className: page === "studies" ? "tab active" : "tab",
              onClick: () => setPage("studies"),
              type: "button"
            }, "Studies"),
            h("button", {
              className: page === "verses" ? "tab active" : "tab",
              disabled: !canAddVerses,
              onClick: () => setPage("verses"),
              type: "button"
            }, "Add Verses"),
            h("button", {
              className: page === "notes" ? "tab active" : "tab",
              disabled: !canOpenNotes,
              onClick: () => setPage("notes"),
              type: "button"
            }, "Notes"),
            h("button", {
              className: "tab",
              disabled: !canOpenNotes,
              onClick: exportStudyCsv,
              type: "button"
            }, "Export CSV")
          ),
          page === "studies"
            ? h("div", { className: "study-page" },
                h("section", { className: "panel" },
                  h("div", { className: "page-title" },
                    h("div", null,
                      h("h2", null, "Create Study"),
                      h("p", { className: "muted" }, "Start a focused word study with a title and translation.")
                    )
                  ),
                  h("form", { className: "study-form", onSubmit: createStudy },
                    h("label", null, "Study title",
                      h("input", { value: title, onChange: event => setTitle(event.target.value), required: true })
                    ),
                    h("label", null, "Translation",
                      h("select", { value: translation, onChange: event => setTranslation(event.target.value) },
                        translations.map(item => h("option", { key: item.code, value: item.code }, `${item.code} - ${item.name}`))
                      )
                    ),
                    h("button", { type: "submit" }, "Create study")
                  )
                ),
                h("section", { className: "panel" },
                  h("div", { className: "page-title" },
                    h("div", null,
                      h("h2", null, "Choose Study"),
                      h("p", { className: "muted" }, "Pick the study that should receive verses and notes.")
                    )
                  ),
                  studies.length
                    ? h("div", { className: "study-list" }, studies.map(study =>
                        h("button", {
                          key: study.id,
                          className: `study-tab ${activeStudy?.id === study.id ? "active" : ""}`,
                          onClick: () => selectStudy(study.id),
                          type: "button"
                        },
                          h("span", null,
                            h("strong", null, study.title),
                            h("div", { className: "muted" }, `${study.translation} · ${study.verses.length} verses`)
                          ),
                          h("span", { className: "study-action" }, activeStudy?.id === study.id ? "Current" : "Open")
                        )
                      ))
                    : h("div", { className: "empty" }, "No studies yet.")
                )
              )
            : page === "verses"
            ? h("div", { className: "panel" },
                h("div", { className: "page-title" },
                  h("div", null,
                    h("h2", null, "Add Verses"),
                    h("p", { className: "muted" }, activeStudy ? `Adding to ${activeStudy.title}` : "Create or select a study first.")
                  ),
                  h("div", { className: "page-actions" },
                    h("button", { className: "secondary", onClick: () => setPage("studies"), type: "button" }, activeStudy ? "Change study" : "Choose study"),
                    activeStudy && h("button", {
                      className: "secondary",
                      disabled: !canOpenNotes,
                      onClick: () => setPage("notes"),
                      type: "button"
                    }, "Go to notes")
                  )
                ),
                h("form", { className: "search-grid", onSubmit: searchVerses },
                  h("label", null, "English word or reference",
                    h("input", { value: query, onChange: event => setQuery(event.target.value), placeholder: "love, faith, John 3:16" })
                  ),
                  h("label", null, "Translation",
                    h("select", { value: translation, onChange: event => setTranslation(event.target.value) },
                      translations.map(item => h("option", { key: item.code, value: item.code }, item.code))
                    )
                  ),
                  h("button", { type: "submit" }, "Search")
                ),
                h("div", { className: "bulk-actions" },
                  h("span", { className: "muted" }, `${results.length} search ${results.length === 1 ? "result" : "results"}`),
                  h("button", {
                    className: "secondary",
                    disabled: !activeStudy || !results.length || isAddingAll,
                    onClick: addAllSearchResults,
                    type: "button"
                  }, isAddingAll ? "Adding..." : "Add all results")
                ),
                h("div", { className: "results", "aria-live": "polite" },
                  results.length
                    ? results.map(verse => h("article", { className: "card", key: verse.id },
                        h("div", { className: "verse-head" },
                          h("div", null,
                            h("div", { className: "reference" }, verse.reference),
                            h("div", { className: "translation" }, verse.strongsNumbers.length ? `${verse.translation} · ${verse.strongsNumbers.join(", ")}` : verse.translation)
                          ),
                          h("button", { className: "secondary", onClick: () => addVerse(verse.id), type: "button" }, "Add")
                        ),
                        h("p", { className: "verse-text" }, verse.text)
                      ))
                    : h("div", { className: "empty" }, "No verses match that search.")
                )
              )
            : h("div", { className: "panel" },
                h("div", { className: "page-title" },
                  h("div", null,
                    h("h2", null, activeStudy ? `${activeStudy.title} Notes` : "Notes"),
                    h("p", { className: "muted" }, "Add group classifications and free-form notes to verses already in the study.")
                  ),
                  h("div", { className: "page-actions" },
                    h("button", { className: "secondary", onClick: () => setPage("studies"), type: "button" }, activeStudy ? "Change study" : "Choose study"),
                    h("button", { className: "secondary", onClick: () => setPage("verses"), type: "button" }, "Add more verses")
                  )
                ),
                activeStudy
                  ? h("div", { className: "verses" },
                      activeStudy.verses.length
                        ? activeStudy.verses.map(studyVerse => h("article", { className: "card", key: studyVerse.id },
                            h("div", { className: "reference" }, studyVerse.verse.reference),
                            h("p", { className: "verse-text" }, studyVerse.verse.text),
                            h("form", {
                              className: "note-form",
                              onSubmit: event => {
                                event.preventDefault();
                                addNote(studyVerse.id, event.currentTarget);
                              }
                            },
                              h("label", null, "Group",
                                h("input", { name: "group", placeholder: "Observation", required: true })
                              ),
                              h("label", null, "Note",
                                h("textarea", { name: "text", placeholder: "Add a note for this verse", required: true })
                              ),
                              h("button", { type: "submit" }, "Save note")
                            ),
                            h("div", { className: "notes" },
                              studyVerse.notes.map(note => h("div", { className: "note", key: note.id },
                                h("div", { className: "note-head" },
                                  h("strong", null, note.group),
                                  h("button", {
                                    className: "link-button danger",
                                    onClick: () => deleteNote(studyVerse.id, note.id),
                                    type: "button"
                                  }, "Delete")
                                ),
                                h("div", { className: "note-text" }, note.text)
                              ))
                            )
                          ))
                        : h("div", { className: "empty" }, "This study has no verses yet.")
                    )
                  : h("div", { className: "empty" }, "Create a study to start collecting verses.")
              )
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
