import {NativeModules, Platform} from 'react-native';

const {OpenApp} = NativeModules;

export async function openInstalledApp(packageName: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('openInstalledApp доступен только на Android');
  }

  if (!OpenApp || typeof OpenApp.open !== 'function') {
    throw new Error('Нативный модуль OpenApp не найден');
  }

  const normalized = String(packageName || '').trim();
  if (!normalized) {
    throw new Error('Не задан packageName приложения');
  }

  await OpenApp.open(normalized);
}
