import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  BackHandler,
  Linking,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import AssistantScreen from './src/screens/AssistantScreen';
import Contacts from 'react-native-contacts';
import Tts from 'react-native-tts';
import {createCallDetector} from './src/native/callDetectionCompat';

const APP_VERSION: string = require('./package.json').version;

type Screen = 'home' | 'assistant' | 'calls';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [callsTab, setCallsTab] = useState<'settings' | 'examples'>('settings');
  const [exampleActionMessage, setExampleActionMessage] = useState('');
  const [notifyOnCall, setNotifyOnCall] = useState(true);
  const notifyOnCallRef = useRef(notifyOnCall);
  const lastIncomingNumberRef = useRef('');
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 16);

  const respondWithAssistantVoice = (message: string) => {
    setExampleActionMessage(message);

    try {
      if (typeof Tts.setDefaultLanguage === 'function') {
        Tts.setDefaultLanguage('ru-RU');
      }
      if (typeof Tts.stop === 'function') {
        Tts.stop();
      }
      if (typeof Tts.speak === 'function') {
        Tts.speak(message);
      }
    } catch (_) {}
  };

  const dialPhoneNumber = async (rawPhoneNumber: string, okMessage: string) => {
    const phoneNumber = rawPhoneNumber.replace(/[^+\d]/g, '');
    if (!phoneNumber) {
      respondWithAssistantVoice('Не удалось определить номер телефона.');
      return;
    }

    const url = `tel:${phoneNumber}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      respondWithAssistantVoice('Не удалось открыть набор номера на устройстве.');
      return;
    }

    await Linking.openURL(url);
    respondWithAssistantVoice(okMessage);
  };

  const handleCallMomPress = async () => {
    try {
      if (typeof Contacts.getAll !== 'function') {
        respondWithAssistantVoice('Контакты недоступны на этом устройстве.');
        return;
      }

      const contacts = await Contacts.getAll();
      const mom = contacts.find(c => {
        const fullName = [c.givenName, c.middleName, c.familyName].join(' ').toLowerCase();
        return /мам|мама|mom|mother/i.test(fullName);
      });

      const momPhone = mom?.phoneNumbers?.[0]?.number ?? '';
      if (!momPhone) {
        respondWithAssistantVoice('Контакт «Мама» не найден или без номера.');
        return;
      }

      await dialPhoneNumber(momPhone, 'Звоню маме...');
    } catch (_e) {
      respondWithAssistantVoice('Не удалось выполнить команду «Позвони маме».');
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
        const contactsGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Разрешение на чтение контактов',
            message: 'Нужно чтобы назвать имя звонящего',
            buttonPositive: 'Разрешить',
          },
        );

        if (
          phoneGranted !== PermissionsAndroid.RESULTS.GRANTED ||
          contactsGranted !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          return;
        }

        callDetector = createCallDetector(
          async (event: string, phoneNumber: string) => {
            if (event !== 'Incoming') return;
            if (!notifyOnCallRef.current) return;

            if (phoneNumber) {
              lastIncomingNumberRef.current = phoneNumber;
            }

            let callerName = phoneNumber;
            try {
              if (typeof Contacts.getContactsByPhoneNumber === 'function') {
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
            if (typeof Tts.speak === 'function') {
              Tts.speak(`Звонок от ${callerName}`);
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
      if (screen !== 'home') {
        setScreen('home');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [screen]);

  const cards = useMemo<FeatureCard[]>(
    () => [
      {
        id: 'calls',
        title: 'Звонки',
        subtitle: 'ЗВОНИТЕ КОНТАКТАМ И НА ПРОИЗВОЛЬНЫЕ НОМЕРА ТЕЛЕФОНОВ',
        icon: '📞',
        action: () => setScreen('calls'),
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
            onPress={() => setScreen('assistant')}
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
                  <Text style={styles.drawerVersion}>Версия {APP_VERSION}</Text>
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
              <View style={styles.callsPageCard}>
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
              </View>
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
      ) : (
        <View style={[styles.assistantContainer, {paddingBottom: safeBottomInset}]}> 
          <AssistantScreen />
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
  callsPageCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    gap: 8,
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
    backgroundColor: '#FFFDE7',
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: {width: 2, height: 0},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    paddingHorizontal: 14,
  },
  drawerHeader: {
    backgroundColor: '#FBC02D',
    paddingTop: 8,
    paddingBottom: 18,
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
});
