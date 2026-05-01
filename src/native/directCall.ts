import {NativeModules, Platform} from 'react-native';

const {DirectCall} = NativeModules;

/**
 * Выполняет прямой звонок на Android через ACTION_CALL (без открытия приложения Телефон).
 * Требует разрешения CALL_PHONE.
 */
export async function directCall(phoneNumber: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('directCall доступен только на Android');
  }
  if (!DirectCall) {
    throw new Error('Нативный модуль DirectCall не найден');
  }
  await DirectCall.call(phoneNumber);
}
