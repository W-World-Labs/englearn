#!/usr/bin/env node

/**
 * Read-only aggregate audit for the learning workbench.
 *
 * The output contains no account IDs, item IDs, timestamps, answers, or free
 * text. It deliberately separates instruction exposure from unseen delayed
 * checks: a delayed question is a new item ID and must not inflate the number
 * of learning opportunities used as the denominator.
 *
 * Usage:
 *   ENGLEARN_DATA_DIR=/var/lib/englearn node scripts/export-workbench-evaluation.mjs
 *   node scripts/export-workbench-evaluation.mjs --root /path/to/learning-journals
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DAY = 86_400_000;
const LANGUAGES = ["en", "zh", "ja", "ko", "es"];

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = path.resolve(
  arg("--root") ??
    (process.env.ENGLEARN_DATA_DIR
      ? path.join(process.env.ENGLEARN_DATA_DIR, "learning-journals")
      : "data/learning-journals"),
);

const [grammar, variants, readings] = await Promise.all([
  fs.readFile(new URL("../data/learning/grammar-v1.json", import.meta.url), "utf8").then(JSON.parse),
  fs.readFile(new URL("../data/learning/variants-v1.json", import.meta.url), "utf8").then(JSON.parse),
  fs.readFile(new URL("../data/learning/readings-v1.json", import.meta.url), "utf8").then(JSON.parse),
]);

const answerById = new Map();
const languageById = new Map();
const conceptById = new Map();
const kindById = new Map();

for (const lesson of grammar.lessons ?? []) {
  for (const [index, question] of (lesson.questions ?? []).entries()) {
    const id = `g:${lesson.id}:${index}`;
    answerById.set(id, question.answer);
    languageById.set(id, lesson.language);
    conceptById.set(id, lesson.id);
    kindById.set(id, "lesson");
  }
}
for (const item of variants.items ?? []) {
  answerById.set(item.id, item.answer);
  languageById.set(item.id, item.lessonId.split("-")[0]);
  conceptById.set(item.id, item.lessonId);
  kindById.set(item.id, item.purpose);
}
for (const text of readings.items ?? []) {
  for (const question of text.questions ?? []) {
    answerById.set(question.id, question.answer);
    languageById.set(question.id, text.language);
    conceptById.set(question.id, `reading:${text.id}`);
    kindById.set(question.id, "reading");
  }
}

function emptyMetric() {
  return {
    journals: 0,
    dailyStarted: 0,
    dailyCompleted: 0,
    dailySkippedTasks: 0,
    instructionFirstCorrect: 0,
    instructionFirstTotal: 0,
    instructionRepeatCorrect: 0,
    instructionRepeatTotal: 0,
    delayedCorrect: 0,
    delayedTotal: 0,
    conceptsExposed: 0,
    conceptsEligibleForRetention: 0,
    conceptsRetained: 0,
  };
}

const totals = emptyMetric();
const byLanguage = Object.fromEntries(LANGUAGES.map((language) => [language, emptyMetric()]));
let invalidFiles = 0;
let journalFiles = 0;

function add(metric, key, value = 1) {
  metric[key] += value;
  totals[key] += value;
}

function metricFor(language) {
  return byLanguage[language] ?? null;
}

function applyJournal(raw) {
  const session = raw?.session;
  if (!session || !Array.isArray(session.events)) throw new Error("invalid journal");
  journalFiles++;

  const allConcepts = new Map();
  const recordAnswer = (language, concept, id, at, answer, phase) => {
    if (!language || !concept || !Number.isFinite(at) || !answerById.has(id)) return;
    const metric = metricFor(language);
    if (!metric) return;
    const expected = answerById.get(id);
    const entry = allConcepts.get(concept) ?? {
      language,
      attempts: [],
      seenInstructionIds: new Set(),
    };
    entry.attempts.push({ id, at, correct: answer === expected, phase });
    allConcepts.set(concept, entry);
  };

  for (const event of session.events) {
    const lesson = grammar.lessons?.find((candidate) => candidate.id === event.lessonId);
    if (!lesson) continue;
    for (const [index, answer] of (event.answers ?? []).entries()) {
      const id = `g:${lesson.id}:${index}`;
      recordAnswer(lesson.language, lesson.id, id, event.at, answer, "instruction");
    }
  }

  const workbench = session.workbench;
  for (const round of workbench?.rounds ?? []) {
    for (const [index, answer] of (round.answers ?? []).entries()) {
      const id = round.items?.[index];
      if (!id || !answerById.has(id)) continue;
      recordAnswer(
        languageById.get(id),
        conceptById.get(id),
        id,
        round.at,
        answer,
        round.kind === "retest" || kindById.get(id) === "retest" ? "delayed" : "instruction",
      );
    }
  }

  const touchedLanguages = new Set();
  for (const day of workbench?.days ?? []) {
    const metric = metricFor(day.language);
    if (!metric) continue;
    touchedLanguages.add(day.language);
    add(metric, "dailyStarted");
    if (day.completedAt) add(metric, "dailyCompleted");
    add(metric, "dailySkippedTasks", (day.tasks ?? []).filter((task) => task.skipped).length);
  }
  for (const entry of allConcepts.values()) {
    const metric = metricFor(entry.language);
    if (!metric) continue;
    touchedLanguages.add(entry.language);
    const attempts = entry.attempts.sort((a, b) => a.at - b.at);
    const seen = new Set();
    const firstInstruction = [];
    const repeatedInstruction = [];
    const delayed = [];
    for (const attempt of attempts) {
      if (attempt.phase === "delayed") {
        delayed.push(attempt);
        continue;
      }
      if (seen.has(attempt.id)) repeatedInstruction.push(attempt);
      else {
        seen.add(attempt.id);
        firstInstruction.push(attempt);
      }
    }
    if (!firstInstruction.length && !delayed.length) continue;
    add(metric, "conceptsExposed");
    add(metric, "instructionFirstCorrect", firstInstruction.filter((a) => a.correct).length);
    add(metric, "instructionFirstTotal", firstInstruction.length);
    add(metric, "instructionRepeatCorrect", repeatedInstruction.filter((a) => a.correct).length);
    add(metric, "instructionRepeatTotal", repeatedInstruction.length);
    add(metric, "delayedCorrect", delayed.filter((a) => a.correct).length);
    add(metric, "delayedTotal", delayed.length);
    const dates = new Set(firstInstruction.map((a) => Math.floor(a.at / DAY)));
    if (firstInstruction.length >= 4 && dates.size >= 2 && delayed.length >= 2) {
      add(metric, "conceptsEligibleForRetention");
      if (delayed.every((a) => a.correct)) add(metric, "conceptsRetained");
    }
  }
for (const language of touchedLanguages) add(byLanguage[language], "journals");
}

let files = [];
try {
  files = (await fs.readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

for (const file of files) {
  try {
    applyJournal(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    invalidFiles++;
  }
}

function rates(metric) {
  return {
    instructionFirstAccuracy:
      metric.instructionFirstTotal ? metric.instructionFirstCorrect / metric.instructionFirstTotal : null,
    instructionRepeatAccuracy:
      metric.instructionRepeatTotal ? metric.instructionRepeatCorrect / metric.instructionRepeatTotal : null,
    delayedAccuracy: metric.delayedTotal ? metric.delayedCorrect / metric.delayedTotal : null,
    retentionRate:
      metric.conceptsEligibleForRetention
        ? metric.conceptsRetained / metric.conceptsEligibleForRetention
        : null,
  };
}

for (const metric of [totals, ...Object.values(byLanguage)]) Object.assign(metric, rates(metric));
totals.journals = journalFiles;

console.log(
  JSON.stringify(
    {
      version: 1,
      source: "learning-journals",
      privacy: "aggregate-only; no account, item, timestamp, answer, or free-text data",
      root,
      filesScanned: files.length,
      journalFiles,
      invalidFiles,
      totals,
      byLanguage,
    },
    null,
    2,
  ),
);
