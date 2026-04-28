import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  Animated,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  StatusBar,
} from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getAssistantResponse} from '../assistant/rules';

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Нажмите, чтобы говорить',
  listening: 'Слушаю вас…',
  processing: 'Думаю…',
  speaking: 'Говорю…',
};

const STATE_COLORS: Record<AssistantState, string> = {
  idle: '#F57F17',
  listening: '#D32F2F',
  processing: '#EF6C00',
  speaking: '#388E3C',
};

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

interface AssistantQuickCommand {
  text: string;
  token: number;
}

interface AssistantScreenProps {
  quickCommand?: AssistantQuickCommand | null;
}

export default function AssistantScreen({quickCommand}: AssistantScreenProps) {
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

  const hasVoiceApi =
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

    if (typeof Tts.setDefaultLanguage === 'function') {
      Tts.setDefaultLanguage('ru-RU');
    }
    if (typeof Tts.setDefaultRate === 'function') {
      Tts.setDefaultRate(0.5);
    }
    if (typeof Tts.setDefaultPitch === 'function') {
      Tts.setDefaultPitch(1.1);
    }

    const finishSub =
      typeof Tts.addEventListener === 'function'
        ? Tts.addEventListener('tts-finish', () => {
            setState('idle');
          })
        : null;

    return () => {
      finishSub?.remove?.();
      if (typeof Tts.stop === 'function') {
        Tts.stop();
      }
    };
  }, [hasTtsApi]);

  // ──────────────────────── Voice setup ──────────────────────
  useEffect(() => {
    if (!hasVoiceApi) {
      const message =
        'Модуль распознавания речи недоступен. Перезапустите приложение или переустановите сборку.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      return;
    }

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? '';
      if (text) {
        handleUserSpeech(text);
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      setPartialText(e.value?.[0] ?? '');
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      stopPulse();
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
      setVoiceError('');
      setState('listening');
    };

    Voice.onSpeechEnd = () => {
      stopPulse();
    };

    return () => {
      if (typeof Voice.destroy === 'function' && typeof Voice.removeAllListeners === 'function') {
        Voice.destroy().then(() => Voice.removeAllListeners());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVoiceApi]);

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
  async function startListening() {
    if (!hasVoiceApi) {
      const message = 'Распознавание речи сейчас недоступно.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      return;
    }

    const ok = await requestMicPermission();
    if (!ok) {
      const message = 'Микрофон не разрешен. Разрешите доступ в настройках приложения.';
      setVoiceError(message);
      setAssistantReply(message);
      setReplyTime(formatTime(new Date()));
      return;
    }

    try {
      const available = await Voice.isAvailable();
      if (!available) {
        const message =
          'Сервис распознавания речи недоступен на устройстве. Установите/включите Google Speech Services.';
        setVoiceError(message);
        setAssistantReply(message);
        setReplyTime(formatTime(new Date()));
        return;
      }

      const services = await Voice.getSpeechRecognitionServices();
      if (!services || services.length === 0) {
        const message =
          'Служба распознавания речи не найдена. Проверьте Google app / Speech Services.';
        setVoiceError(message);
        setAssistantReply(message);
        setReplyTime(formatTime(new Date()));
        return;
      }

      Vibration.vibrate(40);
      setVoiceError('');
      setPartialText('');
      setState('listening');
      startPulse();
      if (typeof Voice.cancel === 'function') {
        await Voice.cancel();
      }
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
    }
  }

  async function stopListening() {
    try {
      if (typeof Voice.stop === 'function') {
        await Voice.stop();
      }
    } catch (_e) {}
    stopPulse();
    setState('idle');
  }

  function handleUserSpeech(text: string) {
    setPartialText('');
    stopPulse();
    setState('processing');
    setRecognizedText(text);

    setTimeout(() => {
      const response = getAssistantResponse(text);
      setAssistantReply(response);
      setReplyTime(formatTime(new Date()));
      setState('speaking');
      if (typeof Tts.speak === 'function') {
        Tts.speak(response);
      }
    }, 300);
  }

  useEffect(() => {
    if (!quickCommand?.text) {
      return;
    }
    handleUserSpeech(quickCommand.text);
    // handleUserSpeech is a function declaration and intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCommand?.token]);

  function handleMicPress() {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    } else if (state === 'speaking') {
      if (typeof Tts.stop === 'function') {
        Tts.stop();
      }
      setState('idle');
    }
  }

  // ──────────────────────── Render ───────────────────────────
  const micColor = STATE_COLORS[state];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />

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
            {state === 'listening' ? '⏹' : state === 'speaking' ? '🔊' : '🎙'}
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
