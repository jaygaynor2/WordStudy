const { createElement: h, useEffect, useMemo, useState } = React;

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

function App() {
  const [user, setUser] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [studies, setStudies] = useState([]);
  const [activeStudyId, setActiveStudyId] = useState("");
  const [title, setTitle] = useState("Love in John's Gospel");
  const [translation, setTranslation] = useState("KJV");
  const [query, setQuery] = useState("love");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState("verses");
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [error, setError] = useState("");

  const activeStudy = useMemo(
    () => studies.find(study => study.id === activeStudyId) || studies[0],
    [studies, activeStudyId]
  );

  useEffect(() => {
    Promise.all([
      api("/api/translations"),
      api("/api/studies"),
      api("/api/verses/search?query=love&translation=KJV")
    ])
      .then(([translationData, studyData, verseData]) => {
        setTranslations(translationData);
        setStudies(studyData);
        setResults(verseData);
      })
      .catch(showError);
  }, []);

  function showError(err) {
    setError(err.message || "Something went wrong.");
  }

  async function signIn() {
    setError("");
    setUser(await api("/api/auth/dev-login", { method: "POST" }));
  }

  async function signOut() {
    setError("");
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function createStudy(event) {
    event.preventDefault();
    setError("");
    try {
      const study = await api("/api/studies", {
        method: "POST",
        body: JSON.stringify({ title, translation })
      });
      setStudies([study, ...studies]);
      setActiveStudyId(study.id);
      setPage("verses");
    } catch (err) {
      showError(err);
    }
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

  async function addVerse(verseId) {
    if (!activeStudy) {
      setError("Create or select a study first.");
      return;
    }

    setError("");
    try {
      await api(`/api/studies/${activeStudy.id}/verses`, {
        method: "POST",
        body: JSON.stringify({ verseId })
      });
      await refreshStudy(activeStudy.id);
    } catch (err) {
      showError(err);
    }
  }

  async function addAllSearchResults() {
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
    try {
      for (const verse of results) {
        await api(`/api/studies/${activeStudy.id}/verses`, {
          method: "POST",
          body: JSON.stringify({ verseId: verse.id })
        });
      }
      await refreshStudy(activeStudy.id);
    } catch (err) {
      showError(err);
    } finally {
      setIsAddingAll(false);
    }
  }

  async function addNote(studyVerseId, form) {
    const formData = new FormData(form);
    const group = formData.get("group");
    const text = formData.get("text");

    setError("");
    try {
      await api(`/api/studies/${activeStudy.id}/verses/${studyVerseId}/notes`, {
        method: "POST",
        body: JSON.stringify({ group, text })
      });
      form.reset();
      form.elements.group.focus();
      await refreshStudy(activeStudy.id);
    } catch (err) {
      showError(err);
    }
  }

  async function deleteNote(studyVerseId, noteId) {
    if (!activeStudy) {
      setError("Create or select a study first.");
      return;
    }

    setError("");
    try {
      await api(`/api/studies/${activeStudy.id}/verses/${studyVerseId}/notes/${noteId}`, {
        method: "DELETE"
      });
      await refreshStudy(activeStudy.id);
    } catch (err) {
      showError(err);
    }
  }

  async function refreshStudy(studyId) {
    const study = await api(`/api/studies/${studyId}`);
    setStudies(current => current.map(item => item.id === study.id ? study : item));
    setActiveStudyId(study.id);
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
        ),
        h("div", { className: "userbar" },
          user
            ? h(React.Fragment, null,
                h("span", null, user.email),
                h("button", { className: "secondary", onClick: signOut }, "Log out")
              )
            : h("button", { onClick: signIn }, "Continue with Google")
        )
      )
    ),
    h("main", null,
      error && h("div", { className: "alert", role: "alert" }, error),
      h("div", { className: "workspace" },
        h("aside", { className: "panel stack", "aria-label": "Studies" },
          h("section", null,
            h("h2", null, "New Study"),
            h("form", { className: "stack", onSubmit: createStudy },
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
          h("section", null,
            h("h2", null, "Studies"),
            studies.length
              ? h("div", { className: "study-list" }, studies.map(study =>
                  h("button", {
                    key: study.id,
                    className: `study-tab ${activeStudy?.id === study.id ? "active" : ""}`,
                    onClick: () => setActiveStudyId(study.id)
                  },
                    h("strong", null, study.title),
                    h("div", { className: "muted" }, `${study.translation} · ${study.verses.length} verses`)
                  )
                ))
              : h("div", { className: "empty" }, "No studies yet.")
          )
        ),
        h("section", { className: "content" },
          h("nav", { className: "page-tabs", "aria-label": "Study workflow" },
            h("button", {
              className: page === "verses" ? "tab active" : "tab",
              onClick: () => setPage("verses"),
              type: "button"
            }, "Add Verses"),
            h("button", {
              className: page === "notes" ? "tab active" : "tab",
              onClick: () => setPage("notes"),
              type: "button"
            }, "Notes"),
            h("button", {
              className: "tab",
              disabled: !activeStudy || !activeStudy.verses.length,
              onClick: exportStudyCsv,
              type: "button"
            }, "Export CSV")
          ),
          page === "verses"
            ? h("div", { className: "panel" },
                h("div", { className: "page-title" },
                  h("div", null,
                    h("h2", null, "Add Verses"),
                    h("p", { className: "muted" }, activeStudy ? `Adding to ${activeStudy.title}` : "Create or select a study first.")
                  ),
                  activeStudy && h("button", { className: "secondary", onClick: () => setPage("notes"), type: "button" }, "Go to notes")
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
                  h("button", { className: "secondary", onClick: () => setPage("verses"), type: "button" }, "Add more verses")
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
