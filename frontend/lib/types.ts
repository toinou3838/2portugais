export type QuizItem = {
  id: string;
  fr: string;
  pt: string;
  dir: 0 | 1;
  source: "conjugaison" | "vocab";
};

export type QuizGenerationRequest = {
  question_count: number;
  conjugation_percentage: number;
};

export type QuizGenerationResponse = {
  quiz_id: string;
  generated_at: string;
  requested_question_count: number;
  actual_question_count: number;
  source_breakdown: {
    conjugaison: number;
    vocab: number;
  };
  items: QuizItem[];
};

export type AnswerStatus = "pending" | "correct" | "incorrect" | "skipped";

export type QuizAnswerState = {
  answer: string;
  status: AnswerStatus;
  expected: string;
  similarity: number;
};

export type QuizFeedback = {
  questionIndex: number;
  answer: string;
  expected: string;
  status: Exclude<AnswerStatus, "pending">;
};

export type QuizSummaryStats = {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  answered: number;
  scorePercent: number;
};

export type UserProfile = {
  id: number;
  clerk_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  reminder_opt_in: boolean;
  current_streak: number;
  goal: number;
  questions_remaining_today: number;
  today_progress: {
    day: string;
    answered_questions: number;
    correct_answers: number;
    quizzes_completed: number;
    goal_reached: boolean;
  };
};

export type ProgressPayload = {
  quiz_id: string;
  answered_questions: number;
  correct_answers: number;
  quizzes_completed: number;
};

export type TranslationDirection = "fr_to_pt" | "pt_to_fr";

export type TranslationResponse = {
  original_text: string;
  translated_text: string;
  direction: TranslationDirection;
  provider: string;
  confidence: number;
  found: boolean;
};

export type VocabularyCheckResponse = {
  is_consistent: boolean;
  warning: string | null;
  recommendation: {
    fr: string;
    pt: string;
  } | null;
  provider: string;
};

export type VocabularyEntry = {
  id: number;
  fr: string;
  pt: string;
  dir: 0 | 1;
  source: "vocab";
  created_at: string;
};
