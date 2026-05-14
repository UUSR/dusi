import React, {useEffect, useMemo, useRef, useState, Component} from 'react';
import {
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import AssistantScreen from './src/screens/AssistantScreen';
import ScriptsScreen from './src/screens/ScriptsScreen';
import ScriptEditorScreen from './src/screens/ScriptEditorScreen';
import {Script} from './src/scripts/types';
import {loadScripts} from './src/scripts/storageService';
import {getSystemEventScript} from './src/assistant/rules';
import {createCallDetector} from './src/native/callDetectionCompat';
import {directCall} from './src/native/directCall';
import {SystemEventService} from './src/native/systemEventService';
import {
  getInstalledApps,
  getVoiceNotificationsSettings,
  InstalledAppInfo,
  isVoiceNotificationAccessGranted,
  openVoiceNotificationAccessSettings,
  setVoiceNotificationsEnabled,
  setVoiceNotificationsMode,
  setVoiceNotificationsSelectedPackages,
  VoiceNotificationMode,
} from './src/native/voiceNotifications';
import {
  checkOllamaConnection,
  getOllamaTargetInfo,
  setOllamaConfig,
  OLLAMA_DEVICE_URL,
  OLLAMA_DEVICE_URL_PLACEHOLDER,
  DEFAULT_OLLAMA_MODEL,
  loadOllamaConfig,
} from './src/assistant/ollama';

let Contacts: any = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const contactsModule = require('react-native-contacts');
  Contacts = contactsModule?.default ?? contactsModule;
} catch (error) {
  console.error('[Contacts] module load failed', error);
}

let Tts: any = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ttsModule = require('react-native-tts');
  Tts = ttsModule?.default ?? ttsModule;
} catch (error) {
  console.error('[TTS] module load failed', error);
}

const APP_VERSION: string = require('./package.json').version;

interface ErrorBoundaryState {
  error: Error | null;
}
class AppErrorBoundary extends Component<{children: React.ReactNode}, ErrorBoundaryState> {
  state: ErrorBoundaryState = {error: null};
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{flex: 1, backgroundColor: '#FDE047', alignItems: 'center', justifyContent: 'center', padding: 20}}>
          <Text style={{fontSize: 18, fontWeight: '700', color: '#7F1D1D', marginBottom: 12}}>
            Ошибка приложения
          </Text>
          <Text style={{fontSize: 13, color: '#374151', textAlign: 'center'}}>
            {this.state.error.message}
          </Text>
          <Pressable
            style={{marginTop: 20, backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12}}
            onPress={() => this.setState({error: null})}>
            <Text style={{color: '#FFF', fontWeight: '700'}}>Закрыть</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

type Screen =
  | 'home'
  | 'assistant'
  | 'calls'
  | 'skills'
  | 'scripts'
  | 'scriptEditor'
  | 'ollamaSettings'
  | 'voiceNotifications'
  | 'voiceNotificationApps';

interface FeatureCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

interface CallDetectorInstance {
  dispose?: () => void;
}

