// Логика ответов голосового ассистента Дуся

import {ASSISTANT_FACTS, ASSISTANT_JOKES} from './content.ts';

interface AssistantRuntime {
  now: () => Date;
  random: () => number;
}

const DEFAULT_RUNTIME: AssistantRuntime = {
  now: () => new Date(),
  random: () => Math.random(),
};

function normalizeInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRandomItem<T>(arr: readonly T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

const TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function getCurrentTime(runtime: AssistantRuntime): string {
  return `Сейчас ${TIME_FORMATTER.format(runtime.now())}.`;
}

function getCurrentDate(runtime: AssistantRuntime): string {
  return `Сегодня ${DATE_FORMATTER.format(runtime.now())}.`;
}

interface Rule {
  pattern: RegExp;
  priority: number;
  response: (runtime: AssistantRuntime) => string;
}

const RULES: Rule[] = [
  {
    pattern: /(?:^|\s)(?:привет|здравствуй|добрый день|добрый вечер|доброе утро|хай)(?:\s|$)/,
    priority: 70,
    response: runtime => {
      const hour = runtime.now().getHours();
      if (hour >= 5 && hour < 12) return 'Доброе утро! Чем могу помочь?';
      if (hour >= 12 && hour < 18) return 'Добрый день! Чем могу помочь?';
      if (hour >= 18 && hour < 23) return 'Добрый вечер! Чем могу помочь?';
      return 'Привет! Чем могу помочь?';
    },
  },
  {
    pattern: /(?:^|\s)(?:как тебя зовут|твое имя|кто ты)(?:\s|$)/,
    priority: 60,
    response: () => 'Меня зовут Дуся. Я ваш голосовой помощник.',
  },
  {
    pattern: /(?:^|\s)(?:как дела|как ты|как поживаешь)(?:\s|$)/,
    priority: 55,
    response: () => 'Отлично, спасибо что спросили! Готова помогать вам.',
  },
  {
    pattern: /(?:^|\s)(?:который час|сколько времени|текущее время)(?:\s|$)/,
    priority: 80,
    response: runtime => getCurrentTime(runtime),
  },
  {
    pattern: /(?:^|\s)(?:какое число|сегодня число|какой день|какая дата|сегодня дата)(?:\s|$)/,
    priority: 80,
    response: runtime => getCurrentDate(runtime),
  },
  {
    pattern: /(?:^|\s)(?:что ты умеешь|что умеешь|твои возможности|чем ты можешь помочь|помощь)(?:\s|$)/,
    priority: 20,
    response: () =>
      'Я умею: отвечать на вопросы о времени и дате, рассказывать анекдоты и интересные факты, поддерживать разговор. Просто скажите что-нибудь!',
  },
  {
    pattern: /(?:^|\s)(?:анекдот|расскажи анекдот|пошути|шутку)(?:\s|$)/,
    priority: 90,
    response: runtime => getRandomItem(ASSISTANT_JOKES, runtime.random),
  },
  {
    pattern: /(?:^|\s)(?:интересный факт|расскажи факт|факт|что интересного)(?:\s|$)/,
    priority: 90,
    response: runtime => 'Вот интересный факт: ' + getRandomItem(ASSISTANT_FACTS, runtime.random),
  },
  {
    pattern: /(?:^|\s)погода(?:\s|$)/,
    priority: 85,
    response: () => 'Для получения погоды нужен интернет. Включите сеть и спросите снова.',
  },
  {
    pattern: /(?:^|\s)(?:пока|до свидания|прощай|выключись|стоп|хватит)(?:\s|$)/,
    priority: 65,
    response: () => 'До свидания! Буду рада помочь снова.',
  },
  {
    pattern: /(?:^|\s)(?:спасибо|благодарю|благодарна)(?:\s|$)/,
    priority: 65,
    response: () => 'Пожалуйста! Рада была помочь.',
  },
  {
    pattern: /(?:(?:^|\s)сколько(?:\s|$).*\d+.*[+\-*/]|\d+.*[+\-*/].*\d+)/,
    priority: 95,
    response: () => 'Для математических вычислений уточните задачу.',
  },
];

const RULES_BY_PRIORITY = RULES.map((rule, index) => ({
  ...rule,
  index,
})).sort((a, b) => b.priority - a.priority || a.index - b.index);

export function getAssistantResponse(input: string, runtime: AssistantRuntime = DEFAULT_RUNTIME): string {
  const normalized = normalizeInput(input);
  for (const rule of RULES_BY_PRIORITY) {
    if (rule.pattern.test(normalized)) {
      return rule.response(runtime);
    }
  }
  return 'Я пока не знаю ответа на это. Попробуйте спросить иначе или задайте другой вопрос.';
}

// ──────────────────────── Voice call intents ───────────────────────────────

export interface CallByNameIntent {
  type: 'call';
  name: string;
}

export interface RedialIntent {
  type: 'redial';
}

export type VoiceIntent = CallByNameIntent | RedialIntent;

const CALL_BY_NAME_PATTERN = /^(?:позвони|набери|вызови)\s+(.+)$/;
const REDIAL_PATTERN =
  /^(?:перезвони(?:\s+мне)?|перезвонить|перезванивай|обратный\s+звонок|позвони\s+снова|повтори\s+звонок)$/;
const INVALID_CALLEE_PATTERN =
  /^(?:снова|еще раз|обратно|мне|кому нибудь|кому-нибудь|контакту|контакт)$/;

function normalizeCallee(rawName: string): string {
  return rawName
    .replace(/^(?:пожалуйста\s+)?/, '')
    .replace(/^(?:снова|еще раз)\s+/, '')
    .replace(/^(?:контакту|контакт|абоненту)\s+/, '')
    .replace(/\s+пожалуйста$/, '')
    .trim();
}

export function getVoiceIntent(input: string): VoiceIntent | null {
  const normalized = normalizeInput(input);
  if (REDIAL_PATTERN.test(normalized)) {
    return {type: 'redial'};
  }
  const match = normalized.match(CALL_BY_NAME_PATTERN);
  if (match) {
    const name = normalizeCallee(match[1]);
    if (name && !INVALID_CALLEE_PATTERN.test(name)) {
      return {type: 'call', name};
    }
  }
  return null;
}
