export type DialogueRole = 'system' | 'user' | 'assistant';

export interface DialogueMessage {
  role: Exclude<DialogueRole, 'system'>;
  content: string;
}

export interface DialogueManagerOptions {
  historyLimit?: number;
  followUpWindowMs?: number;
}

const DEFAULT_HISTORY_LIMIT = 12;
const DEFAULT_FOLLOW_UP_WINDOW_MS = 4000;

const FOLLOW_UP_MARKERS = [
  'а еще',
  'а теперь',
  'а что',
  'почему',
  'уточни',
  'объясни',
  'подробнее',
  'продолжай',
  'дальше',
  'и еще',
  'ещё',
  'что дальше',
];

const STOP_DIALOG_PATTERN =
  /(?:^|\s)(?:стоп|хватит|пока|до свидания|заверши диалог|заверши диалог|выход)(?:\s|$)/;

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class DialogueManager {
  private readonly historyLimit: number;
  private readonly followUpWindowMs: number;
  private readonly history: DialogueMessage[] = [];
  private followUpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DialogueManagerOptions = {}) {
    this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.followUpWindowMs = options.followUpWindowMs ?? DEFAULT_FOLLOW_UP_WINDOW_MS;
  }

  addUserMessage(text: string): void {
    this.addMessage('user', text);
  }

  addAssistantMessage(text: string): void {
    this.addMessage('assistant', text);
  }

  getHistory(): DialogueMessage[] {
    return [...this.history];
  }

  setHistory(messages: DialogueMessage[]): void {
    this.history.length = 0;
    for (const message of messages) {
      if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
        continue;
      }
      this.addMessage(message.role, message.content);
    }
  }

  buildModelMessages(systemPrompt: string): Array<{role: DialogueRole; content: string}> {
    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...this.history,
    ];
  }

  isFollowUpPrompt(text: string): boolean {
    const normalized = normalize(text);
    if (!normalized) {
      return false;
    }

    if (FOLLOW_UP_MARKERS.some(marker => normalized.includes(marker))) {
      return true;
    }

    const words = normalized.split(' ').filter(Boolean);
    return words.length > 0 && words.length <= 3;
  }

  isStopDialogCommand(text: string): boolean {
    return STOP_DIALOG_PATTERN.test(normalize(text));
  }

  openFollowUpWindow(onTimeout: () => void): void {
    this.clearFollowUpWindow();
    this.followUpTimer = setTimeout(() => {
      this.followUpTimer = null;
      onTimeout();
    }, this.followUpWindowMs);
  }

  clearFollowUpWindow(): void {
    if (!this.followUpTimer) {
      return;
    }

    clearTimeout(this.followUpTimer);
    this.followUpTimer = null;
  }

  reset(): void {
    this.clearFollowUpWindow();
    this.history.length = 0;
  }

  dispose(): void {
    this.clearFollowUpWindow();
  }

  private addMessage(role: DialogueMessage['role'], text: string): void {
    const content = String(text || '').trim();
    if (!content) {
      return;
    }

    this.history.push({role, content});
    const excess = this.history.length - this.historyLimit;
    if (excess > 0) {
      this.history.splice(0, excess);
    }
  }
}

export const ASSISTANT_SYSTEM_PROMPT =
  'Ты голосовой ассистент Дуся. Веди короткий диалог на русском: 1-3 предложения, уточняй при неоднозначности, не используй Markdown.';
