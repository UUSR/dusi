import {NativeModules, Platform} from 'react-native';

const {CallLogResolver} = NativeModules;

export interface LatestIncomingCall {
  number: string;
  cachedName: string;
  date: number;
}

function ensureAndroid() {
  if (Platform.OS !== 'android') {
    throw new Error('CallLogResolver доступен только на Android');
  }
  if (!CallLogResolver) {
    throw new Error('Нативный модуль CallLogResolver не найден');
  }
}

export async function getLatestIncomingCall(maxAgeMs = 30000): Promise<LatestIncomingCall | null> {
  ensureAndroid();
  const value = await CallLogResolver.getLatestIncomingCall(maxAgeMs);
  if (!value) {
    return null;
  }

  return {
    number: typeof value.number === 'string' ? value.number : '',
    cachedName: typeof value.cachedName === 'string' ? value.cachedName : '',
    date: typeof value.date === 'number' ? value.date : 0,
  };
}
