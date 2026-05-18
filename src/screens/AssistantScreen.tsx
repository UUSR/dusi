import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  AppState,
  AppStateStatus,
  Animated,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getAssistantResponse, getScriptResponse, getVoiceIntent} from '../assistant/rules';
import {requestOllamaReply} from '../assistant/ollama';
import {ASSISTANT_SYSTEM_PROMPT, DialogueManager} from '../assistant/dialogueManager';
import {
  clearDialogueHistory,
  loadDialogueHistoryByAge,
  saveDialogueHistory,
} from '../assistant/dialogueStorage';
import {loadScripts} from '../scripts/storageService';
import {Script} from '../scripts/types';
import {openInstalledApp} from '../native/openApp';

let Voice: any = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const voiceModule = require('@react-native-voice/voice');
  Voice = voiceModule?.default ?? voiceModule;
} catch (error) {
  console.error('[Voice] module load failed', error);
}

let Tts: any = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ttsModule = require('react-native-tts');
  Tts = ttsModule?.default ?? ttsModule;
} catch (error) {
  console.error('[TTS] module load failed', error);
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking' | 'followup';

const DEFAULT_DIALOGUE_MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Нажмите, чтобы говорить',
  listening: 'Слушаю вас…',
  processing: 'Думаю…',
  speaking: 'Говорю…',
  followup: 'Жду продолжение диалога…',
};

const STATE_COLORS: Record<AssistantState, string> = {
  idle: '#F57F17',
  listening: '#D32F2F',
  processing: '#EF6C00',
  speaking: '#388E3C',
  followup: '#1976D2',
};

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

interface AssistantQuickCommand {
  text: string;
  token: number;
}

interface AssistantScriptTest {
  script: Script;
  token: number;
}

interface AssistantScreenProps {
  quickCommand?: AssistantQuickCommand | null;
  scriptTest?: AssistantScriptTest | null;
  onCallByName?: (name: string) => void;
  onRedial?: () => void;
  onOpenApp?: (appName: string) => void;
  onBack?: () => void;
  autoStart?: number;
  dialogueMemoryTtlMs?: number;
}

