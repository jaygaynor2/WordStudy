# Specification

## Overview

A project to allow users to create a word study, populate that word study with a list of Bible verses via a search interface, and then allow a user to attach to each verse within a word study one or more notes. The notes consist of a group classification and a free-form text field.

## Goals

- Allow users to create a study of a list of verses from the Bible.
- Allow users to attach notes to each verse.
- Allow users to choose from a list of Bible translations.

## Non-Goals


## Requirements

### Functional Requirements

- The user should be able to create a word study
- The user should be able to add verses to a word study
- The user should be able to attach notes to each verse within a word study. The notes should consist of a group classification and a free-form text field.
- The user should be able to choose from a list of Bible translations

### Non-Functional Requirements

- Accessibility: it should conform to WCAG 2.1 AA standards.
- It should be constructed as a static React/JavaScript frontend.
- It should be versioned using Git.
- It should be tested using unit tests and integration tests.
- It should be documented using Markdown.
- It should be deployable using GitHub Pages.

## User Experience

Describe the expected user flow, interface behavior, and important states.

## Data Model

A word study consists of a list of verses, each with a group classification and a free-form text field for notes.

## Data / Integration Notes

The Bible corpus should be hosted as a static JSON file and searched in the browser. Word study creation, verse selection, and notes are stored in browser `localStorage`.

## Edge Cases


## Acceptance Criteria

- [ ] Core requirement is implemented.
- [ ] Important edge cases are handled.
- [ ] Tests or verification steps are documented.
- [ ] Documentation is updated where needed.

## Open Questions
