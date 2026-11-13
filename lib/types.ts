export type ModuleType = 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ItemFormat = 'yesno' | 'mcq' | 'reading-mcq' | 'listening-mcq' | 'open';

export interface IRTParams { a: number; b: number; c?: number; } // a=discrimination, b=difficulty(logit -3..3), c=guessing(default 0)

export interface Item {
  id: string; module: ModuleType; format: ItemFormat; irt: IRTParams; cefr: CEFRLevel;
  prompt: string;            // question text / instruction
  word?: string;             // vocabulary word being tested
  isPseudoword?: boolean;    // SERVER ONLY vocabulary answer key (fake word)
  passage?: string;          // reading passage text
  audioScript?: string;      // text to be spoken via TTS (listening)
  options?: string[];        // choices for mcq/reading-mcq/listening-mcq
  answerIndex?: number;      // SERVER ONLY correct option index
  rubric?: string;           // SERVER ONLY scoring rubric for open items
  /** BCP-47 tag for TTS / content locale (e.g. zh-CN, ko-KR, en-US) */
  contentLang?: string;
  /** SERVER ONLY lifecycle flag: excluded from new adaptive selection but still
   * resolvable by id so historical sessions keep scoring/replaying. */
  retired?: boolean;
  /** SERVER ONLY id of the retired item this replacement supersedes. */
  replaces?: string;
}

// Item with all server-only fields stripped, safe to send to client:
export type ClientItem = Omit<Item, 'answerIndex' | 'isPseudoword' | 'rubric' | 'irt' | 'retired' | 'replaces'> & { cefr: CEFRLevel };

export interface ClientResponse { itemId: string; selectedIndex?: number; selectedYes?: boolean; text?: string; }

export interface ItemResponse extends ClientResponse {
  module: ModuleType;
  correct?: boolean;
  score?: number;
  /** Per-item AI feedback (speaking/writing), stored server-side. */
  aiFeedback?: string;
}

export interface AbilityEstimate { theta: number; se: number; }

export interface TestSession {
  id: string; createdAt: string; modules: ModuleType[]; currentModule: ModuleType;
  administeredItemIds: string[]; responses: ItemResponse[];
  /** Scored draft; only /api/respond commits it to responses. */
  pendingScore?: ItemResponse;
  ability: Record<string, AbilityEstimate>; // keyed by ModuleType
  finished: boolean;
  /** ISO 639-1 target language the user is learning */
  learningLanguage?: string;
  /** W-ID subject when created while logged in */
  userId?: string;
  /** SHA-256 hex of the device's claim secret; lets the creating browser bind a guest session to an account later. */
  claimHash?: string;
}

export interface ModuleResult {
  module: ModuleType; theta: number; se: number; cefr: CEFRLevel;
  itemsAdministered: number;
  /** @deprecated Legacy records only; new vocabulary estimates use /vocabulary. */
  vocabularySize?: number;
  aiScore?: number; aiFeedback?: string;
}
export interface TestResult {
  sessionId: string;
  completedAt: string;
  overallCEFR: CEFRLevel;
  /** W-ID subject when completed while logged in */
  userId?: string;
  /** Target language for this assessment */
  learningLanguage?: string;
  modules: ModuleResult[];
  /** Modules included in this test run. */
  modulesIncluded?: ModuleType[];
  /** Wall-clock duration from session start to completion (seconds). */
  durationSeconds?: number;
  /** Total graded responses in this session. */
  totalItems?: number;
}
