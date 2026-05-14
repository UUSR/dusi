/**
 * Scripts Storage Service
 * Сервис для работы со скриптами (сохранение, загрузка, удаление)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Script} from './types';

const SCRIPTS_KEY = '@dusi_scripts';

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
export const importScripts = async (json: string): Promise<void> => {
  try {
    const imported = JSON.parse(json) as Script[];
    const existing = await loadScripts();
    
    // Генерируем новые ID для импортированных скриптов, чтобы избежать конфликтов
    const merged = [
      ...existing,
      ...imported.map(script => ({
        ...script,
        id: Math.random().toString(36).substring(2, 11),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
    ];
    
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('[Scripts] Failed to import scripts:', error);
    throw error;
  }
};
