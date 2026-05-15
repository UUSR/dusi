/**
 * Scripts Storage Service
 * Сервис для работы со скриптами (сохранение, загрузка, удаление)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Script} from './types';

const SCRIPTS_KEY = '@dusi_scripts';

const randomScriptId = () => Math.random().toString(36).substring(2, 11);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeImportedScript = (raw: unknown): Script | null => {
  if (!isObject(raw)) {
    return null;
  }

  const rawName = raw.name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name) {
    return null;
  }

  const events = Array.isArray(raw.events)
    ? raw.events
        .filter(isObject)
        .map(event => ({
          eventId: typeof event.eventId === 'string' ? event.eventId : '',
          eventName:
            typeof event.eventName === 'string' && event.eventName.trim()
              ? event.eventName
              : typeof event.eventId === 'string'
              ? event.eventId
              : '',
          enabled: typeof event.enabled === 'boolean' ? event.enabled : true,
          conditions: isObject(event.conditions) ? event.conditions : {},
        }))
        .filter(event => !!event.eventId && !!event.eventName)
    : [];

  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter(isObject)
        .map(action => ({
          actionId: typeof action.actionId === 'string' ? action.actionId : '',
          actionName:
            typeof action.actionName === 'string' && action.actionName.trim()
              ? action.actionName
              : typeof action.actionId === 'string'
              ? action.actionId
              : '',
          enabled: typeof action.enabled === 'boolean' ? action.enabled : true,
          parameters: isObject(action.parameters) ? action.parameters : {},
          delay: typeof action.delay === 'number' && Number.isFinite(action.delay) ? action.delay : undefined,
        }))
        .filter(action => !!action.actionId && !!action.actionName)
    : [];

  const rawTags = raw.tags;
  const tags = Array.isArray(rawTags) ? rawTags.filter(tag => typeof tag === 'string') : [];

  const description = typeof raw.description === 'string' ? raw.description : '';

  return {
    id: randomScriptId(),
    name,
    description,
    events,
    actions,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags,
  };
};

/**
 * Загрузить все скрипты из хранилища
 */
export const loadScripts = async (): Promise<Script[]> => {
  try {
    const json = await AsyncStorage.getItem(SCRIPTS_KEY);
    if (!json) {
      return [];
    }
    const scripts = JSON.parse(json) as Script[];
    return scripts;
  } catch (error) {
    console.error('[Scripts] Failed to load scripts:', error);
    return [];
  }
};

/**
 * Загрузить один скрипт по ID
 */
export const loadScriptById = async (id: string): Promise<Script | null> => {
  try {
    const scripts = await loadScripts();
    return scripts.find(s => s.id === id) || null;
  } catch (error) {
    console.error('[Scripts] Failed to load script by id:', error);
    return null;
  }
};

/**
 * Сохранить новый скрипт или обновить существующий
 */
export const saveScript = async (script: Script): Promise<void> => {
  try {
    const scripts = await loadScripts();
    const index = scripts.findIndex(s => s.id === script.id);
    
    const updatedScript = {
      ...script,
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      scripts[index] = updatedScript;
    } else {
      scripts.push(updatedScript);
    }

    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts));
  } catch (error) {
    console.error('[Scripts] Failed to save script:', error);
    throw error;
  }
};

/**
 * Удалить скрипт по ID
 */
export const deleteScript = async (id: string): Promise<void> => {
  try {
    const scripts = await loadScripts();
    const filtered = scripts.filter(s => s.id !== id);
    
    if (filtered.length === 0) {
      await AsyncStorage.removeItem(SCRIPTS_KEY);
    } else {
      await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('[Scripts] Failed to delete script:', error);
    throw error;
  }
};

/**
 * Очистить все скрипты
 */
export const clearAllScripts = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCRIPTS_KEY);
  } catch (error) {
    console.error('[Scripts] Failed to clear scripts:', error);
    throw error;
  }
};

/**
 * Получить количество скриптов
 */
export const getScriptsCount = async (): Promise<number> => {
  try {
    const scripts = await loadScripts();
    return scripts.length;
  } catch (error) {
    console.error('[Scripts] Failed to get scripts count:', error);
    return 0;
  }
};

/**
 * Экспортировать скрипты в JSON
 */
export const exportScripts = async (): Promise<string> => {
  try {
    const scripts = await loadScripts();
    return JSON.stringify(scripts, null, 2);
  } catch (error) {
    console.error('[Scripts] Failed to export scripts:', error);
    throw error;
  }
};

/**
 * Импортировать скрипты из JSON
 */
export const importScripts = async (json: string): Promise<number> => {
  try {
    const normalizedJson = json.replace(/^\uFEFF/, '').trim();
    if (!normalizedJson) {
      throw new Error('Файл пустой');
    }

    const parsed = JSON.parse(normalizedJson) as unknown;
    const rawScripts = Array.isArray(parsed) ? parsed : [parsed];
    const imported = rawScripts
      .map(normalizeImportedScript)
      .filter((script): script is Script => script !== null);

    if (imported.length === 0) {
      throw new Error('В файле нет корректных скриптов для импорта');
    }

    const existing = await loadScripts();
    const merged = [...existing, ...imported];
    
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(merged));
    return imported.length;
  } catch (error) {
    console.error('[Scripts] Failed to import scripts:', error);

    if (error instanceof SyntaxError) {
      throw new Error('Файл содержит некорректный JSON');
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Не удалось импортировать скрипты');
  }
};
