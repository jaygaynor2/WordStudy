import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import kjvCorpus from "./src/data/verses/KJV.json";

const STUDIES_STORAGE_KEY = "word-study:studies";
const DEFAULT_TITLE = "";
const DEFAULT_TRANSLATION = "KJV";
const DEFAULT_QUERY = "";

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function translationNameFor(code) {
  const names = {
    KJV: "King James Version"
  };

  return names[code.toUpperCase()] || code.toUpperCase();
}

function slug(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function canonicalBookName(sourceBookName) {
  return sourceBookName.toLowerCase() === "revelation of john" ? "Revelation" : sourceBookName;
}

function keywordsFrom(text) {
  return text
    .split(/[\s,.;:!?"'()[\]]+/)
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 2)
    .filter((word, index, words) => words.indexOf(word) === index);
}

function loadNestedBookCorpus(corpus, translation = "KJV") {
  const verses = [];
  let canonicalIndex = 1;

  for (const book of corpus.books || []) {
    const bookName = canonicalBookName(book.name);

    for (const chapter of book.chapters || []) {
      const chapterNumber = chapter.chapter;

      for (const verse of chapter.verses || []) {
        const verseNumber = verse.verse;
        const reference = `${bookName} ${chapterNumber}:${verseNumber}`;
        const text = verse.text || "";
        verses.push({
          id: `${translation}-${slug(bookName)}-${chapterNumber}-${verseNumber}`,
          reference,
          translation,
          text,
          canonicalIndex,
          englishKeywords: keywordsFrom(text),
          strongsNumbers: []
        });
        canonicalIndex++;
      }
    }
  }

  return verses;
}

function isWholeTermMatch(value, query) {
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(query)}([^A-Za-z0-9]|$)`, "i").test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchCatalog(verses, query, translation) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTranslation = translation.trim().toUpperCase();
  if (!normalizedQuery) {
    return [];
  }

  return verses
    .filter(verse => !normalizedTranslation || verse.translation.toUpperCase() === normalizedTranslation)
    .filter(verse => isWholeTermMatch(verse.reference, normalizedQuery)
      || isWholeTermMatch(verse.text, normalizedQuery)
      || verse.englishKeywords.some(keyword => keyword.toLowerCase() === normalizedQuery))
    .sort((left, right) => left.canonicalIndex - right.canonicalIndex);
}

function translationsFrom(verses) {
  return [...new Set(verses.map(verse => verse.translation.toUpperCase()))]
    .sort()
    .map(code => ({ code, name: translationNameFor(code) }));
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

function studiesFromBackup(backup) {
  if (Array.isArray(backup)) {
    return backup;
  }

  const storedStudies = backup?.localStorage?.[STUDIES_STORAGE_KEY] ?? backup?.[STUDIES_STORAGE_KEY] ?? backup?.studies;
  const studies = typeof storedStudies === "string" ? JSON.parse(storedStudies) : storedStudies;
  if (!Array.isArray(studies)) {
    throw new Error("Backup file does not contain Word Study data.");
  }

  return studies;
}

function downloadWebFile(contents, fileName, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const verses = useMemo(() => loadNestedBookCorpus(kjvCorpus), []);
  const translations = useMemo(() => translationsFrom(verses), [verses]);
  const [studies, setStudies] = useState([]);
  const [activeStudyId, setActiveStudyId] = useState("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [translation, setTranslation] = useState(DEFAULT_TRANSLATION);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState("studies");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [hydrated, setHydrated] = useState(false);

  const activeStudy = useMemo(
    () => studies.find(study => study.id === activeStudyId),
    [studies, activeStudyId]
  );
  const noteGroups = useMemo(() => {
    if (!activeStudy) {
      return [];
    }

    return [...new Set(activeStudy.verses
      .flatMap(studyVerse => studyVerse.notes.map(note => note.group.trim()))
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  }, [activeStudy]);
  const canAddVerses = Boolean(activeStudy);
  const canOpenNotes = Boolean(activeStudy?.verses.length);

  useEffect(() => {
    setResults(searchCatalog(verses, query, translation));
  }, [verses]);

  useEffect(() => {
    AsyncStorage.getItem(STUDIES_STORAGE_KEY)
      .then(stored => {
        const parsed = stored ? JSON.parse(stored) : [];
        setStudies(Array.isArray(parsed) ? parsed : []);
      })
      .catch(() => setStudies([]))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) {
      AsyncStorage.setItem(STUDIES_STORAGE_KEY, JSON.stringify(studies));
    }
  }, [hydrated, studies]);

  function showError(err) {
    setError(err.message || "Something went wrong.");
  }

  function createStudy() {
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

  function searchVerses() {
    setError("");
    setResults(searchCatalog(verses, query, translation));
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
      if (study.id !== activeStudy.id || study.verses.some(studyVerse => studyVerse.verse.id === verse.id)) {
        return study;
      }

      return {
        ...study,
        verses: [...study.verses, { id: createId(), verse, notes: [] }]
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
  }

  function updateNoteDraft(studyVerseId, field, value) {
    setNoteDrafts(current => ({
      ...current,
      [studyVerseId]: {
        group: "",
        text: "",
        ...(current[studyVerseId] || {}),
        [field]: value
      }
    }));
  }

  function addNote(studyVerseId) {
    const draft = noteDrafts[studyVerseId] || { group: "", text: "" };
    const group = draft.group.trim();
    const text = draft.text.trim();
    if (!group || !text) {
      setError("Group and note are required.");
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
            notes: [
              ...studyVerse.notes,
              { id: createId(), group, text, createdAt: new Date().toISOString() }
            ]
          };
        })
      };
    }));
    setNoteDrafts(current => ({ ...current, [studyVerseId]: { group: "", text: "" } }));
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
        verses: study.verses.map(studyVerse => studyVerse.id === studyVerseId
          ? { ...studyVerse, notes: studyVerse.notes.filter(note => note.id !== noteId) }
          : studyVerse)
      };
    }));
  }

  function selectStudy(studyId) {
    setActiveStudyId(studyId);
    setPage("verses");
  }

  async function exportBackup() {
    const backup = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      localStorage: {
        [STUDIES_STORAGE_KEY]: JSON.stringify(studies)
      }
    }, null, 2);
    const fileName = `word-study-backup-${new Date().toISOString().slice(0, 10)}.json`;

    if (Platform.OS === "web") {
      downloadWebFile(backup, fileName, "application/json");
      setSettingsOpen(false);
      return;
    }

    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, backup);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Export Word Study backup" });
    } else {
      await Share.share({ message: backup });
    }
    setSettingsOpen(false);
  }

  async function importBackup() {
    try {
      if (Platform.OS === "web") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = async event => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const importedStudies = studiesFromBackup(JSON.parse(await file.text()));
          setStudies(importedStudies);
          setActiveStudyId("");
          setPage("studies");
          setSettingsOpen(false);
          setError("Backup restored.");
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) {
        return;
      }

      const contents = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const importedStudies = studiesFromBackup(JSON.parse(contents));
      setStudies(importedStudies);
      setActiveStudyId("");
      setPage("studies");
      setSettingsOpen(false);
      setError("Backup restored.");
    } catch (err) {
      showError(err);
    }
  }

  function resetApplication() {
    const reset = () => {
      AsyncStorage.removeItem(STUDIES_STORAGE_KEY);
      setStudies([]);
      setActiveStudyId("");
      setTitle(DEFAULT_TITLE);
      setTranslation(DEFAULT_TRANSLATION);
      setQuery(DEFAULT_QUERY);
      setResults(searchCatalog(verses, DEFAULT_QUERY, DEFAULT_TRANSLATION));
      setPage("studies");
      setSettingsOpen(false);
      setError("Application data cleared.");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Clear all Word Study data from this browser and reset the application?")) {
        reset();
      }
      return;
    }

    Alert.alert("Clear and reset?", "Clear all Word Study data from this device and reset the application?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: reset }
    ]);
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

    const rows = [["Index", "Scripture reference", "Text of the verse", "Note group", "Note text"]];
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
    const fileName = `${fileNameSafe(activeStudy.title)}.csv`;
    if (Platform.OS === "web") {
      downloadWebFile(csv, fileName, "text/csv;charset=utf-8");
    } else {
      Share.share({ message: csv, title: fileName });
    }
  }

  function renderStudiesPage() {
    return (
      <View style={styles.studyPage}>
        <View style={styles.panel}>
          <TitleBlock title="Create Study" subtitle="Start a focused word study with a title and translation." />
          <Field label="Study title">
            <TextInput value={title} onChangeText={setTitle} style={styles.input} />
          </Field>
          <Field label="Translation">
            <View style={styles.readOnlySelect}>
              <Text style={styles.readOnlySelectText}>{translation} - {translationNameFor(translation)}</Text>
            </View>
          </Field>
          <Button label="Create study" onPress={createStudy} />
        </View>
        <View style={styles.panel}>
          <TitleBlock title="Choose Study" subtitle="Pick the study that should receive verses and notes." />
          {studies.length ? studies.map(study => (
            <Pressable
              key={study.id}
              onPress={() => selectStudy(study.id)}
              style={[styles.studyTab, activeStudy?.id === study.id && styles.studyTabActive]}
            >
              <View style={styles.flex}>
                <Text style={styles.reference}>{study.title}</Text>
                <Text style={styles.muted}>{study.translation} · {study.verses.length} verses</Text>
              </View>
              <Text style={styles.studyAction}>{activeStudy?.id === study.id ? "Current" : "Open"}</Text>
            </Pressable>
          )) : <Empty message="No studies yet." />}
        </View>
      </View>
    );
  }

  function renderVersesPage() {
    return (
      <View style={styles.panel}>
        <View style={styles.pageTitle}>
          <TitleBlock title="Add Verses" subtitle={activeStudy ? `Adding to ${activeStudy.title}` : "Create or select a study first."} />
          <View style={styles.pageActions}>
            <Button label={activeStudy ? "Change study" : "Choose study"} secondary onPress={() => setPage("studies")} />
            {activeStudy ? <Button label="Go to notes" secondary disabled={!canOpenNotes} onPress={() => setPage("notes")} /> : null}
          </View>
        </View>
        <View style={styles.searchGrid}>
          <Field label="English word or reference">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="love, faith, John 3:16"
              placeholderTextColor="#8a96a3"
              style={styles.input}
            />
          </Field>
          <Button label="Search" onPress={searchVerses} />
        </View>
        <View style={styles.bulkActions}>
          <Text style={styles.muted}>{results.length} search {results.length === 1 ? "result" : "results"}</Text>
          <Button label="Add all results" secondary disabled={!activeStudy || !results.length} onPress={addAllSearchResults} />
        </View>
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <VerseResult verse={item} onAdd={() => addVerse(item.id)} />}
          ListEmptyComponent={<Empty message="No verses match that search." />}
          scrollEnabled={false}
        />
      </View>
    );
  }

  function renderNotesPage() {
    return (
      <View style={styles.panel}>
        <View style={styles.pageTitle}>
          <TitleBlock title={activeStudy ? `${activeStudy.title} Notes` : "Notes"} subtitle="Add group classifications and free-form notes to verses already in the study." />
          <View style={styles.pageActions}>
            <Button label={activeStudy ? "Change study" : "Choose study"} secondary onPress={() => setPage("studies")} />
            <Button label="Add more verses" secondary onPress={() => setPage("verses")} />
          </View>
        </View>
        {activeStudy ? (
          activeStudy.verses.length ? activeStudy.verses.map(studyVerse => {
            const draft = noteDrafts[studyVerse.id] || { group: "", text: "" };
            return (
              <View style={styles.card} key={studyVerse.id}>
                <Text style={styles.reference}>{studyVerse.verse.reference}</Text>
                <Text style={styles.verseText}>{studyVerse.verse.text}</Text>
                <View style={styles.noteForm}>
                  <Field label="Group">
                    <TextInput
                      value={draft.group}
                      onChangeText={value => updateNoteDraft(studyVerse.id, "group", value)}
                      placeholder="Observation"
                      placeholderTextColor="#8a96a3"
                      style={styles.input}
                    />
                  </Field>
                  {noteGroups.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSuggestions}>
                      {noteGroups.map(group => (
                        <Pressable key={group} style={styles.groupChip} onPress={() => updateNoteDraft(studyVerse.id, "group", group)}>
                          <Text style={styles.groupChipText}>{group}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                  <Field label="Note">
                    <TextInput
                      value={draft.text}
                      onChangeText={value => updateNoteDraft(studyVerse.id, "text", value)}
                      multiline
                      placeholder="Add a note for this verse"
                      placeholderTextColor="#8a96a3"
                      style={[styles.input, styles.textArea]}
                    />
                  </Field>
                  <Button label="Save note" onPress={() => addNote(studyVerse.id)} />
                </View>
                {studyVerse.notes.map(note => (
                  <View style={styles.note} key={note.id}>
                    <View style={styles.noteHead}>
                      <Text style={styles.reference}>{note.group}</Text>
                      <Pressable onPress={() => deleteNote(studyVerse.id, note.id)}>
                        <Text style={styles.dangerLink}>Delete</Text>
                      </Pressable>
                    </View>
                    <Text>{note.text}</Text>
                  </View>
                ))}
              </View>
            );
          }) : <Empty message="This study has no verses yet." />
        ) : <Empty message="Create a study to start collecting verses." />}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.appShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>Word Study</Text>
            <Text style={styles.brandSubtitle}>Build a verse list, compare translations, and classify notes.</Text>
          </View>
          <Pressable accessibilityLabel="Application settings" onPress={() => setSettingsOpen(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
        </View>
        {error ? <View style={styles.alert}><Text style={styles.alertText}>{error}</Text></View> : null}
        <View style={styles.tabs}>
          <TabButton label="Studies" active={page === "studies"} onPress={() => setPage("studies")} />
          <TabButton label="Add Verses" active={page === "verses"} disabled={!canAddVerses} onPress={() => setPage("verses")} />
          <TabButton label="Notes" active={page === "notes"} disabled={!canOpenNotes} onPress={() => setPage("notes")} />
          <TabButton label="Export CSV" disabled={!canOpenNotes} onPress={exportStudyCsv} />
        </View>
        {page === "studies" ? renderStudiesPage() : page === "verses" ? renderVersesPage() : renderNotesPage()}
      </ScrollView>
      <Modal transparent animationType="fade" visible={settingsOpen} onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setSettingsOpen(false)}>
          <View style={styles.settingsMenu}>
            <Button label="Export backup" secondary onPress={exportBackup} />
            <Button label="Import backup" secondary onPress={importBackup} />
            <Button label="Clear and reset" danger onPress={resetApplication} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TitleBlock({ title, subtitle }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Button({ label, onPress, secondary, danger, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText, danger && styles.dangerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ label, active, disabled, onPress }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.tab, active && styles.activeTab, disabled && styles.disabledButton]}>
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ message }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

function VerseResult({ verse, onAdd }) {
  return (
    <View style={styles.card}>
      <View style={styles.verseHead}>
        <View style={styles.flex}>
          <Text style={styles.reference}>{verse.reference}</Text>
          <Text style={styles.translation}>{verse.translation}</Text>
        </View>
        <Button label="Add" secondary onPress={onAdd} />
      </View>
      <Text style={styles.verseText}>{verse.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fa"
  },
  appShell: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    padding: 20,
    gap: 18
  },
  header: {
    backgroundColor: "#fff",
    borderColor: "#d9e0e8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  brandTitle: {
    color: "#17202a",
    fontSize: 22,
    fontWeight: "700"
  },
  brandSubtitle: {
    color: "#5f6b7a",
    marginTop: 2
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center"
  },
  alert: {
    padding: 14,
    borderColor: "#9a3412",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff7ed"
  },
  alertText: {
    color: "#9a3412"
  },
  tabs: {
    borderBottomColor: "#d9e0e8",
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 3
  },
  activeTab: {
    borderBottomColor: "#0f766e"
  },
  tabText: {
    color: "#5f6b7a",
    fontWeight: "600"
  },
  activeTabText: {
    color: "#115e59"
  },
  studyPage: {
    gap: 18,
    flexDirection: Platform.select({ web: "row", default: "column" }),
    alignItems: "flex-start"
  },
  panel: {
    width: "100%",
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    borderColor: "#d9e0e8",
    borderWidth: 1,
    borderRadius: 8,
    gap: 12
  },
  card: {
    width: "100%",
    padding: 14,
    backgroundColor: "#fff",
    borderColor: "#d9e0e8",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10
  },
  titleBlock: {
    marginBottom: 4
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#17202a",
    marginBottom: 4
  },
  pageTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap"
  },
  pageActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  field: {
    gap: 6,
    marginBottom: 10
  },
  label: {
    color: "#5f6b7a",
    fontSize: 14
  },
  input: {
    minHeight: 40,
    borderColor: "#b8c2cc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    color: "#17202a"
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: "top"
  },
  readOnlySelect: {
    minHeight: 40,
    borderColor: "#b8c2cc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: "#fff"
  },
  readOnlySelectText: {
    color: "#17202a"
  },
  searchGrid: {
    gap: 10
  },
  bulkActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderColor: "#0f766e",
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButton: {
    backgroundColor: "#fff"
  },
  dangerButton: {
    backgroundColor: "#fff",
    borderColor: "#b42318"
  },
  disabledButton: {
    opacity: 0.55
  },
  pressedButton: {
    opacity: 0.85
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  secondaryButtonText: {
    color: "#115e59"
  },
  dangerButtonText: {
    color: "#b42318"
  },
  studyTab: {
    width: "100%",
    padding: 10,
    borderColor: "#d9e0e8",
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8
  },
  studyTabActive: {
    borderColor: "#0f766e",
    borderLeftWidth: 4
  },
  studyAction: {
    color: "#115e59",
    fontWeight: "700"
  },
  verseHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start"
  },
  reference: {
    color: "#17202a",
    fontWeight: "700"
  },
  translation: {
    color: "#5f6b7a",
    fontSize: 13
  },
  verseText: {
    color: "#17202a",
    lineHeight: 22,
    marginTop: 8
  },
  noteForm: {
    marginTop: 12,
    gap: 10
  },
  groupSuggestions: {
    marginTop: -4,
    marginBottom: 6
  },
  groupChip: {
    borderColor: "#0f766e",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8
  },
  groupChipText: {
    color: "#115e59",
    fontWeight: "600"
  },
  note: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftColor: "#0f766e",
    borderLeftWidth: 3,
    backgroundColor: "#f8fbfb"
  },
  noteHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2
  },
  dangerLink: {
    color: "#b42318",
    fontWeight: "700"
  },
  empty: {
    padding: 14,
    borderColor: "#aab6c2",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  muted: {
    color: "#5f6b7a"
  },
  flex: {
    flex: 1
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(23,32,42,0.16)",
    alignItems: "flex-end",
    paddingTop: 70,
    paddingHorizontal: 20
  },
  settingsMenu: {
    width: 220,
    backgroundColor: "#fff",
    borderColor: "#d9e0e8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 6
  }
});
