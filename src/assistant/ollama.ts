import {Platform, NativeModules} from 'react-native';

export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';
export const OLLAMA_DEVICE_URL_PLACEHOLDER = 'http://192.168.1.20:11434';

// Для физического Android-устройства укажите IP компьютера в вашей Wi-Fi сети.
// Пример: http://192.168.1.20:11434
export const OLLAMA_DEVICE_URL = '';

let _model: string = DEFAULT_OLLAMA_MODEL;
let _baseUrl: string = OLLAMA_DEVICE_URL;

const STORAGE_KEY_URL = '@ollama_base_url';
const STORAGE_KEY_MODEL = '@ollama_model';

// Безопасно импортируем AsyncStorage — может отсутствовать до пересборки
let _AsyncStorage: {
  multiSet: (pairs: [string, string][]) => Promise<void>;
  multiGet: (keys: string[]) => Promise<[string, string | null][]>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage');
  const AS = mod?.default ?? mod;
  // Проверяем что нативный модуль реально доступен
  if (AS && NativeModules.RNCAsyncStorage) {
    _AsyncStorage = AS;
  }
} catch {
  _AsyncStorage = null;
}

export function setOllamaConfig(baseUrl: string, model: string): void {
  _baseUrl = baseUrl.trim();
  _model = model.trim();
  if (_AsyncStorage) {
    _AsyncStorage.multiSet([
      [STORAGE_KEY_URL, _baseUrl],
      [STORAGE_KEY_MODEL, _model],
    ]).catch(() => {});
  }
}

export async function loadOllamaConfig(): Promise<{url: string; model: string}> {
  if (!_AsyncStorage) {
    return {url: _baseUrl, model: _model};
  }
  try {
    const [url, model] = await _AsyncStorage.multiGet([STORAGE_KEY_URL, STORAGE_KEY_MODEL]);
    if (url[1]) { _baseUrl = url[1]; }
    if (model[1]) { _model = model[1]; }
    return {url: _baseUrl, model: _model};
  } catch {
    return {url: _baseUrl, model: _model};
  }
}

function getOllamaBaseUrl(): string {
  if (_baseUrl) {
    return _baseUrl;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:11434';
  }
  return 'http://127.0.0.1:11434';
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

interface OllamaTagsResponse {
  models?: Array<{name?: string}>;
}

export interface OllamaReplyResult {
  ok: boolean;
  text: string | null;
  error?: string;
  baseUrl: string;
  model: string;
}

const OLLAMA_REQUEST_TIMEOUT_MS = 15000;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function resolveOllamaBaseUrl(): {baseUrl: string | null; error?: string} {
  const normalized = normalizeBaseUrl(_baseUrl);

  if (normalized) {
    if (normalized === normalizeBaseUrl(OLLAMA_DEVICE_URL_PLACEHOLDER)) {
      return {
        baseUrl: null,
        error: 'Укажите реальный адрес Ollama в настройках. Сейчас стоит примерный IP.',
      };
    }
    return {baseUrl: normalized};
  }

  if (Platform.OS === 'android') {
    return {baseUrl: 'http://10.0.2.2:11434'};
  }

  return {baseUrl: 'http://127.0.0.1:11434'};
}

export function getOllamaTargetInfo(): {baseUrl: string; model: string; configured: boolean; error?: string} {
  const resolved = resolveOllamaBaseUrl();
  return {
    baseUrl: resolved.baseUrl ?? normalizeBaseUrl(_baseUrl),
    model: _model,
    configured: Boolean(resolved.baseUrl),
    error: resolved.error,
  };
}

export async function checkOllamaConnection(): Promise<OllamaReplyResult> {
  const resolved = resolveOllamaBaseUrl();
  const baseUrl = resolved.baseUrl ?? normalizeBaseUrl(_baseUrl);

  if (!resolved.baseUrl) {
    return {
      ok: false,
      text: null,
      error: resolved.error,
      baseUrl,
      model: _model,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${resolved.baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        text: null,
        error: `Ollama вернула HTTP ${response.status}. Проверьте адрес сервера.`,
        baseUrl,
        model: _model,
      };
    }

    const data = (await response.json()) as OllamaTagsResponse;
    const hasModel = Array.isArray(data.models)
      ? data.models.some(item => item?.name === _model)
      : false;

    return {
      ok: true,
      text: hasModel
        ? `Соединение установлено. Модель ${_model} найдена.`
        : `Соединение установлено. Сервер отвечает, но модель ${_model} не найдена.`,
      baseUrl,
      model: _model,
      error: hasModel ? undefined : `На сервере нет модели ${_model}. Выполните ollama pull ${_model}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      text: null,
      error:
        message === 'Aborted'
          ? 'Сервер Ollama не ответил на проверку за 5 секунд.'
          : `Не удалось подключиться к Ollama по адресу ${baseUrl}.`,
      baseUrl,
      model: _model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestOllamaReply(prompt: string): Promise<OllamaReplyResult> {
  const resolved = resolveOllamaBaseUrl();
  const baseUrl = resolved.baseUrl ?? normalizeBaseUrl(_baseUrl);

  if (!resolved.baseUrl) {
    return {
      ok: false,
      text: null,
      error: resolved.error,
      baseUrl,
      model: _model,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_REQUEST_TIMEOUT_MS);

  console.log('[Ollama] Requesting:', baseUrl, 'model:', _model);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: _model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Ты голосовой ассистент Дуся. Отвечай кратко, по-русски, вежливо и без Markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    console.log('[Ollama] Response status:', response.status);

    if (!response.ok) {
      const error = `Ollama вернула HTTP ${response.status}. Проверьте адрес сервера и имя модели.`;
      console.warn('[Ollama] Non-OK response:', response.status);
      return {
        ok: false,
        text: null,
        error,
        baseUrl,
        model: _model,
      };
    }

    const data = (await response.json()) as OllamaChatResponse;
    const text = data.message?.content?.trim();
    if (text) {
      console.log('[Ollama] Got text:', text.substring(0, 50));
      return {
        ok: true,
        text,
        baseUrl,
        model: _model,
      };
    }
    console.warn('[Ollama] Empty response from model');
    return {
      ok: false,
      text: null,
      error: 'Ollama вернула пустой ответ.',
      baseUrl,
      model: _model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error =
      message === 'Aborted'
        ? 'Ollama не ответила за 15 секунд. Сервер запущен, но модель отвечает слишком долго.'
        : `Не удалось подключиться к Ollama по адресу ${baseUrl}. Проверьте, что сервер запущен и адрес указан верно.`;
    console.error('[Ollama] Error:', message);
    return {
      ok: false,
      text: null,
      error,
      baseUrl,
      model: _model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getLocalOllamaReply(prompt: string): Promise<string | null> {
  const result = await requestOllamaReply(prompt);
  return result.ok ? result.text : null;
}