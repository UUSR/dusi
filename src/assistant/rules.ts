// Логика ответов голосового ассистента Дуся

const JOKES = [
  'Программист жалуется другу: «Вчера работал над проектом всю ночь». Друг: «И как?» — «Всё работает, но я не знаю почему».',
  'Муж приходит домой и говорит жене: «Дорогая, я сегодня стал умнее!» Жена: «Это как?» — «Купил умные часы!»',
  'Почему программисты путают Хэллоуин и Рождество? Потому что Oct 31 = Dec 25!',
  'Подходит ученик к учителю: «Скажите, а задачу можно решить двумя способами?» Учитель: «Да». Ученик: «Тогда я не буду решать ни одним».',
  'Доктор спрашивает пациента: «Как вы себя чувствуете?» — «Как в облаке». — «Хорошо?» — «Нет, как в iCloud — всё видно, ничего не достать».',
];

const FACTS = [
  'Осьминоги имеют три сердца и голубую кровь.',
  'Молния может нагреваться до 30 000 градусов по Цельсию — это в пять раз горячее поверхности Солнца.',
  'Мёд не портится. В египетских гробницах нашли мёду более трёх тысяч лет, который всё ещё был съедобен.',
  'Все пчёлы в улье — самки, кроме трутней. Трутни живут только для размножения.',
  'Самое глубокое озеро в мире — Байкал. Его глубина достигает 1642 метров.',
  'Человек моргает около 15–20 раз в минуту, то есть примерно 10 миллионов раз в год.',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCurrentTime(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `Сейчас ${h}:${m}.`;
}

function getCurrentDate(): string {
  const now = new Date();
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const day = days[now.getDay()];
  return `Сегодня ${day}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} года.`;
}

interface Rule {
  pattern: RegExp;
  response: () => string;
}

const RULES: Rule[] = [
  {
    pattern: /привет|здравствуй|добрый день|добрый вечер|доброе утро|хай/i,
    response: () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Доброе утро! Чем могу помочь?';
      if (hour >= 12 && hour < 18) return 'Добрый день! Чем могу помочь?';
      if (hour >= 18 && hour < 23) return 'Добрый вечер! Чем могу помочь?';
      return 'Привет! Чем могу помочь?';
    },
  },
  {
    pattern: /как тебя зовут|твоё имя|кто ты/i,
    response: () => 'Меня зовут Дуся. Я ваш голосовой помощник.',
  },
  {
    pattern: /как дела|как ты|как поживаешь/i,
    response: () => 'Отлично, спасибо что спросили! Готова помогать вам.',
  },
  {
    pattern: /который час|сколько времени|текущее время/i,
    response: () => getCurrentTime(),
  },
  {
    pattern: /какое число|сегодня число|какой день|какая дата|сегодня дата/i,
    response: () => getCurrentDate(),
  },
  {
    pattern: /что ты умеешь|что умеешь|твои возможности|чем ты можешь помочь|помощь/i,
    response: () =>
      'Я умею: отвечать на вопросы о времени и дате, рассказывать анекдоты и интересные факты, поддерживать разговор. Просто скажите что-нибудь!',
  },
  {
    pattern: /анекдот|расскажи анекдот|пошути|шутку/i,
    response: () => getRandomItem(JOKES),
  },
  {
    pattern: /интересный факт|расскажи факт|факт|что интересного/i,
    response: () => 'Вот интересный факт: ' + getRandomItem(FACTS),
  },
  {
    pattern: /погода/i,
    response: () => 'Для получения погоды нужен интернет. Включите сеть и спросите снова.',
  },
  {
    pattern: /пока|до свидания|прощай|выключись|стоп|хватит/i,
    response: () => 'До свидания! Буду рада помочь снова.',
  },
  {
    pattern: /спасибо|благодарю|благодарна/i,
    response: () => 'Пожалуйста! Рада была помочь.',
  },
  {
    pattern: /сколько.*\d+.*[+\-*/]|\d+.*[+\-*/].*\d+/i,
    response: () => 'Для математических вычислений уточните задачу.',
  },
];

export function getAssistantResponse(input: string): string {
  const trimmed = input.trim().toLowerCase();
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.response();
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

const CALL_BY_NAME_PATTERN = /(?:позвони|набери|вызови)\s+(.+)/i;
const REDIAL_PATTERN =
  /(?:перезвони(?:\s+мне)?|перезвонить|перезванивай|обратный\s+звонок|позвони\s+снова|повтори\s+звонок)/i;

export function getVoiceIntent(input: string): VoiceIntent | null {
  const trimmed = input.trim();
  if (REDIAL_PATTERN.test(trimmed)) {
    return {type: 'redial'};
  }
  const match = trimmed.match(CALL_BY_NAME_PATTERN);
  if (match) {
    const name = match[1].trim();
    // Исключаем «позвони снова» — это команда перезвона, не вызов по имени
    if (name && !/^снова$|^ещё раз$|^обратно$/i.test(name)) {
      return {type: 'call', name};
    }
  }
  return null;
}
