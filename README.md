# CQuiz

> A powerful, feature-rich quiz engine for Obsidian that turns your markdown notes into interactive exams.

**Author:** carbon-softlab  
**Version:** 1.0.0
**Repository:** https://github.com/carbon-softlab/CQuiz

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#Quick-Start)
- [Question Format](#Question-Format)
- [Block API Reference](#Block-Api-Reference)
- [Scoring & Formulas](#Scoring--Formulas)
- [Render Styles](#render-styles)
- [Tag System](#tag-system)
- [Spaced Repetition](#spaced-repetition)
- [Analytics Dashboard](#analytics-dashboard)
- [Export to Note](#export-to-note)
- [Strict Mode](#strict-mode)
- [Settings](#settings)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Installation

1. Download `main.js` and `manifest.json` from the repository.
2. In your vault, create the folder `.obsidian/plugins/cquiz/`.
3. Place both files inside that folder.
4. Open Obsidian → **Settings → Community Plugins** → enable **CQuiz**.

---

## Quick-Start

Create a `cquiz` code block anywhere in a markdown note:

````markdown
```cquiz
@name= My First Quiz
@Set= (MyNotes)
@passMark= 5
```
````

This loads all questions from the note `MyNotes.md` and presents an interactive quiz. Click **Start Quiz** to begin.

---

## Question-Format

Questions are written in standard markdown checkbox list format inside any `.md` file.

```markdown
1. [ ] What is the capital of France?
    1. [ ] London
    2. [x] Paris
    3. [ ] Berlin
    4. [ ] Madrid

2. [ ] Which of these are prime numbers? (select all)
    1. [x] 2
    2. [ ] 4
    3. [x] 7
    4. [x] 11
> [!NOTE] A prime number is divisible only by 1 and itself.

3. [x] This question has already been read/studied.
    1. [x] Correct option
    2. [ ] Wrong option
```

### Rules

| Element | Format | Notes |
|---|---|---|
| **Question** | `N. [ ] Question text` | Number + checkbox + text |
| **Read marker** | `N. [x] Question text` | Mark a question as already studied |
| **Option** | `→ N. [ ] Option text` | Indented with tab or spaces |
| **Correct option** | `→ N. [x] Option text` | `[x]` marks the correct answer |
| **Multiple correct** | Multiple `[x]` options | CQuiz auto-detects multi-select |
| **Note/Hint** | `> [!NOTE] text` or `> text` | Shown in review after submitting |
| **Markdown** | Supported everywhere | Bold, italic, code, images, math |

---

## Block-API-Reference

All options are written as `@key= value` inside a `cquiz` block. Keys are case-insensitive.

### Source Options

| Option | Example | Description |
|---|---|---|
| `@Set` | `@Set= (Note1, Note2)` | Load questions from specific notes by name |
| `@SetAll` | `@SetAll= (FolderName)` | Load all `.md` files from a folder (recursive) |
| `@SetType` | `@SetType= Hard, Medium` | Load only questions tagged with these labels |
| `@StartFrom` | `@StartFrom= 10` | Skip to question number N (1-based) |
| `@EndTo` | `@EndTo= 50` | Stop at question number N |
| `@Filter` | `@Filter= onlyread` | `all` (default) or `onlyread` (studied only) |
| `@Limit` | `@Limit= 20` | Cap the total number of questions loaded |
| `@Random` | `@Random= true` | Shuffle question order |

### Exam-Options

| Option | Example | Description |
|---|---|---|
| `@Name` | `@Name= Chapter 3 Exam` | Display name for the quiz |
| `@Show` | `@Show= Good luck!` | Description shown on the start screen |
| `@Mode` | `@Mode= quiz` | `quiz` (default) or `stats` for the dashboard |
| `@PassMark` | `@PassMark= 15` | Minimum score to pass |
| `@MarkPerQ` | `@MarkPerQ= 2` | Points awarded per correct answer |
| `@Penalty` | `@Penalty= 0.5` | Points deducted per wrong answer |
| `@Formula` | see below | Custom scoring formula |
| `@Duration` | `@Duration= 30m` | Time limit. Supports `s`, `m`, `h` (e.g. `90s`, `2h`) |
| `@Timer` | `@Timer= true` | Show a running timer (no limit) |
| `@PauseButton` | `@PauseButton= true` | Show a pause/resume button during the exam |
| `@Strict` | `@Strict= true` | Lock the note — prevents navigating away |
| `@RenderStyle` | `@RenderStyle= paged` | `scroll` (default) or `paged` |
| `@Repetition` | `@Repetition= 5` | SM-2 spaced repetition priority (0–10) |
| `@AllowTags` | `@AllowTags= true` | Show tag buttons on each question |
| `@FontSize` | `@FontSize= 1.1em` | Override font size for the quiz |

### Full-Example

````markdown
```cquiz
@name= Biology Final — Chapter 4-6
@Show= 45 minutes. Covers cell division and genetics.
@SetAll= (Biology/Chapter4, Biology/Chapter5, Biology/Chapter6)
@Random= true
@Limit= 40
@Duration= 45m
@PassMark= 50
@PauseButton= true
@RenderStyle= paged
@Formula = ({correct}*1-{wrong}*1)
```
````

---

## Scoring-&-Formulas

The default scoring formula is:

```
({correct} * @markPerQ) - ({wrong} * @penalty)
```

You can write any custom formula using these variables:

| Variable | Meaning |
|---|---|
| `{correct}` or `@correct` | Number of correct answers |
| `{wrong}` or `@wrong` | Number of wrong answers |
| `{skip}` or `@skip` | Number of skipped questions |
| `{total}` or `@total` | Total questions |
| `@markPerQ` | Mark per question (from config) |
| `@penalty` | Penalty per wrong answer (from config) |

### Formula-Functions

`IF(condition, trueValue, falseValue)`, `pow(base, exp)`, `sqrt(x)`, `nroot(x, n)`, `mod(a, b)`

### Custom-Formula-Examples

```
# Standard with penalty
@Formula= ({correct} * @markPerQ) - ({wrong} * @penalty)

# Percentage score
@Formula= ({correct} / {total}) * 100

# Bonus for no skips
@Formula= ({correct} * 2) + IF({skip} == 0, 10, 0)

# Only penalise after 3 wrong answers
@Formula= ({correct} * @markPerQ) - IF({wrong} > 3, ({wrong} - 3) * @penalty, 0)
```

---

## Render-Styles

### Scroll Mode (default)

All questions appear in a single scrollable list. A sticky progress bar and submit bar stay visible at the bottom.

```
@RenderStyle= scroll
```

### Paged-Mode

One question per screen with navigation controls.

```
@RenderStyle= paged
```

**Navigation:**

- **← / →** arrow buttons
- **Dot indicators** — click any dot to jump directly to that question. Dots turn accent-coloured when answered.
- **Keyboard:** `Alt + ←` / `Alt + →` (desktop)
- **Skipped question numbers** in the submit bar are clickable — jump directly to that page

---

## Tag-System

Tags let you categorise questions as Hard, Medium, Easy, Hint, or any custom label. Tagged questions can be used as a source for future quizzes.

### Tagging a question during a quiz

Each question card has a tag bar. Click any tag pill to apply it — the pill fills with the tag colour. Click again to remove it. Changes save instantly to the vault.

- **Inactive hover** → previews what the tag will look like when applied
- **Active hover** → dims the pill to preview removal

### Using tagged questions as a source

```
@SetType= Hard, Medium
```

Loads only questions you've previously tagged as Hard or Medium, regardless of which note they're in.

### Managing tags

Open the **Analytics Dashboard** (`@Mode= stats`) → **Manage Tags & Saved Questions** to:
- Rename or delete tags
- Browse all questions under a tag
- Add custom tags

---

## Spaced-Repetition

CQuiz includes an SM-2-based spaced repetition system. Enable it with:

```
@Repetition= 5
```

The value (0–10) controls how strongly overdue and difficult questions are prioritised. Questions are scored by:

- Overdue ratio (how many days past the review date)
- Mastery rate (correct ÷ total attempts)
- Streak (consecutive correct answers)

After each exam, review intervals are updated automatically. The next review date is calculated using the SM-2 ease factor.

> **Reset repetition data:** Settings → Reset Rep Data

---

## Analytic-Dashboard

Add a stats block anywhere in your vault:

````markdown
```cquiz
@Mode= stats
```
````

### Overview-Tab

- Total exams taken, average score, best/worst accuracy
- Bar chart of accuracy per exam (last 10)
- Quick access to Tag Manager

### History-Tab

A full table of every exam with:
- Date, exam name, pass/fail badge, score, correct/wrong/skipped, accuracy bar, time taken
- **👁 View** — re-read the full question review for any past exam
- **📋 Export** — export any past exam result to a markdown note
- **🗑 Delete** — remove individual records
- Search, status filter (all/pass/fail), and sort (newest/oldest/best/worst)

---

## Export-to+Note

After finishing an exam, click **Export to Note** on the results screen. A markdown note is created in your configured export folder (default: `CQuiz-Results/`) and opened in a new tab.

### Exported-format

```markdown
# 📋 Exam Results: Biology Final

> **Date:** 13/06/2026, 14:32
> **Result:** ✅ PASSED
> **Score:** 38 / 50
> **Pass Mark:** 30

## 📊 Summary

| Metric | Value |
|--------|-------|
| Final Score | 38 / 50 |
| Correct | 19 |
...

## 🗒️ Question Review

1. [x] What is mitosis?
#hard
%%status: correct ✅%%
    1. [ ] Cell death
    2. [x] Cell division producing identical daughter cells
    3. [ ] DNA replication only
```

Each question uses the native CQuiz format so notes can be re-imported or studied later. Wrong answers are annotated with `← *your answer*`.

---

## Strict-Mode

```
@Strict= true
```

Locks the current note for the duration of the exam. If you navigate to another note, Obsidian jumps you back and shows a warning. The lock is released when you submit or pause the exam.

---

## Settings

Open **Settings → CQuiz** to configure:

### 📁 Export Settings

| Setting | Default | Description |
|---|---|---|
| **Result Export Folder** | `CQuiz-Results` | Folder where exported notes are saved. Supports nested paths (`Studies/Exams`). Created automatically on first export. Leave blank to save in vault root. |

Click **📂 Open in Explorer** to reveal the folder in Obsidian's file explorer. A live path hint (`→ vault/CQuiz-Results/`) updates as you type.

### ⚙️ General

| Setting | Default | Description |
|---|---|---|
| **Debug Mode** | Off | Enables detailed console logging |

### ⚠️ Danger-Zone

| Action | Description |
|---|---|
| **Wipe All Data** | Permanently deletes all exam history |
| **Reset Rep Data** | Clears all spaced repetition tracking |

---

## Keyboard-Shortcuts

| Shortcut | Action | Mode |
|---|---|---|
| `Alt + ←` | Previous question | Paged mode |
| `Alt + →` | Next question | Paged mode |
| `Double-click backdrop` | Resume exam | Paused overlay |

---

## Question-File-Tips

- Questions from **multiple files** can be combined in one quiz using `@Set= (File1, File2)` or `@SetAll= (FolderName)`
- **Images** in questions and options are fully supported — click to expand in a lightbox
- **Markdown** (bold, italic, code blocks, LaTeX) renders everywhere
- Mark questions as read with `[x]` at the question level, then use `@Filter= onlyread` to quiz only studied material
- Use `@StartFrom` and `@EndTo` to slice a large question bank into sessions

---

