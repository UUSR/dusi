/**
 * Android System Actions
 * Доступные действия для выполнения на Android устройстве
 */

export interface AndroidAction {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresPermission?: string;
}

export const ANDROID_ACTIONS: AndroidAction[] = [
  // Phone Actions
  {
    id: 'call_number',
    name: 'Позвонить на номер',
    description: 'Позвонить на указанный номер телефона',
    category: 'Звонки',
    requiresPermission: 'CALL_PHONE',
  },
  {
    id: 'reject_call',
    name: 'Отклонить звонок',
    description: 'Отклонить входящий звонок',
    category: 'Звонки',
    requiresPermission: 'CALL_PHONE',
  },
  {
    id: 'answer_call',
    name: 'Ответить на звонок',
    description: 'Автоматически ответить на входящий звонок',
    category: 'Звонки',
    requiresPermission: 'CALL_PHONE',
  },
  {
    id: 'end_call',
    name: 'Завершить звонок',
    description: 'Завершить текущий звонок',
    category: 'Звонки',
    requiresPermission: 'CALL_PHONE',
  },

  // SMS/Message Actions
  {
    id: 'send_sms',
    name: 'Отправить SMS',
    description: 'Отправить SMS сообщение',
    category: 'Сообщения',
    requiresPermission: 'SEND_SMS',
  },
  {
    id: 'send_mms',
    name: 'Отправить MMS',
    description: 'Отправить MMS сообщение',
    category: 'Сообщения',
    requiresPermission: 'SEND_SMS',
  },

  // Voice Actions
  {
    id: 'speak_text',
    name: 'Произнести текст',
    description: 'Озвучить текст голосом (Text-to-Speech)',
    category: 'Голос',
  },
  {
    id: 'set_ringer_volume',
    name: 'Установить громкость звонка',
    description: 'Изменить громкость звонка',
    category: 'Голос',
  },
  {
    id: 'set_media_volume',
    name: 'Установить громкость медиа',
    description: 'Изменить громкость проигрывания медиа',
    category: 'Голос',
  },
  {
    id: 'vibrate',
    name: 'Вибрация',
    description: 'Включить вибрацию устройства',
    category: 'Голос',
    requiresPermission: 'VIBRATE',
  },
  {
    id: 'reply_voice',
    name: 'Ответить голосом',
    description: 'Произнести ответ при распознавании заданной фразы',
    category: 'Голос',
  },

  // Phrase Actions
  {
    id: 'listen_phrase',
    name: 'Слушать фразу',
    description: 'Активировать реакцию ассистента на указанную голосовую фразу',
    category: 'Фраза',
  },
  {
    id: 'stop_listen_phrase',
    name: 'Отключить фразу',
    description: 'Отключить реакцию ассистента на выбранную голосовую фразу',
    category: 'Фраза',
  },
  {
    id: 'run_script_by_phrase',
    name: 'Запустить скрипт по фразе',
    description: 'Запустить выбранный скрипт после распознавания голосовой фразы',
    category: 'Фраза',
  },

  // Display Actions
  {
    id: 'turn_on_screen',
    name: 'Включить экран',
    description: 'Включить экран устройства',
    category: 'Дисплей',
    requiresPermission: 'WAKE_LOCK',
  },
  {
    id: 'turn_off_screen',
    name: 'Выключить экран',
    description: 'Выключить экран устройства',
    category: 'Дисплей',
  },
  {
    id: 'set_brightness',
    name: 'Установить яркость',
    description: 'Изменить яркость экрана',
    category: 'Дисплей',
    requiresPermission: 'WRITE_SETTINGS',
  },
  {
    id: 'show_notification',
    name: 'Показать уведомление',
    description: 'Отправить уведомление',
    category: 'Дисплей',
  },
  {
    id: 'show_toast',
    name: 'Показать всплывающее сообщение',
    description: 'Показать краткое всплывающее сообщение',
    category: 'Дисплей',
  },

  // Device Actions
  {
    id: 'lock_screen',
    name: 'Заблокировать устройство',
    description: 'Заблокировать экран устройства',
    category: 'Устройство',
    requiresPermission: 'BIND_DEVICE_ADMIN',
  },
  {
    id: 'unlock_screen',
    name: 'Разблокировать устройство',
    description: 'Разблокировать экран устройства',
    category: 'Устройство',
    requiresPermission: 'BIND_DEVICE_ADMIN',
  },
  {
    id: 'enable_airplane_mode',
    name: 'Включить режим полёта',
    description: 'Активировать режим полёта',
    category: 'Устройство',
    requiresPermission: 'WRITE_SETTINGS',
  },
  {
    id: 'disable_airplane_mode',
    name: 'Отключить режим полёта',
    description: 'Деактивировать режим полёта',
    category: 'Устройство',
    requiresPermission: 'WRITE_SETTINGS',
  },
  {
    id: 'reboot',
    name: 'Перезагрузить устройство',
    description: 'Перезагрузить Android устройство',
    category: 'Устройство',
    requiresPermission: 'REBOOT',
  },

  // Network Actions
  {
    id: 'enable_wifi',
    name: 'Включить Wi-Fi',
    description: 'Включить Wi-Fi модуль',
    category: 'Сеть',
    requiresPermission: 'CHANGE_WIFI_STATE',
  },
  {
    id: 'disable_wifi',
    name: 'Отключить Wi-Fi',
    description: 'Отключить Wi-Fi модуль',
    category: 'Сеть',
    requiresPermission: 'CHANGE_WIFI_STATE',
  },
  {
    id: 'enable_mobile_data',
    name: 'Включить мобильный интернет',
    description: 'Включить мобильные данные',
    category: 'Сеть',
    requiresPermission: 'MODIFY_PHONE_STATE',
  },
  {
    id: 'disable_mobile_data',
    name: 'Отключить мобильный интернет',
    description: 'Отключить мобильные данные',
    category: 'Сеть',
    requiresPermission: 'MODIFY_PHONE_STATE',
  },
  {
    id: 'enable_bluetooth',
    name: 'Включить Bluetooth',
    description: 'Включить Bluetooth модуль',
    category: 'Сеть',
    requiresPermission: 'BLUETOOTH_ADMIN',
  },
  {
    id: 'disable_bluetooth',
    name: 'Отключить Bluetooth',
    description: 'Отключить Bluetooth модуль',
    category: 'Сеть',
    requiresPermission: 'BLUETOOTH_ADMIN',
  },

  // Location & Sensor Actions
  {
    id: 'enable_gps',
    name: 'Включить GPS',
    description: 'Включить GPS модуль',
    category: 'Местоположение',
    requiresPermission: 'ACCESS_FINE_LOCATION',
  },
  {
    id: 'disable_gps',
    name: 'Отключить GPS',
    description: 'Отключить GPS модуль',
    category: 'Местоположение',
    requiresPermission: 'ACCESS_FINE_LOCATION',
  },
  {
    id: 'enable_nfc',
    name: 'Включить NFC',
    description: 'Включить NFC модуль',
    category: 'Сеть',
    requiresPermission: 'NFC',
  },
  {
    id: 'disable_nfc',
    name: 'Отключить NFC',
    description: 'Отключить NFC модуль',
    category: 'Сеть',
    requiresPermission: 'NFC',
  },

  // Camera & Media Actions
  {
    id: 'take_photo',
    name: 'Сделать фото',
    description: 'Сделать фотографию встроенной камерой',
    category: 'Камера',
    requiresPermission: 'CAMERA',
  },
  {
    id: 'start_recording',
    name: 'Начать запись видео',
    description: 'Начать запись видео встроенной камерой',
    category: 'Камера',
    requiresPermission: 'CAMERA',
  },
  {
    id: 'stop_recording',
    name: 'Остановить запись видео',
    description: 'Остановить текущую запись видео',
    category: 'Камера',
    requiresPermission: 'CAMERA',
  },
  {
    id: 'play_sound',
    name: 'Проиграть звук',
    description: 'Воспроизвести звуковой файл',
    category: 'Камера',
  },
  {
    id: 'stop_playback',
    name: 'Остановить воспроизведение',
    description: 'Остановить воспроизведение медиа',
    category: 'Камера',
  },

  // App Actions
  {
    id: 'open_app',
    name: 'Открыть приложение',
    description: 'Открыть указанное приложение',
    category: 'Приложения',
  },
  {
    id: 'close_app',
    name: 'Закрыть приложение',
    description: 'Закрыть указанное приложение',
    category: 'Приложения',
  },
  {
    id: 'install_app',
    name: 'Установить приложение',
    description: 'Установить приложение из APK файла',
    category: 'Приложения',
    requiresPermission: 'INSTALL_PACKAGES',
  },
  {
    id: 'uninstall_app',
    name: 'Удалить приложение',
    description: 'Удалить указанное приложение',
    category: 'Приложения',
    requiresPermission: 'DELETE_PACKAGES',
  },

  // Other Actions
  {
    id: 'open_settings',
    name: 'Открыть настройки',
    description: 'Открыть системные настройки Android',
    category: 'Система',
  },
  {
    id: 'open_url',
    name: 'Открыть ссылку',
    description: 'Открыть веб-ссылку в браузере',
    category: 'Система',
  },
  {
    id: 'share_content',
    name: 'Поделиться контентом',
    description: 'Поделиться содержимым через приложение',
    category: 'Система',
  },
  {
    id: 'copy_to_clipboard',
    name: 'Скопировать в буфер обмена',
    description: 'Скопировать текст в буфер обмена',
    category: 'Система',
  },
  {
    id: 'send_email',
    name: 'Отправить письмо',
    description: 'Открыть почтовое приложение для отправки письма',
    category: 'Система',
  },
];

export const getActionsByCategory = (): Record<string, AndroidAction[]> => {
  const grouped: Record<string, AndroidAction[]> = {};
  
  ANDROID_ACTIONS.forEach(action => {
    if (!grouped[action.category]) {
      grouped[action.category] = [];
    }
    grouped[action.category].push(action);
  });

  return grouped;
};

export const getActionById = (id: string): AndroidAction | undefined => {
  return ANDROID_ACTIONS.find(action => action.id === id);
};
