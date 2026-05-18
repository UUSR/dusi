import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

const {BackgroundAssistant} = NativeModules;

export interface BackgroundAssistantConfig {
  enabled: boolean;
  running: boolean;
  requireWakeWord: boolean;
  wakeWord: string;
  cooldownMs: number;
}

export interface BackgroundAssistantConfigPatch {
  requireWakeWord?: boolean;
  wakeWord?: string;
  cooldownMs?: number;
}

export interface BackgroundAssistantState {
  enabled: boolean;
  running: boolean;
}

function ensureAndroid(): void {
  if (Platform.OS !== 'android') {
    throw new Error('BackgroundAssistant доступен только на Android');
  }
  if (!BackgroundAssistant) {
    throw new Error('Нативный модуль BackgroundAssistant не найден');
  }
}

export async function startBackgroundAssistant(): Promise<void> {
  ensureAndroid();
  await BackgroundAssistant.start();
}

export async function stopBackgroundAssistant(): Promise<void> {
  ensureAndroid();
  await BackgroundAssistant.stop();
}

export async function isBackgroundAssistantRunning(): Promise<boolean> {
  ensureAndroid();
  return BackgroundAssistant.isRunning();
}

export async function getBackgroundAssistantConfig(): Promise<BackgroundAssistantConfig> {
  ensureAndroid();
  return BackgroundAssistant.getConfig();
}

export async function setBackgroundAssistantConfig(
  patch: BackgroundAssistantConfigPatch,
): Promise<void> {
  ensureAndroid();
  await BackgroundAssistant.setConfig(patch);
}

export function subscribeBackgroundAssistantPhrases(
  onPhrase: (phrase: string) => void,
): () => void {
  if (Platform.OS !== 'android' || !BackgroundAssistant) {
    return () => {};
  }

  const emitter = new NativeEventEmitter(BackgroundAssistant);
  const subscription = emitter.addListener('BackgroundAssistantPhrase', payload => {
    const phrase = typeof payload === 'string' ? payload.trim() : '';
    if (phrase) {
      onPhrase(phrase);
    }
  });

  return () => {
    subscription.remove();
  };
}

export function subscribeBackgroundAssistantState(
  onState: (state: BackgroundAssistantState) => void,
): () => void {
  if (Platform.OS !== 'android' || !BackgroundAssistant) {
    return () => {};
  }

  const emitter = new NativeEventEmitter(BackgroundAssistant);
  const subscription = emitter.addListener('BackgroundAssistantState', payload => {
    const state = {
      enabled: !!payload?.enabled,
      running: !!payload?.running,
    };
    onState(state);
  });

  return () => {
    subscription.remove();
  };
}