type OllamaStatusState = 'idle' | 'checking' | 'ok' | 'error';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [autoStartAssistant, setAutoStartAssistant] = useState(false);
  const [assistantQuickCommand, setAssistantQuickCommand] = useState<{text: string; token: number} | null>(null);
  const [assistantScriptTest, setAssistantScriptTest] = useState<{script: Script; token: number} | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [callsTab, setCallsTab] = useState<'settings' | 'examples'>('settings');
  const [exampleActionMessage, setExampleActionMessage] = useState('');
  const [notifyOnCall, setNotifyOnCall] = useState(true);
  const notifyOnCallRef = useRef(notifyOnCall);
  const lastIncomingNumberRef = useRef('');
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 16);

  const [ollamaUrl, setOllamaUrl] = useState(OLLAMA_DEVICE_URL);
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [ollamaSaved, setOllamaSaved] = useState(false);
  const [ollamaStatusState, setOllamaStatusState] = useState<OllamaStatusState>('idle');
  const [ollamaStatusMessage, setOllamaStatusMessage] = useState('Адрес ещё не проверялся.');
  const [ollamaStatusTarget, setOllamaStatusTarget] = useState('');
  const ollamaLoadedRef = useRef(false);

  const [voiceNotificationsEnabled, setVoiceNotificationsEnabledState] = useState(false);
  const [voiceNotificationsMode, setVoiceNotificationsModeState] = useState<VoiceNotificationMode>('all');
  const [voiceNotificationAccessGranted, setVoiceNotificationAccessGranted] = useState(false);
  const [voiceNotificationApps, setVoiceNotificationApps] = useState<InstalledAppInfo[]>([]);
  const [voiceNotificationSelectedPackages, setVoiceNotificationSelectedPackagesState] = useState<string[]>([]);
  const [voiceNotificationIncludeSystem, setVoiceNotificationIncludeSystem] = useState(true);
  const [voiceNotificationLoadingApps, setVoiceNotificationLoadingApps] = useState(false);
  const [voiceNotificationError, setVoiceNotificationError] = useState('');

  const [editingScript, setEditingScript] = useState<Script | null>(null);

  const refreshOllamaStatus = async () => {
    const targetInfo = getOllamaTargetInfo();
    setOllamaStatusTarget(targetInfo.baseUrl || 'не указан');
    setOllamaStatusState('checking');

    const result = await checkOllamaConnection();
    setOllamaStatusTarget(result.baseUrl || 'не указан');

    if (result.ok) {
      setOllamaStatusState(result.error ? 'error' : 'ok');
      setOllamaStatusMessage(result.error ?? result.text ?? 'Соединение установлено.');
      return;
    }

    setOllamaStatusState('error');
    setOllamaStatusMessage(result.error ?? 'Не удалось проверить соединение с Ollama.');
  };

  const loadVoiceNotificationsSettings = async () => {
    if (Platform.OS !== 'android') {
      setVoiceNotificationError('Голосовые уведомления доступны только на Android.');
      return;
    }

    try {
      const settings = await getVoiceNotificationsSettings();
      setVoiceNotificationsEnabledState(settings.enabled);
      setVoiceNotificationsModeState(settings.mode);
      setVoiceNotificationSelectedPackagesState(settings.selectedPackages || []);
      setVoiceNotificationAccessGranted(settings.accessGranted);
      setVoiceNotificationError('');
    } catch (e) {
      setVoiceNotificationError(
        e instanceof Error ? e.message : 'Не удалось загрузить настройки голосовых уведомлений.',
      );
    }
  };

  const loadVoiceNotificationApps = async (includeSystem: boolean) => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      setVoiceNotificationLoadingApps(true);
      const apps = await getInstalledApps(includeSystem);
      setVoiceNotificationApps(apps);
      setVoiceNotificationError('');
    } catch (e) {
      setVoiceNotificationError(
        e instanceof Error ? e.message : 'Не удалось загрузить список приложений.',
      );
    } finally {
      setVoiceNotificationLoadingApps(false);
    }
  };

  const toggleVoiceNotificationsEnabled = async (value: boolean) => {
    const previous = voiceNotificationsEnabled;
    setVoiceNotificationsEnabledState(value);
    try {
      await setVoiceNotificationsEnabled(value);
      if (value) {
        const granted = await isVoiceNotificationAccessGranted();
        setVoiceNotificationAccessGranted(granted);
      }
      setVoiceNotificationError('');
    } catch (e) {
      setVoiceNotificationsEnabledState(previous);
      setVoiceNotificationError(
        e instanceof Error ? e.message : 'Не удалось изменить состояние голосовых уведомлений.',
      );
    }
  };

  const toggleVoiceNotificationsMode = async (mode: VoiceNotificationMode) => {
    const previous = voiceNotificationsMode;
    setVoiceNotificationsModeState(mode);
    try {
      await setVoiceNotificationsMode(mode);
      setVoiceNotificationError('');
    } catch (e) {
      setVoiceNotificationsModeState(previous);
      setVoiceNotificationError(
        e instanceof Error ? e.message : 'Не удалось изменить режим голосовых уведомлений.',
      );
    }
  };

  const toggleVoiceNotificationPackage = async (packageName: string, selected: boolean) => {
    const previous = voiceNotificationSelectedPackages;
    const next = selected
      ? [...voiceNotificationSelectedPackages, packageName]
      : voiceNotificationSelectedPackages.filter(pkg => pkg !== packageName);
    const unique = Array.from(new Set(next));

    setVoiceNotificationSelectedPackagesState(unique);

    try {
      await setVoiceNotificationsSelectedPackages(unique);
      setVoiceNotificationError('');
    } catch (e) {
      setVoiceNotificationSelectedPackagesState(previous);
      setVoiceNotificationError(
        e instanceof Error ? e.message : 'Не удалось сохранить список приложений.',
      );
    }
  };

  const handleTestScript = (scriptToTest: Script) => {
    setAssistantScriptTest({script: scriptToTest, token: Date.now()});
    setAutoStartAssistant(false);
    setScreen('assistant');
  };

  const runSystemScriptActions = async (scriptToRun: Script) => {
    const activeActions = (scriptToRun.actions || []).filter(action => action?.enabled !== false);
    const textAction = activeActions.find(
      action =>
        action.actionId === 'speak_text' ||
        action.actionId === 'reply_voice' ||
        action.actionId === 'reply_to_phrase',
    );

    const text = textAction
      ? textAction.parameters?.text || textAction.parameters?.replyText
      : '';

    if (typeof text === 'string' && text.trim()) {
      try {
        if (typeof Tts.setDefaultLanguage === 'function') {
          Tts.setDefaultLanguage('ru-RU');
        }
        if (typeof Tts.stop === 'function') {
          Promise.resolve(Tts.stop?.()).catch(() => {});
        }
        if (typeof Tts.speak === 'function') {
          Tts.speak(text.trim());
        }
      } catch (error) {
        console.error('[SystemEvent] TTS error:', error);
      }
      return;
    }

    console.log(`[SystemEvent] Script ${scriptToRun.name} has no voice action`);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const startSystemEvents = async () => {
      try {
        await SystemEventService.startListening();
        console.log('[App] Global system event listening started');

        unsubscribe = SystemEventService.subscribe(async eventId => {
          if (!active) {
            return;
          }

          try {
            const scripts = await loadScripts();
            const matchedScript = getSystemEventScript(eventId, scripts);

            if (!matchedScript) {
              return;
            }

            await runSystemScriptActions(matchedScript);
          } catch (error) {
            console.error('[App] Failed to handle system event:', error);
          }
        });
      } catch (error) {
        console.error('[App] Failed to start global system event listener:', error);
      }
    };

    void startSystemEvents();

    return () => {
      active = false;
      unsubscribe?.();
      void SystemEventService.stopListening();
    };
  }, []);

  // Загрузить сохранённые настройки Ollama при старте
  useEffect(() => {
    (async () => {
      const {url, model} = await loadOllamaConfig();
      console.log('[Ollama Config] Loaded from storage:', url, model);
      ollamaLoadedRef.current = true;
      setOllamaUrl(url);
      setOllamaModel(model);
      setOllamaConfig(url, model);
    })();
  }, []);

  // Синхронизировать настройки в модуль только после загрузки из хранилища
  useEffect(() => {
    if (!ollamaLoadedRef.current) { return; }
    console.log('[App] Setting Ollama config:', ollamaUrl, ollamaModel);
    setOllamaConfig(ollamaUrl, ollamaModel);
  }, [ollamaUrl, ollamaModel]);

  useEffect(() => {
    if (!ollamaLoadedRef.current || screen !== 'ollamaSettings') {
      return;
    }

    void refreshOllamaStatus();
  }, [screen]);

  useEffect(() => {
    if (screen === 'voiceNotifications') {
      void loadVoiceNotificationsSettings();
    }
  }, [screen]);

  useEffect(() => {
    if (screen === 'voiceNotificationApps') {
      void loadVoiceNotificationApps(voiceNotificationIncludeSystem);
    }
  }, [screen, voiceNotificationIncludeSystem]);

  const respondWithAssistantVoice = (message: string) => {
    setExampleActionMessage(message);

    try {
      if (typeof Tts.setDefaultLanguage === 'function') {
        Tts.setDefaultLanguage('ru-RU');
      }
      if (typeof Tts.stop === 'function') {
        Promise.resolve(Tts.stop?.()).catch(() => {});
      }
      if (typeof Tts.speak === 'function' && message) {
        Tts.speak(String(message).trim());
      }
    } catch (e) {
      console.error('[respondWithAssistantVoice]', e);
    }
  };

  const requestDirectCallPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.CALL_PHONE;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) {
      return true;
    }

    const granted = await PermissionsAndroid.request(permission, {
      title: 'Разрешение на звонки',
      message: 'Нужно для прямого звонка без открытия приложения Телефон.',
      buttonPositive: 'Разрешить',
      buttonNegative: 'Отмена',
    });

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const dialPhoneNumber = async (rawPhoneNumber: string, okMessage: string) => {
    const phoneNumber = rawPhoneNumber.replace(/[^+\d]/g, '');
    if (!phoneNumber) {
      respondWithAssistantVoice('Не удалось определить номер телефона.');
      return;
    }

    const granted = await requestDirectCallPermission();
    if (!granted) {
      respondWithAssistantVoice('Нет разрешения на прямой звонок. Разрешите звонки в настройках.');
      return;
    }

    try {
      await directCall(phoneNumber);
      respondWithAssistantVoice(okMessage);
    } catch (_e) {
      respondWithAssistantVoice('Не удалось выполнить прямой звонок на устройстве.');
    }
  };

  const normalizeContactText = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getFirstDialableNumber = (contact: any): string => {
    const phoneNumbers = Array.isArray(contact?.phoneNumbers) ? contact.phoneNumbers : [];
    const candidate = phoneNumbers
      .map((item: any) => (typeof item?.number === 'string' ? item.number : ''))
      .find((number: string) => number.replace(/[^+\d]/g, '').length > 0);
    return candidate ?? '';
  };

  const handleCallMomPress = async () => {
    try {
      if (typeof Contacts.getAll !== 'function') {
        respondWithAssistantVoice('Контакты недоступны на этом устройстве.');
        return;
      }

      const contacts = await Contacts.getAll();
      const mom = contacts.find((c: any) => {
        const fullName = normalizeContactText(
          [c.givenName, c.middleName, c.familyName, c.displayName, c.company]
            .filter(Boolean)
            .join(' '),
        );
        return /мам|мама|мать|mom|mother/i.test(fullName);
      });

      const momPhone = getFirstDialableNumber(mom);
      if (!momPhone) {
        respondWithAssistantVoice('Контакт «Мама» не найден или без номера.');
        return;
      }

      await dialPhoneNumber(momPhone, 'Звоню маме...');
    } catch (_e) {
      respondWithAssistantVoice('Не удалось выполнить команду «Позвони маме».');
    }
  };

  const handleVoiceCallByName = async (name: string) => {
    try {
      if (typeof Contacts.getAll !== 'function') {
        respondWithAssistantVoice('Контакты недоступны на этом устройстве.');
        return;
      }

      const rawQuery = normalizeContactText(name).replace(/\b(пожалуйста|плиз)\b/gi, '').trim();
      if (!rawQuery) {
        respondWithAssistantVoice('Не удалось определить имя контакта.');
        return;
      }

      if (/^мам(а|е|у|ой|ы|очка|очке|очку)?$|^mom$|^mother$/i.test(rawQuery)) {
        await handleCallMomPress();
        return;
      }

      const contacts = await Contacts.getAll();
      const queryTokens = rawQuery.split(' ').filter(Boolean);
      const found = contacts.find((c: any) => {
        const fullName = normalizeContactText(
          [c.givenName, c.middleName, c.familyName, c.displayName, c.company]
            .filter(Boolean)
            .join(' '),
        );
        if (!fullName) {
          return false;
        }

        return queryTokens.every(token => {
          if (fullName.includes(token)) {
            return true;
          }

          if (token.length >= 4) {
            const stem = token.slice(0, token.length - 1);
            return fullName.includes(stem);
          }

          return false;
        });
      });
      const phone = getFirstDialableNumber(found);
      if (!phone) {
        respondWithAssistantVoice(`Контакт «${rawQuery}» не найден или без номера.`);
        return;
      }
      const displayName =
        [found?.givenName, found?.familyName, found?.displayName]
          .filter(Boolean)
          .join(' ') || rawQuery;
      await dialPhoneNumber(phone, `Звоню ${displayName}…`);
    } catch (_e) {
      respondWithAssistantVoice(`Не удалось позвонить «${name}».`);
    }
  };

  const handleRedialPress = async () => {
    const lastIncoming = lastIncomingNumberRef.current;
    if (!lastIncoming) {
      respondWithAssistantVoice('Нет номера для «Перезвони». Дождитесь входящего звонка.');
      return;
    }

    try {
      await dialPhoneNumber(lastIncoming, 'Перезваниваю...');
    } catch (_e) {
      respondWithAssistantVoice('Не удалось выполнить команду «Перезвони».');
    }
  };

  const openCallSettings = async (kind: 'dialer-app' | 'call-management') => {
    if (Platform.OS !== 'android') {
      respondWithAssistantVoice('Эта настройка доступна только на Android.');
      return;
    }

    const intents =
      kind === 'dialer-app'
        ? ['android.settings.MANAGE_DEFAULT_APPS_SETTINGS']
        : ['android.settings.MANAGE_APPLICATIONS_SETTINGS'];

    for (const action of intents) {
      try {
        await Linking.sendIntent(action);
        respondWithAssistantVoice(
          kind === 'dialer-app'
            ? 'Открыл настройки: Приложение для звонков.'
            : 'Открыл настройки: Управление звонками.',
        );
        return;
      } catch (_e) {
        // Пробуем следующий интент или fallback.
      }
    }

    try {
      await Linking.openSettings();
      respondWithAssistantVoice('Не удалось открыть нужный раздел напрямую. Открываю общие настройки приложения.');
    } catch (_e) {
      respondWithAssistantVoice('Не удалось открыть настройки звонков.');
    }
  };

  useEffect(() => {
    notifyOnCallRef.current = notifyOnCall;
  }, [notifyOnCall]);

  useEffect(() => {
    let callDetector: CallDetectorInstance | null = null;

    const requestPermissionsAndStart = async () => {
      try {
        const phoneGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          {
            title: 'Разрешение на чтение состояния телефона',
            message: 'Нужно для объявления входящих звонков',
            buttonPositive: 'Разрешить',
          },
        );
        if (phoneGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }

        const contactsGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Разрешение на чтение контактов',
            message: 'Нужно чтобы назвать имя звонящего',
            buttonPositive: 'Разрешить',
          },
        );

        callDetector = createCallDetector(
          async (event: string, phoneNumber: string) => {
            if (event !== 'Incoming') return;
            if (!notifyOnCallRef.current) return;

            if (phoneNumber) {
              lastIncomingNumberRef.current = phoneNumber;
            }

            let callerName = phoneNumber || 'неизвестного номера';
            try {
              if (
                contactsGranted === PermissionsAndroid.RESULTS.GRANTED &&
                phoneNumber &&
                typeof Contacts.getContactsByPhoneNumber === 'function'
              ) {
                const results = await Contacts.getContactsByPhoneNumber(phoneNumber);
                if (results.length > 0) {
                  const c = results[0];
                  callerName = [c.givenName, c.familyName].filter(Boolean).join(' ') || phoneNumber;
                }
              }
            } catch (_) {}

            if (typeof Tts.setDefaultLanguage === 'function') {
              Tts.setDefaultLanguage('ru-RU');
            }
            if (typeof Tts.stop === 'function') {
              Promise.resolve(Tts.stop?.()).catch(() => {});
            }
            if (typeof Tts.speak === 'function') {
              Tts.speak(`Звонок от ${String(callerName).trim()}`);
            }
          },
        );
      } catch (_) {}
    };

    requestPermissionsAndStart();

    return () => {
      if (callDetector) {
        callDetector.dispose?.();
      }
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'scriptEditor') {
        setEditingScript(null);
        setScreen('scripts');
        return true;
      }
      if (screen !== 'home') {
        setScreen('home');
        setAutoStartAssistant(false);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [screen]);

  // Reset autoStart flag when leaving assistant screen
  useEffect(() => {
    if (screen !== 'assistant') {
      setAutoStartAssistant(false);
    }
  }, [screen]);

  const cards = useMemo<FeatureCard[]>(
    () => [
            {
        id: 'scripts',
        title: 'Скрипты',
        subtitle: 'СОЗДАВАЙТЕ НОВЫЕ ФУНКЦИИ',
        icon: '⚙️',
        action: () => setScreen('scripts'),
      },
      {
        id: 'calls',
        title: 'Звонки',
        subtitle: 'ЗВОНИТЕ КОНТАКТАМ И НА ПРОИЗВОЛЬНЫЕ НОМЕРА ТЕЛЕФОНОВ',
        icon: '📞',
        action: () => setScreen('calls'),
      },
      {
        id: 'skills',
        title: 'Навык',
        subtitle: 'УПРАВЛЯЙТЕ НАВЫКАМИ АССИСТЕНТА',
        icon: '🧩',
        action: () => setScreen('skills'),
      },
    ],
    [],
  );

  return (
    <>
      {screen === 'home' ? (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <StatusBar backgroundColor="#FBC02D" barStyle="dark-content" />

          <View style={styles.appBar}>
            <Pressable
              onPress={() => setIsDrawerOpen(true)}
              style={({pressed}) => [
                styles.menuButton,
                pressed && styles.menuButtonPressed,
              ]}
              android_ripple={{color: '#FDE68A'}}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </Pressable>
            <View>
              <Text style={styles.appBarTitle}>Список функций</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {cards.map(card => (
              <Pressable
                key={card.id}
                onPress={card.action}
                android_ripple={{color: '#FDE68A'}}
                style={({pressed}) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}>
                <View style={styles.cardIconWrap}>
                  <Text style={styles.cardIcon}>{card.icon}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => {
              setAutoStartAssistant(true);
              setScreen('assistant');
            }}
            style={({pressed}) => [styles.assistantFab, {bottom: insets.bottom + 24}, pressed && styles.assistantFabPressed]}
            android_ripple={{color: '#FDE68A'}}>
            <Text style={styles.assistantFabIcon}>🎙</Text>
          </Pressable>

          {isDrawerOpen ? (
            <>
              <Pressable
                style={styles.drawerBackdrop}
                onPress={() => setIsDrawerOpen(false)}
              />

              <SafeAreaView style={styles.drawerPanel} edges={['top', 'bottom']}>
                <View style={styles.drawerHeader}>
                  <View style={styles.appIconCircle}>
                    <Text style={styles.appIconText}>D</Text>
                  </View>
                  <Text style={styles.drawerTitle}>dusi</Text>
                  <View style={styles.drawerVersionIndicator}>
                    <Text style={styles.drawerVersionIndicatorLabel}>Индикатор версии</Text>
                    <Text style={styles.drawerVersionIndicatorValue}>v{APP_VERSION}</Text>
                  </View>
                </View>

                <Pressable
                  style={({pressed}) => [
                    styles.drawerItem,
                    pressed && styles.drawerItemPressed,
                  ]}
                  onPress={() => setIsDrawerOpen(false)}
                  android_ripple={{color: '#FDE68A'}}>
                  <Text style={styles.drawerItemText}>Главная</Text>
                </Pressable>

                <Pressable
                  style={({pressed}) => [
                    styles.drawerItem,
                    pressed && styles.drawerItemPressed,
                  ]}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    setScreen('assistant');
                  }}
                  android_ripple={{color: '#FDE68A'}}>
                  <Text style={styles.drawerItemText}>Голосовой ассистент</Text>
                </Pressable>

                <Pressable
                  style={({pressed}) => [
                    styles.drawerItem,
                    pressed && styles.drawerItemPressed,
                  ]}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    setScreen('ollamaSettings');
                  }}
                  android_ripple={{color: '#FDE68A'}}>
                  <Text style={styles.drawerItemText}>⚙️ Настройки Ollama</Text>
                </Pressable>

                <Pressable
                  style={({pressed}) => [
                    styles.drawerItem,
                    pressed && styles.drawerItemPressed,
                  ]}
                  onPress={() => {
                    setIsDrawerOpen(false);
                    setScreen('voiceNotifications');
                  }}
                  android_ripple={{color: '#FDE68A'}}>
                  <Text style={styles.drawerItemText}>🔔 Уведомлять голосом</Text>
                </Pressable>


              </SafeAreaView>
            </>
          ) : null}
        </SafeAreaView>
      ) : screen === 'calls' ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14}]}> 
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>📞</Text>
            </View>
            <Text style={styles.callsTitle}>Звонки</Text>
          </View>

          <View style={styles.callsTabsBar}> 
            <View style={styles.callsToggleWrap}>
              <Pressable
                onPress={() => setCallsTab('settings')}
                style={[
                  styles.callsToggleButton,
                  callsTab === 'settings' && styles.callsToggleButtonActive,
                ]}
                android_ripple={{color: '#9CCC65'}}>
                <Text
                  style={[
                    styles.callsToggleText,
                    callsTab === 'settings' && styles.callsToggleTextActive,
                  ]}>
                  Настройки
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCallsTab('examples')}
                style={[
                  styles.callsToggleButton,
                  callsTab === 'examples' && styles.callsToggleButtonActive,
                ]}
                android_ripple={{color: '#9CCC65'}}>
                <Text
                  style={[
                    styles.callsToggleText,
                    callsTab === 'examples' && styles.callsToggleTextActive,
                  ]}>
                  Примеры
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.callsPageContainer,
              {paddingBottom: safeBottomInset + 14},
            ]}>
            {callsTab === 'settings' ? (
              <ScrollView
                style={styles.callsSettingsScroll}
                contentContainerStyle={styles.callsSettingsContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.callsPageCard}>
                  <Text style={styles.callsSettingsHeader}>Настройки звонков</Text>

                  <View style={styles.callsSettingItem}>
                    <View style={styles.callsSettingRow}>
                      <View style={styles.callsSettingTextBlock}>
                        <Text style={styles.callsSettingTitle}>Уведомлять о входящем звонке</Text>
                        <Text style={styles.callsSettingDesc}>Ассистент произнесет имя звонящего</Text>
                      </View>
                      <Switch
                        value={notifyOnCall}
                        onValueChange={setNotifyOnCall}
                        thumbColor={notifyOnCall ? '#2E7D32' : '#f4f3f4'}
                        trackColor={{false: '#CBD5E1', true: '#86EFAC'}}
                      />
                    </View>
                  </View>

                  <Pressable
                    onPress={() => openCallSettings('dialer-app')}
                    style={({pressed}) => [styles.callsSettingAction, pressed && styles.callsSettingActionPressed]}
                    android_ripple={{color: '#D1FAE5'}}>
                    <Text style={styles.callsSettingActionTitle}>Выбор приложения для звонков</Text>
                    <Text style={styles.callsSettingActionDesc}>Открыть системный выбор приложения для звонков по умолчанию</Text>
                  </Pressable>

                </View>
              </ScrollView>
            ) : (
              <View style={styles.callsPageCard}>
                <Pressable
                  onPress={handleRedialPress}
                  style={({pressed}) => [styles.exampleAction, pressed && styles.exampleActionPressed]}
                  android_ripple={{color: '#D1FAE5'}}>
                  <Text style={styles.callsPageText}>Перезвони</Text>
                </Pressable>

                <Pressable
                  onPress={handleCallMomPress}
                  style={({pressed}) => [styles.exampleAction, pressed && styles.exampleActionPressed]}
                  android_ripple={{color: '#D1FAE5'}}>
                  <Text style={styles.callsPageText}>Позвони маме</Text>
                </Pressable>

                {exampleActionMessage ? (
                  <Text style={styles.exampleActionMessage}>{exampleActionMessage}</Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : screen === 'skills' ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#1565C0" barStyle="light-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14}]}>
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>🧩</Text>
            </View>
            <Text style={styles.callsTitle}>Навык</Text>
          </View>
          <View style={[styles.callsPageContainer, {paddingBottom: safeBottomInset + 14}]}>
            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Навыки ассистента</Text>
              <Text style={styles.callsPageText}>Здесь будут настройки навыков.</Text>
            </View>
          </View>
        </View>
      ) : screen === 'scripts' && !editingScript ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#38BDF8" barStyle="dark-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14, backgroundColor: '#7DD3FC'}]}>
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>⚙️</Text>
            </View>
            <Text style={[styles.callsTitle, {color: '#111827'}]}>Скрипты</Text>
          </View>
          <ScriptsScreen
            onSelectScript={script => {
              setEditingScript(script);
              setScreen('scriptEditor');
            }}
            onEditScript={script => {
              setEditingScript(script);
              setScreen('scriptEditor');
            }}
          />
        </View>
      ) : screen === 'scriptEditor' && editingScript ? (
        <View style={[styles.callsScreen, {backgroundColor: '#E0F2FE'}]}>
          <StatusBar backgroundColor="#2d5dfb" barStyle="dark-content" />
          <ScriptEditorScreen
            script={editingScript}
            onTestScript={handleTestScript}
            onBack={() => {
              setEditingScript(null);
              setScreen('scripts');
            }}
          />
        </View>
      ) : screen === 'ollamaSettings' ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#1A237E" barStyle="light-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14, backgroundColor: '#283593'}]}>
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>🤖</Text>
            </View>
            <Text style={styles.callsTitle}>Настройки Ollama</Text>
          </View>
          <ScrollView
            style={{flex: 1}}
            contentContainerStyle={[styles.ollamaScrollContent, {paddingBottom: safeBottomInset + 14}]}
            refreshControl={
              <RefreshControl
                refreshing={ollamaStatusState === 'checking'}
                onRefresh={() => { void refreshOllamaStatus(); }}
                colors={['#283593']}
                tintColor="#283593"
              />
            }>
            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Статус подключения</Text>
              <View style={[
                styles.ollamaStatusBadge,
                ollamaStatusState === 'ok'
                  ? styles.ollamaStatusBadgeOk
                  : ollamaStatusState === 'error'
                    ? styles.ollamaStatusBadgeError
                    : ollamaStatusState === 'checking'
                      ? styles.ollamaStatusBadgeChecking
                      : styles.ollamaStatusBadgeIdle,
              ]}>
                <Text style={styles.ollamaStatusBadgeText}>
                  {ollamaStatusState === 'ok'
                    ? 'Подключено'
                    : ollamaStatusState === 'error'
                      ? 'Ошибка'
                      : ollamaStatusState === 'checking'
                        ? 'Проверка...'
                        : 'Не проверено'}
                </Text>
              </View>
              <Text style={styles.callsPageText}>Текущий адрес: {ollamaStatusTarget || 'не указан'}</Text>
              <Text style={styles.callsPageText}>Текущая модель: {ollamaModel || 'не указана'}</Text>
              <Text style={styles.ollamaStatusMessage}>{ollamaStatusMessage}</Text>
            </View>

            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Адрес сервера</Text>
              <Text style={styles.callsPageText}>
                Укажи IP-адрес и порт машины, на которой запущен Ollama.{'\n'}
                Пример: {OLLAMA_DEVICE_URL_PLACEHOLDER}
              </Text>
              <TextInput
                style={styles.ollamaInput}
                value={ollamaUrl}
                onChangeText={text => { setOllamaUrl(text); setOllamaSaved(false); }}
                placeholder={OLLAMA_DEVICE_URL_PLACEHOLDER}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Модель</Text>
              <Text style={styles.callsPageText}>
                Название модели, установленной в Ollama.{'\n'}
                Пример: qwen2.5:3b, llama3.2:3b, gemma3:4b
              </Text>
              <TextInput
                style={styles.ollamaInput}
                value={ollamaModel}
                onChangeText={text => { setOllamaModel(text); setOllamaSaved(false); }}
                placeholder="qwen2.5:3b"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Pressable
              style={({pressed}) => [styles.ollamaSaveButton, pressed && {opacity: 0.8}]}
              onPress={async () => {
                setOllamaConfig(ollamaUrl, ollamaModel);
                setOllamaSaved(true);
                await refreshOllamaStatus();
              }}
              android_ripple={{color: '#3949AB'}}>
              <Text style={styles.ollamaSaveButtonText}>
                {ollamaSaved ? '✓ Сохранено' : 'Сохранить'}
              </Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [styles.ollamaCheckButton, pressed && {opacity: 0.8}]}
              onPress={() => {
                void refreshOllamaStatus();
              }}
              android_ripple={{color: '#0F766E'}}>
              <Text style={styles.ollamaCheckButtonText}>Проверить соединение</Text>
            </Pressable>

            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Как открыть Ollama по Wi-Fi</Text>
              <Text style={styles.ollamaStepText}>1. Запусти сервер Ollama на компьютере и убедись, что он слушает внешний интерфейс.</Text>
              <Text style={styles.ollamaCommandText}>OLLAMA_HOST=0.0.0.0:11434 ollama serve</Text>
              <Text style={styles.ollamaStepText}>2. Узнай IP компьютера в той же Wi-Fi сети и впиши его выше.</Text>
              <Text style={styles.ollamaCommandText}>hostname -I</Text>
              <Text style={styles.ollamaStepText}>3. Если модели нет на сервере, загрузи её и снова нажми кнопку проверки.</Text>
              <Text style={styles.ollamaCommandText}>ollama pull {ollamaModel || DEFAULT_OLLAMA_MODEL}</Text>
            </View>
          </ScrollView>
        </View>
      ) : screen === 'voiceNotifications' ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#7C3AED" barStyle="light-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14, backgroundColor: '#7C3AED'}]}>
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>🔔</Text>
            </View>
            <Text style={styles.callsTitle}>Уведомления голосом</Text>
          </View>

          <ScrollView
            style={{flex: 1}}
            contentContainerStyle={[styles.ollamaScrollContent, {paddingBottom: safeBottomInset + 14}]}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {
                  void loadVoiceNotificationsSettings();
                }}
                colors={['#7C3AED']}
                tintColor="#7C3AED"
              />
            }>
            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Доступ к уведомлениям</Text>
              <Text style={styles.callsPageText}>
                Для озвучки уведомлений нужно разрешить доступ в системных настройках Android.
              </Text>
              <View style={styles.voiceNotifAccessRow}>
                <Text
                  style={[
                    styles.voiceNotifAccessBadge,
                    voiceNotificationAccessGranted ? styles.voiceNotifAccessGranted : styles.voiceNotifAccessDenied,
                  ]}>
                  {voiceNotificationAccessGranted ? 'Доступ выдан' : 'Доступ не выдан'}
                </Text>
                <Pressable
                  style={({pressed}) => [styles.callsSettingAction, pressed && styles.callsSettingActionPressed]}
                  onPress={async () => {
                    try {
                      await openVoiceNotificationAccessSettings();
                    } catch (e) {
                      setVoiceNotificationError(
                        e instanceof Error ? e.message : 'Не удалось открыть системные настройки.',
                      );
                    }
                  }}
                  android_ripple={{color: '#DDD6FE'}}>
                  <Text style={styles.callsSettingActionTitle}>Открыть системный доступ</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.callsPageCard}>
              <View style={styles.callsSettingRow}>
                <View style={styles.callsSettingTextBlock}>
                  <Text style={styles.callsSettingTitle}>Включить голосовые уведомления</Text>
                  <Text style={styles.callsSettingDesc}>Озвучивать входящие уведомления голосом.</Text>
                </View>
                <Switch
                  value={voiceNotificationsEnabled}
                  onValueChange={value => {
                    void toggleVoiceNotificationsEnabled(value);
                  }}
                  thumbColor={voiceNotificationsEnabled ? '#7C3AED' : '#f4f3f4'}
                  trackColor={{false: '#CBD5E1', true: '#C4B5FD'}}
                />
              </View>
            </View>

            <View style={styles.callsPageCard}>
              <Text style={styles.callsSettingsHeader}>Источник уведомлений</Text>
              <Pressable
                onPress={() => {
                  void toggleVoiceNotificationsMode('all');
                }}
                style={({pressed}) => [
                  styles.voiceNotifModeButton,
                  voiceNotificationsMode === 'all' && styles.voiceNotifModeButtonActive,
                  pressed && styles.callsSettingActionPressed,
                ]}
                android_ripple={{color: '#DDD6FE'}}>
                <Text
                  style={[
                    styles.voiceNotifModeText,
                    voiceNotificationsMode === 'all' && styles.voiceNotifModeTextActive,
                  ]}>
                  Все приложения
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void toggleVoiceNotificationsMode('selected');
                }}
                style={({pressed}) => [
                  styles.voiceNotifModeButton,
                  voiceNotificationsMode === 'selected' && styles.voiceNotifModeButtonActive,
                  pressed && styles.callsSettingActionPressed,
                ]}
                android_ripple={{color: '#DDD6FE'}}>
                <Text
                  style={[
                    styles.voiceNotifModeText,
                    voiceNotificationsMode === 'selected' && styles.voiceNotifModeTextActive,
                  ]}>
                  Только выбранные приложения
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setScreen('voiceNotificationApps')}
                style={({pressed}) => [styles.callsSettingAction, pressed && styles.callsSettingActionPressed]}
                android_ripple={{color: '#DDD6FE'}}>
                <Text style={styles.callsSettingActionTitle}>Выбрать приложения</Text>
                <Text style={styles.callsSettingActionDesc}>
                  Выбрано: {voiceNotificationSelectedPackages.length}
                </Text>
              </Pressable>
            </View>

            {voiceNotificationError ? (
              <View style={styles.callsPageCard}>
                <Text style={styles.voiceNotifErrorText}>{voiceNotificationError}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : screen === 'voiceNotificationApps' ? (
        <View style={styles.callsScreen}>
          <StatusBar backgroundColor="#7C3AED" barStyle="light-content" />
          <View style={[styles.callsHeader, {paddingTop: insets.top + 14, backgroundColor: '#7C3AED'}]}>
            <View style={styles.callsIconWrap}>
              <Text style={styles.callsIcon}>📱</Text>
            </View>
            <Text style={styles.callsTitle}>Выбор приложений</Text>
          </View>

          <ScrollView
            style={{flex: 1}}
            contentContainerStyle={[styles.ollamaScrollContent, {paddingBottom: safeBottomInset + 14}]}
            refreshControl={
              <RefreshControl
                refreshing={voiceNotificationLoadingApps}
                onRefresh={() => {
                  void loadVoiceNotificationApps(voiceNotificationIncludeSystem);
                }}
                colors={['#7C3AED']}
                tintColor="#7C3AED"
              />
            }>
            <View style={styles.callsPageCard}>
              <View style={styles.callsSettingRow}>
                <View style={styles.callsSettingTextBlock}>
                  <Text style={styles.callsSettingTitle}>Показывать системные приложения</Text>
                  <Text style={styles.callsSettingDesc}>Включить системные и предустановленные приложения.</Text>
                </View>
                <Switch
                  value={voiceNotificationIncludeSystem}
                  onValueChange={setVoiceNotificationIncludeSystem}
                  thumbColor={voiceNotificationIncludeSystem ? '#7C3AED' : '#f4f3f4'}
                  trackColor={{false: '#CBD5E1', true: '#C4B5FD'}}
                />
              </View>
            </View>

            {voiceNotificationApps.map(app => {
              const selected = voiceNotificationSelectedPackages.includes(app.packageName);
              return (
                <View key={app.packageName} style={styles.callsPageCard}>
                  <View style={styles.callsSettingRow}>
                    <View style={styles.callsSettingTextBlock}>
                      <Text style={styles.callsSettingTitle}>{app.label}</Text>
                      <Text style={styles.callsSettingDesc}>
                        {app.packageName} {app.isSystem ? '• системное' : '• установленное'}
                      </Text>
                    </View>
                    <Switch
                      value={selected}
                      onValueChange={value => {
                        void toggleVoiceNotificationPackage(app.packageName, value);
                      }}
                      thumbColor={selected ? '#7C3AED' : '#f4f3f4'}
                      trackColor={{false: '#CBD5E1', true: '#C4B5FD'}}
                    />
                  </View>
                </View>
              );
            })}

            {voiceNotificationApps.length === 0 && !voiceNotificationLoadingApps ? (
              <View style={styles.callsPageCard}>
                <Text style={styles.callsPageText}>Список приложений пуст.</Text>
              </View>
            ) : null}

            <Pressable
              style={({pressed}) => [styles.ollamaSaveButton, pressed && {opacity: 0.8}]}
              onPress={() => setScreen('voiceNotifications')}
              android_ripple={{color: '#5B21B6'}}>
              <Text style={styles.ollamaSaveButtonText}>Готово</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.assistantContainer, {paddingBottom: safeBottomInset}]}> 
          <AssistantScreen
            onCallByName={handleVoiceCallByName}
            onRedial={handleRedialPress}
            autoStart={autoStartAssistant}
            quickCommand={assistantQuickCommand}
            scriptTest={assistantScriptTest}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FDE047',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBC02D',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 5,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  appBarTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFF59D',
  },
  menuButtonPressed: {
    opacity: 0.8,
  },
  menuLine: {
    width: 18,
    height: 2,
    backgroundColor: '#111111',
    borderRadius: 2,
    marginVertical: 1.5,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#6B4F00',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  cardPressed: {
    transform: [{scale: 0.99}],
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  assistantContainer: {
    flex: 1,
    backgroundColor: '#2E7D32',
  },
  callsScreen: {
    flex: 1,
    backgroundColor: '#2E7D32',
  },
  callsHeader: {
    flexDirection: 'row',
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  callsIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#43A047',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  callsIcon: {
    fontSize: 28,
  },
  callsTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ECFDF3',
  },
  callsTabsBar: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  callsToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#1B5E20',
    borderRadius: 14,
    padding: 4,
  },
  callsToggleButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  callsToggleButtonActive: {
    backgroundColor: '#A5D6A7',
  },
  callsToggleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E8F5E9',
  },
  callsToggleTextActive: {
    color: '#1B5E20',
  },
  callsPageContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  ollamaScrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  callsSettingsScroll: {
    flex: 1,
  },
  callsSettingsContent: {
    paddingBottom: 8,
  },
  callsPageCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  callsSettingsHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  callsPageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  callsPageText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '600',
  },
  exampleAction: {
    borderWidth: 1,
    borderColor: '#CDE7D4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F3FFF6',
  },
  exampleActionPressed: {
    opacity: 0.85,
  },
  exampleActionMessage: {
    marginTop: 4,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
  callsSettingItem: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  callsSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callsSettingTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  callsSettingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  callsSettingDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  callsSettingAction: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  callsSettingActionPressed: {
    opacity: 0.85,
  },
  callsSettingActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  callsSettingActionDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  voiceNotifAccessRow: {
    gap: 10,
    marginTop: 6,
  },
  voiceNotifAccessBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  voiceNotifAccessGranted: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  voiceNotifAccessDenied: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  voiceNotifModeButton: {
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  voiceNotifModeButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  voiceNotifModeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  voiceNotifModeTextActive: {
    color: '#5B21B6',
  },
  voiceNotifErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#991B1B',
    fontWeight: '600',
  },
  assistantFab: {
    position: 'absolute',
    right: 20,
    bottom: 24, // overridden by inline style with insets
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F57F17',
    elevation: 8,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  assistantFabPressed: {
    transform: [{scale: 0.97}],
  },
  assistantFabIcon: {
    fontSize: 30,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '76%',
    maxWidth: 300,
    backgroundColor: '#ffffff',
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: {width: 2, height: 0},
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  drawerHeader: {
    backgroundColor: '#FDE047',
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0B22B',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  appIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FBC02D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appIconText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  drawerVersion: {
    fontSize: 13,
    color: '#5B4600',
  },
  drawerItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  drawerItemPressed: {
    backgroundColor: '#FDE68A',
  },
  drawerItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  drawerVersionIndicator: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E7D27D',
    backgroundColor: '#FFF7CC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  drawerVersionIndicatorLabel: {
    fontSize: 12,
    color: '#7A5800',
    marginBottom: 2,
    fontWeight: '600',
  },
  drawerVersionIndicatorValue: {
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '700',
  },
  ollamaInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  ollamaSaveButton: {
    marginTop: 16,
    backgroundColor: '#283593',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ollamaSaveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ollamaCheckButton: {
    marginTop: 12,
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ollamaCheckButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ollamaStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  ollamaStatusBadgeIdle: {
    backgroundColor: '#E5E7EB',
  },
  ollamaStatusBadgeChecking: {
    backgroundColor: '#DBEAFE',
  },
  ollamaStatusBadgeOk: {
    backgroundColor: '#DCFCE7',
  },
  ollamaStatusBadgeError: {
    backgroundColor: '#FEE2E2',
  },
  ollamaStatusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  ollamaStatusMessage: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginTop: 2,
  },
  ollamaStepText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 2,
  },
  ollamaCommandText: {
    fontSize: 14,
    color: '#1D4ED8',
    lineHeight: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  callsBackButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  callsBackText: {
    fontSize: 24,
    color: '#ECFDF3',
    fontWeight: '700',
  },
});
