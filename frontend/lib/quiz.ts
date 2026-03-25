import {
  QuizAnswerState,
  QuizItem,
  QuizSummaryStats,
} from "@/lib/types";
import { getExpectedValue } from "@/lib/utils";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[.,!?;:()[\]{}"“”«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export function similarityScore(answer: string, expected: string): number {
  if (!answer || !expected) {
    return 0;
  }

  if (answer === expected) {
    return 100;
  }

  const distance = levenshtein(answer, expected);
  const maxLength = Math.max(answer.length, expected.length);
  return Math.round((1 - distance / maxLength) * 100);
}

export function evaluateAnswer(item: QuizItem, answer: string): QuizAnswerState {
  const expected = normalizeText(getExpectedValue(item));
  const submitted = normalizeText(answer);
  const similarity = similarityScore(submitted, expected);
  const isCorrect =
    submitted.length > 0 &&
    (submitted === expected ||
      similarity >= 88 ||
      (expected.includes(submitted) && submitted.length >= 4));

  return {
    answer,
    status: isCorrect ? "correct" : "incorrect",
    expected: getExpectedValue(item),
    similarity,
  };
}

export function buildEmptyAnswers(items: QuizItem[]): QuizAnswerState[] {
  return items.map((item) => ({
    answer: "",
    expected: getExpectedValue(item),
    similarity: 0,
    status: "pending",
  }));
}

export function flipQuizDirections(items: QuizItem[]): QuizItem[] {
  return items.map((item) => ({
    ...item,
    dir: item.dir === 0 ? 1 : 0,
  }));
}

export function computeSummary(answerStates: QuizAnswerState[]): QuizSummaryStats {
  const total = answerStates.length;
  const correct = answerStates.filter((item) => item.status === "correct").length;
  const incorrect = answerStates.filter((item) => item.status === "incorrect").length;
  const skipped = answerStates.filter((item) => item.status === "skipped").length;
  const answered = correct + incorrect;

  return {
    total,
    correct,
    incorrect,
    skipped,
    answered,
    scorePercent: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
}

