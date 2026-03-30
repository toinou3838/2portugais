import { DifficultyLevel, QuizItem } from "@/lib/types";

export function getDirectionLabel(dir: QuizItem["dir"]): string {
  return dir === 0 ? "Français → Portugais" : "Portugais → Français";
}

export function getPromptLabel(dir: QuizItem["dir"]): string {
  return dir === 0 ? "Traduire en portugais" : "Traduire en français";
}

export function getPromptValue(item: QuizItem): string {
  return item.dir === 0 ? item.fr : item.pt;
}

export function getExpectedValue(item: QuizItem): string {
  return item.dir === 0 ? item.pt : item.fr;
}

export function getSourceBadge(source: QuizItem["source"]): string {
  return source === "conjugaison" ? "Conjugaison" : "Vocabulaire";
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function getDifficultyLabel(value: DifficultyLevel): string {
  switch (value) {
    case 1:
      return "Facile";
    case 2:
      return "Intermédiaire";
    case 3:
      return "Difficile";
    default:
      return "Intermédiaire";
  }
}
