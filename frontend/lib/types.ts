export type DifficultyLevel = 1 | 2 | 3;
export type QuizMode = "standard" | "review";

export type QuizItem = {
  id: string;
  fr: string;
  pt: string;
  dir: 0 | 1;
  difficulty: DifficultyLevel;
  source: "conjugaison" | "vocab";
};

export type QuizGenerationRequest = {
  question_count: number;
  conjugation_percentage: number;
  difficulty: DifficultyLevel;
  mode: QuizMode;
};

export type QuizGenerationResponse = {
  quiz_id: string;
  generated_at: string;
  mode: QuizMode;
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
  mastery_update?: {
    item_id: string;
    source: "conjugaison" | "vocab";
    direction: 0 | 1;
    correct: boolean;
  } | null;
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
  difficulty: DifficultyLevel;
  source: "vocab";
  created_at: string;
};

export type AdminConjugationRow = {
  id: string;
  fr: string;
  pt: string;
  dir: 0 | 1;
  difficulty: DifficultyLevel;
  source: "conjugaison" | "vocab";
};

export type AdminVocabularyRow = {
  id: number;
  fr: string;
  pt: string;
  dir: 0 | 1;
  difficulty: DifficultyLevel;
  source: string;
  created_by_user_id: number | null;
  created_by_display_name: string | null;
  created_at: string;
};

export type AdminUserRow = {
  id: number;
  clerk_user_id: string;
  email: string;
  display_name: string | null;
  reminder_opt_in: boolean;
  current_streak: number;
  today_day: string;
  today_answered_questions: number;
  today_correct_answers: number;
  today_quizzes_completed: number;
  today_goal_reached: boolean;
  today_reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminReminderRow = {
  id: number;
  email: string;
  display_name: string | null;
  current_streak: number;
  answered_questions: number;
  remaining_questions: number;
  reminder_opt_in: boolean;
  reminder_sent_at: string | null;
  goal_reached: boolean;
  day: string;
};

export type AdminDashboard = {
  conjugations: AdminConjugationRow[];
  vocabulary: AdminVocabularyRow[];
  users: AdminUserRow[];
  pending_reminders: AdminReminderRow[];
};
