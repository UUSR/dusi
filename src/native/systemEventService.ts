import { NativeModules, NativeEventEmitter } from 'react-native';

const { SystemEvent } = NativeModules;

const eventEmitter = new NativeEventEmitter(SystemEvent);

export interface SystemEventListener {
  (eventId: string): void;
}

let isListening = false;
let listeners: SystemEventListener[] = [];

export const SystemEventService = {
  /**
   * Запустить прослушивание системных событий
   */
  async startListening(): Promise<void> {
    if (isListening) {
      return;
    }

    try {
      await SystemEvent.startListening();
      isListening = true;
      console.log('[SystemEventService] Started listening for system events');
    } catch (error) {
      console.error('[SystemEventService] Failed to start listening:', error);
      throw error;
    }
  },

  /**
   * Остановить прослушивание системных событий
   */
  async stopListening(): Promise<void> {
    if (!isListening) {
      return;
    }

    try {
      await SystemEvent.stopListening();
      isListening = false;
      console.log('[SystemEventService] Stopped listening for system events');
    } catch (error) {
      console.error('[SystemEventService] Failed to stop listening:', error);
      throw error;
    }
  },

  /**
   * Подписаться на системные события
   */
  subscribe(listener: SystemEventListener): () => void {
    listeners.push(listener);

    const unsubscribe = () => {
      listeners = listeners.filter(l => l !== listener);
    };

    return unsubscribe;
  },

  /**
   * Получить список зарегистрированных слушателей
   */
  getListeners(): SystemEventListener[] {
    return [...listeners];
  },
};

// Настроить обработчик событий от нативного модуля
eventEmitter.addListener('SystemEvent', (eventId: string) => {
  console.log('[SystemEventService] Received event:', eventId);
  listeners.forEach(listener => {
    try {
      listener(eventId);
    } catch (error) {
      console.error('[SystemEventService] Listener error:', error);
    }
  });
});

export default SystemEventService;
