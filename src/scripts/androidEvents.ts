/**
 * Android System Events
 * Доступные события системы Android для использования в скриптах
 */

export interface AndroidEvent {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const ANDROID_EVENTS: AndroidEvent[] = [
  // Phone Events
  {
    id: 'incoming_call',
    name: 'Входящий звонок',
    description: 'Срабатывает при входящем звонке',
    category: 'Звонки',
  },
  {
    id: 'outgoing_call',
    name: 'Исходящий звонок',
    description: 'Срабатывает при исходящем звонке',
    category: 'Звонки',
  },
  {
    id: 'call_ended',
    name: 'Звонок завершён',
    description: 'Срабатывает при завершении звонка',
    category: 'Звонки',
  },
  {
    id: 'call_rejected',
    name: 'Звонок отклонен',
    description: 'Срабатывает при отклонении звонка',
    category: 'Звонки',
  },

  // SMS/Message Events
  {
    id: 'sms_received',
    name: 'SMS получено',
    description: 'Срабатывает при получении SMS сообщения',
    category: 'Сообщения',
  },
  {
    id: 'sms_sent',
    name: 'SMS отправлено',
    description: 'Срабатывает при отправке SMS сообщения',
    category: 'Сообщения',
  },
  {
    id: 'mms_received',
    name: 'MMS получено',
    description: 'Срабатывает при получении MMS сообщения',
    category: 'Сообщения',
  },

  // Device Events
  {
    id: 'screen_on',
    name: 'Экран включен',
    description: 'Срабатывает при включении экрана',
    category: 'Устройство',
  },
  {
    id: 'screen_off',
    name: 'Экран выключен',
    description: 'Срабатывает при выключении экрана',
    category: 'Устройство',
  },
  {
    id: 'device_unlocked',
    name: 'Устройство разблокировано',
    description: 'Срабатывает при разблокировке устройства',
    category: 'Устройство',
  },
  {
    id: 'device_locked',
    name: 'Устройство заблокировано',
    description: 'Срабатывает при блокировке устройства',
    category: 'Устройство',
  },
  {
    id: 'battery_low',
    name: 'Низкая батарея',
    description: 'Срабатывает при низком уровне батареи',
    category: 'Устройство',
  },
  {
    id: 'charging_started',
    name: 'Зарядка начата',
    description: 'Срабатывает при подключении к зарядке',
    category: 'Устройство',
  },
  {
    id: 'charging_ended',
    name: 'Зарядка окончена',
    description: 'Срабатывает при отключении зарядки',
    category: 'Устройство',
  },

  // Network Events
  {
    id: 'wifi_connected',
    name: 'Wi-Fi подключен',
    description: 'Срабатывает при подключении к Wi-Fi',
    category: 'Сеть',
  },
  {
    id: 'wifi_disconnected',
    name: 'Wi-Fi отключен',
    description: 'Срабатывает при отключении от Wi-Fi',
    category: 'Сеть',
  },
  {
    id: 'mobile_network_on',
    name: 'Мобильная сеть включена',
    description: 'Срабатывает при включении мобильной сети',
    category: 'Сеть',
  },
  {
    id: 'mobile_network_off',
    name: 'Мобильная сеть отключена',
    description: 'Срабатывает при отключении мобильной сети',
    category: 'Сеть',
  },

  // Notification Events
  {
    id: 'notification_received',
    name: 'Уведомление получено',
    description: 'Срабатывает при получении уведомления от приложения',
    category: 'Уведомления',
  },
  {
    id: 'notification_removed',
    name: 'Уведомление удалено',
    description: 'Срабатывает при удалении уведомления',
    category: 'Уведомления',
  },

  // Phrase Events
  {
    id: 'phrase_heard',
    name: 'Фраза распознана',
    description: 'Срабатывает, когда ассистент распознает указанную фразу',
    category: 'Фраза',
  },
  {
    id: 'wake_word_detected',
    name: 'Ключевое слово',
    description: 'Срабатывает при распознавании ключевого слова активации',
    category: 'Фраза',
  },
  {
    id: 'assistant_command_received',
    name: 'Голосовая команда',
    description: 'Срабатывает, когда ассистент получает голосовую команду',
    category: 'Фраза',
  },

  // Time Events
  {
    id: 'on_time',
    name: 'В определённое время',
    description: 'Срабатывает в установленное время',
    category: 'Время',
  },
  {
    id: 'on_alarm',
    name: 'Будильник',
    description: 'Срабатывает при звонке будильника',
    category: 'Время',
  },

  // App Events
  {
    id: 'app_opened',
    name: 'Приложение открыто',
    description: 'Срабатывает при открытии приложения',
    category: 'Приложения',
  },
  {
    id: 'app_closed',
    name: 'Приложение закрыто',
    description: 'Срабатывает при закрытии приложения',
    category: 'Приложения',
  },
  {
    id: 'app_installed',
    name: 'Приложение установлено',
    description: 'Срабатывает при установке приложения',
    category: 'Приложения',
  },
  {
    id: 'app_uninstalled',
    name: 'Приложение удалено',
    description: 'Срабатывает при удалении приложения',
    category: 'Приложения',
  },

  // Location Events
  {
    id: 'location_changed',
    name: 'Местоположение изменилось',
    description: 'Срабатывает при значительном изменении местоположения',
    category: 'Местоположение',
  },

  // Headset Events
  {
    id: 'headset_connected',
    name: 'Наушники подключены',
    description: 'Срабатывает при подключении наушников',
    category: 'Аудио',
  },
  {
    id: 'headset_disconnected',
    name: 'Наушники отключены',
    description: 'Срабатывает при отключении наушников',
    category: 'Аудио',
  },
];

export const getEventsByCategory = (): Record<string, AndroidEvent[]> => {
  const grouped: Record<string, AndroidEvent[]> = {};
  
  ANDROID_EVENTS.forEach(event => {
    if (!grouped[event.category]) {
      grouped[event.category] = [];
    }
    grouped[event.category].push(event);
  });

  return grouped;
};

export const getEventById = (id: string): AndroidEvent | undefined => {
  return ANDROID_EVENTS.find(event => event.id === id);
};