export default function AssistantScreen({
  quickCommand,
  scriptTest,
  onCallByName,
  onRedial,
  onOpenApp,
  onBack,
  autoStart,
  dialogueMemoryTtlMs,
}: AssistantScreenProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<AssistantState>('idle');
  const [recognizedText, setRecognizedText] = useState('');
  const [assistantReply, setAssistantReply] = useState(
    'Привет! Я Дуся. Нажмите кнопку микрофона и скажите команду.',
  );
  const [replyTime, setReplyTime] = useState(formatTime(new Date()));
  const [partialText, setPartialText] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingAutoStartTokenRef = useRef<number>(0);
  const isStartingListeningRef = useRef(false);
  const stateRef = useRef<AssistantState>('idle');
  const dialogueRef = useRef(new DialogueManager({historyLimit: 12, followUpWindowMs: 4000}));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      dialogueRef.current.dispose();
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const closeFollowUp = useCallback(() => {
    dialogueRef.current.clearFollowUpWindow();
    if (mountedRef.current) {
      setState('idle');
    }
  }, []);

  const effectiveDialogueTtlMs =
    typeof dialogueMemoryTtlMs === 'number' ? dialogueMemoryTtlMs : DEFAULT_DIALOGUE_MEMORY_TTL_MS;

  const persistDialogue = useCallback(async () => {
    if (effectiveDialogueTtlMs <= 0) {
      await clearDialogueHistory();
      return;
    }
    await saveDialogueHistory(dialogueRef.current.getHistory());
  }, [effectiveDialogueTtlMs]);

  const addUserMessage = useCallback((text: string) => {
    dialogueRef.current.addUserMessage(text);
    void persistDialogue();
  }, [persistDialogue]);

  const addAssistantMessage = useCallback((text: string) => {
    dialogueRef.current.addAssistantMessage(text);
    void persistDialogue();
  }, [persistDialogue]);

  const openFollowUp = useCallback(() => {
    dialogueRef.current.openFollowUpWindow(() => {
      if (mountedRef.current) {
        setState('idle');
      }
    });
    setState('followup');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreDialogue = async () => {
      if (effectiveDialogueTtlMs <= 0) {
        dialogueRef.current.reset();
        await clearDialogueHistory();
        return;
      }

      const history = await loadDialogueHistoryByAge(effectiveDialogueTtlMs);
      if (cancelled || !mountedRef.current || history.length === 0) {
        return;
      }

      dialogueRef.current.setHistory(history);
      const lastAssistant = [...history].reverse().find(item => item.role === 'assistant');
      if (lastAssistant) {
        setAssistantReply(lastAssistant.content);
        setReplyTime(formatTime(new Date()));
      }
    };

    void restoreDialogue();

    return () => {
      cancelled = true;
    };
  }, [effectiveDialogueTtlMs]);

  const hasVoiceApi =
    !!(NativeModules.Voice ?? NativeModules.RCTVoice) &&
    typeof Voice.start === 'function' &&
    typeof Voice.stop === 'function' &&
    typeof Voice.cancel === 'function' &&
    typeof Voice.isAvailable === 'function';

  const hasTtsApi =
    typeof Tts.speak === 'function' &&
    typeof Tts.stop === 'function';

  // ──────────────────────── TTS setup ────────────────────────
  useEffect(() => {
    if (!hasTtsApi) {
      return;
    }

    try {
      if (typeof Tts.setDefaultLanguage === 'function') {
        Tts.setDefaultLanguage('ru-RU');
      }
      if (typeof Tts.setDefaultRate === 'function') {
        Tts.setDefaultRate(0.5);
      }
      if (typeof Tts.setDefaultPitch === 'function') {
        Tts.setDefaultPitch(1.1);
      }
    } catch (e) {
      console.error('[TTS setup]', e);
    }

    const handleTtsFinish = () => {
      openFollowUp();
    };

    try {
      if (typeof Tts.addEventListener === 'function') {
        Tts.addEventListener('tts-finish', handleTtsFinish);
      }
    } catch (e) {
      console.error('[TTS addEventListener]', e);
    }

    return () => {
      try {
        if (typeof (Tts as any).removeEventListener === 'function') {
          (Tts as any).removeEventListener('tts-finish', handleTtsFinish);
        }
        if (typeof Tts.stop === 'function') {
          Promise.resolve(Tts.stop?.()).catch(() => {});
        }
        closeFollowUp();
      } catch (e) {
        console.error('[TTS cleanup]', e);
      }
    };
  }, [hasTtsApi, closeFollowUp, openFollowUp]);

  // ──────────────────────── Pulse animation ──────────────────
  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  // ──────────────────────── Voice setup ──────────────────────
  const attachVoiceHandlers = useCallback(() => {
    Voice.onSpeechResults = (e: any) => {
      const text = e.value?.[0] ?? '';
      if (text) {
        void handleUserSpeech(text);
      }
    };

    Voice.onSpeechPartialResults = (e: any) => {
      setPartialText(e.value?.[0] ?? '');
    };

    Voice.onSpeechError = (e: any) => {
      stopPulse();
      dialogueRef.current.clearFollowUpWindow();
      setState('idle');
      setPartialText('');

      const errorCode = e.error?.code ?? 'unknown';
      const errorMessage = e.error?.message ?? 'Неизвестная ошибка распознавания';
      const uiMessage = `Ошибка распознавания (${errorCode}): ${errorMessage}`;
      setVoiceError(uiMessage);
      setAssistantReply(uiMessage);
      setReplyTime(formatTime(new Date()));
    };

    Voice.onSpeechStart = () => {
      dialogueRef.current.clearFollowUpWindow();
      setVoiceError('');
      setState('listening');
    };

    Voice.onSpeechEnd = () => {
      stopPulse();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPulse]);

  useEffect(() => {
    if (!hasVoiceApi) {
      const message =
        'Модуль распознавания речи недоступен. Перезапустите приложение или переустановите сборку.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      return;
    }

    attachVoiceHandlers();

    return () => {
      if (typeof Voice.destroy === 'function' && typeof Voice.removeAllListeners === 'function') {
        Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
      }
    };
  }, [hasVoiceApi, attachVoiceHandlers]);

  // ──────────────────────── Permissions ──────────────────────
  async function requestMicPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Доступ к микрофону',
        message: 'Дусе нужен микрофон для распознавания речи.',
        buttonPositive: 'Разрешить',
        buttonNegative: 'Отмена',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  // ──────────────────────── Core logic ───────────────────────
  const startListening = useCallback(async () => {
    if (isStartingListeningRef.current) {
      return;
    }
    isStartingListeningRef.current = true;

    if (!hasVoiceApi) {
      const message = 'Распознавание речи сейчас недоступно.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      isStartingListeningRef.current = false;
      return;
    }

    const ok = await requestMicPermission();
    if (!ok) {
      const message = 'Микрофон не разрешен. Разрешите доступ в настройках приложения.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      isStartingListeningRef.current = false;
      return;
    }

    try {
      if (stateRef.current === 'listening') {
        try {
          await Voice.stop();
        } catch (_) {}
        try {
          await Voice.cancel();
        } catch (_) {}
      }

      const available = await Voice.isAvailable();
      if (!available) {
        const message =
          'Сервис распознавания речи недоступен на устройстве. Установите/включите Google Speech Services.';
        setVoiceError(message);
        setAssistantReply(message);
        setReplyTime(formatTime(new Date()));
        isStartingListeningRef.current = false;
        return;
      }

      const services = await Voice.getSpeechRecognitionServices();
      if (!services || services.length === 0) {
        // On Android 11+ package visibility can hide services from queries.
        // Do not hard-fail here: Voice.start can still work on some devices.
        console.warn('[Voice] getSpeechRecognitionServices returned empty list');
      }

      Vibration.vibrate(40);
      dialogueRef.current.clearFollowUpWindow();
      setVoiceError('');
      setPartialText('');
      setState('listening');
      startPulse();
      try {
        await Voice.destroy();
      } catch (_) {}
      attachVoiceHandlers();
      await Voice.start('ru-RU');
    } catch (e) {
      stopPulse();
      setState('idle');
      const message =
        e instanceof Error
          ? `Не удалось запустить распознавание: ${e.message}`
          : 'Не удалось запустить распознавание речи';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
    } finally {
      isStartingListeningRef.current = false;
    }
  }, [hasVoiceApi, startPulse, stopPulse, attachVoiceHandlers]);

  const stopListening = useCallback(async () => {
    try {
      if (typeof Voice.stop === 'function') {
        await Voice.stop();
      }
    } catch (_e) {}
    dialogueRef.current.clearFollowUpWindow();
    stopPulse();
    setState('idle');
  }, [stopPulse]);

  const runScriptActions = useCallback(async (script: Script) => {
    const activeActions = (script.actions || []).filter(action => action?.enabled !== false);
    let handled = false;
    let isSpeaking = false;

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
      const cleanText = text.trim();
      handled = true;
      isSpeaking = true;
      addAssistantMessage(cleanText);
      setAssistantReply(cleanText);
      setReplyTime(formatTime(new Date()));
      setState('speaking');
      setVoiceError('');

      try {
        if (typeof Tts.speak === 'function' && typeof Tts.stop === 'function') {
          Promise.resolve(Tts.stop?.()).catch(() => {});
          Tts.speak(cleanText);
        }
      } catch (err) {
        console.error('[TTS] Error:', err);
      }
    }

    const openAppActions = activeActions.filter(action => action.actionId === 'open_app');
    for (const openAppAction of openAppActions) {
      const packageName =
        typeof openAppAction.parameters?.packageName === 'string'
          ? openAppAction.parameters.packageName.trim()
          : '';

      if (!packageName) {
        continue;
      }

      const intentUrl = `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${packageName};end`;
      try {
        await openInstalledApp(packageName);
        handled = true;
        if (!isSpeaking) {
          setAssistantReply('Открываю приложение.');
          setReplyTime(formatTime(new Date()));
        }
      } catch (_e) {
        try {
          await Linking.openURL(intentUrl);
          handled = true;
          if (!isSpeaking) {
            setAssistantReply('Открываю приложение.');
            setReplyTime(formatTime(new Date()));
          }
        } catch (_fallbackError) {
          if (!isSpeaking) {
            setAssistantReply(`Не удалось открыть приложение ${packageName}.`);
            setReplyTime(formatTime(new Date()));
          }
        }
      }
    }

    const sendEmailActions = activeActions.filter(action => action.actionId === 'send_email');
    for (const sendEmailAction of sendEmailActions) {
      const params = sendEmailAction.parameters || {};
      const to =
        (typeof params.to === 'string' && params.to.trim()) ||
        (typeof params.email === 'string' && params.email.trim()) ||
        '';
      const subject = typeof params.subject === 'string' ? params.subject.trim() : '';
      const body = typeof params.body === 'string' ? params.body.trim() : '';

      const query: string[] = [];
      if (subject) {
        query.push(`subject=${encodeURIComponent(subject)}`);
      }
      if (body) {
        query.push(`body=${encodeURIComponent(body)}`);
      }

      const mailtoUrl = `mailto:${to}${query.length ? `?${query.join('&')}` : ''}`;

      try {
        await Linking.openURL(mailtoUrl);
        handled = true;
        if (!isSpeaking) {
          setAssistantReply(to ? `Открываю письмо для ${to}.` : 'Открываю создание письма.');
          setReplyTime(formatTime(new Date()));
        }
      } catch (_e) {
        if (!isSpeaking) {
          setAssistantReply('Не удалось открыть почтовое приложение.');
          setReplyTime(formatTime(new Date()));
        }
      }
    }

    if (!handled) {
      const fallbackText = `Скрипт ${script.name} выполнен. Голосовой ответ не найден.`;
      addAssistantMessage(fallbackText);
      setAssistantReply(fallbackText);
      setReplyTime(formatTime(new Date()));
      setState('idle');
      return false;
    }

    if (!isSpeaking) {
      setState('idle');
    }

    return true;
  }, [addAssistantMessage]);

  async function handleUserSpeech(text: string) {
    dialogueRef.current.clearFollowUpWindow();
    addUserMessage(text);

    setPartialText('');
    stopPulse();
    setState('processing');
    setRecognizedText(text);

    let response: string;
    try {
      await new Promise(resolve => setTimeout(resolve, 250));

      if (!mountedRef.current) { return; }

      const intent = getVoiceIntent(text);
      const scripts = await loadScripts();
      const scriptResponse = getScriptResponse(text, scripts);

      if (scriptResponse) {
        response = scriptResponse;
        setVoiceError('');
      } else if (intent?.type === 'call') {
        response = `Звоню ${intent.name}…`;
        onCallByName?.(intent.name);
      } else if (intent?.type === 'redial') {
        response = 'Перезваниваю…';
        onRedial?.();
      } else if (intent?.type === 'open_app') {
        response = `Открываю ${intent.appName}…`;
        onOpenApp?.(intent.appName);
      } else {
        const ollamaResult = await requestOllamaReply(text, {
          messages: dialogueRef.current.buildModelMessages(ASSISTANT_SYSTEM_PROMPT),
        });
        if (ollamaResult.ok && ollamaResult.text) {
          response = ollamaResult.text;
          setVoiceError('');
          console.log('[Ollama] Got reply:', ollamaResult.text.substring(0, 50));
        } else {
          response = ollamaResult.error ?? getAssistantResponse(text);
          setVoiceError(response);
          console.log('[Ollama] Request failed:', ollamaResult.error ?? 'unknown error');
        }
      }
    } catch (e) {
      response = getAssistantResponse(text);
      console.error('[handleUserSpeech] Error:', e instanceof Error ? e.message : String(e));
    }

    if (!mountedRef.current) { return; }

    addAssistantMessage(response);
    setAssistantReply(response);
    setReplyTime(formatTime(new Date()));

    if (dialogueRef.current.isStopDialogCommand(text)) {
      dialogueRef.current.reset();
      void clearDialogueHistory();
      setState('idle');
      return;
    }

    setState('speaking');
    let spoken = false;
    try {
      if (typeof Tts.speak === 'function' && typeof Tts.stop === 'function' && response) {
        Promise.resolve(Tts.stop?.()).catch(() => {});
        Tts.speak(String(response).trim());
        spoken = true;
      }
    } catch (err) {
      console.error('[TTS] Error:', err);
      openFollowUp();
    }

    if (!spoken) {
      openFollowUp();
    }
  }

  useEffect(() => {
    if (!quickCommand?.text) {
      return;
    }
    void handleUserSpeech(quickCommand.text);
    // handleUserSpeech is a function declaration and intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCommand?.token]);

  useEffect(() => {
    if (!scriptTest?.script) {
      return;
    }

    setRecognizedText(`Тест скрипта: ${scriptTest.script.name}`);
    setState('processing');
    void runScriptActions(scriptTest.script);
  }, [scriptTest?.token, runScriptActions]);

  // ──────────────────────── Auto-start voice recognition ────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active' && pendingAutoStartTokenRef.current > 0) {
        pendingAutoStartTokenRef.current = 0;
        setTimeout(() => {
          void startListening();
        }, 120);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [startListening]);

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    if (appStateRef.current !== 'active') {
      pendingAutoStartTokenRef.current = autoStart;
      return;
    }

    // Small delay to ensure listeners are attached
    const timer = setTimeout(() => {
      void startListening();
    }, 100);
    return () => clearTimeout(timer);
  }, [autoStart, startListening]);

  function handleMicPress() {
    if (state === 'listening') {
      void stopListening();
    } else if (state === 'idle' || state === 'followup') {
      void startListening();
    } else if (state === 'speaking') {
      if (typeof Tts.stop === 'function') {
        Promise.resolve(Tts.stop?.()).catch(() => {});
      }
      dialogueRef.current.clearFollowUpWindow();
      void startListening();
    }
  }

  // ──────────────────────── Render ───────────────────────────
  const micColor = STATE_COLORS[state];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />

      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[styles.backButton, {top: insets.top + 10}]}> 
          <Text style={styles.backButtonText}>← Скрипт</Text>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.content, {paddingTop: insets.top + 14}]}> 
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Распознанный ввод</Text>
          <Text style={styles.sectionBody}>
            {recognizedText || 'Текст появится после записи голоса'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ответ ассистента</Text>
          <Text style={styles.sectionBody}>{assistantReply}</Text>
          <Text style={styles.timeText}>{replyTime}</Text>
        </View>

        {partialText ? (
          <Text style={styles.partialText} numberOfLines={3}>
            {partialText}
          </Text>
        ) : (
          <Text style={styles.statusText}>{STATE_LABELS[state]}</Text>
        )}

        {voiceError ? (
          <Text style={styles.errorText} numberOfLines={3}>
            {voiceError}
          </Text>
        ) : null}
      </View>

      <View style={[styles.micWrapper, {bottom: insets.bottom + 20}]}>
        <Animated.View
          style={[
            styles.micPulse,
            {
              backgroundColor: micColor + '33',
              transform: [{scale: pulseAnim}],
            },
          ]}
        />
        <TouchableOpacity
          onPress={handleMicPress}
          style={[styles.micButton, {backgroundColor: micColor}]}
          activeOpacity={0.85}>
          <Text style={styles.micIcon}>
            {state === 'listening' ? '⏹' : state === 'speaking' ? '🔊' : state === 'followup' ? '⏱' : '🎙'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#66BB6A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 120,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#1B5E20',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 22,
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  statusText: {
    color: '#EAF8EC',
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  partialText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  errorText: {
    color: '#7F1D1D',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
  },
  micWrapper: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  micPulse: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#1B5E20',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.26,
    shadowRadius: 6,
  },
  micIcon: {
    fontSize: 32,
  },
});
