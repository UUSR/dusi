import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Script, ScriptEvent, ScriptAction} from '../scripts/types';
import {saveScript} from '../scripts/storageService';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {FileSystem} from 'react-native-file-access';
import {ANDROID_EVENTS, getEventsByCategory, AndroidEvent} from '../scripts/androidEvents';
import {ANDROID_ACTIONS, getActionsByCategory, AndroidAction} from '../scripts/androidActions';

interface ScriptEditorScreenProps {
  script: Script;
  onBack?: () => void;
  onTestScript?: (scriptToTest: Script) => void;
  onSubmit?: () => void;
}

type TabType = 'events' | 'actions';
type EditorTarget =
  | {kind: 'event'; index: number}
  | {kind: 'action'; index: number};

export default function ScriptEditorScreen({script, onBack, onTestScript, onSubmit}: ScriptEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 16);

  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [currentScript, setCurrentScript] = useState<Script>(script);
  const [isSaving, setIsSaving] = useState(false);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [showActionSelector, setShowActionSelector] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);
  const [selectedEventCategory, setSelectedEventCategory] = useState<string>('');
  const [selectedActionCategory, setSelectedActionCategory] = useState<string>('');

  useEffect(() => {
    // Установить первую категорию при открытии
    const eventCategories = Object.keys(getEventsByCategory());
    if (eventCategories.length > 0) {
      setSelectedEventCategory(eventCategories[0]);
    }

    const actionCategories = Object.keys(getActionsByCategory());
    if (actionCategories.length > 0) {
      setSelectedActionCategory(actionCategories[0]);
    }
  }, []);

  const getSanitizedScript = (): Script => ({
    ...currentScript,
    events: currentScript.events.map(event => {
      const conditions = event.conditions || {};

      if (isPhraseEvent(event.eventId)) {
        return {
          ...event,
          enabled: event.enabled !== false,
          conditions: {
            ...conditions,
            triggerPhrase: typeof conditions.triggerPhrase === 'string' ? conditions.triggerPhrase.trim() : '',
          },
        };
      }

      if (!Object.prototype.hasOwnProperty.call(conditions, 'triggerPhrase')) {
        return event;
      }

      const {triggerPhrase, ...rest} = conditions;
      return {
        ...event,
        enabled: event.enabled !== false,
        conditions: rest,
      };
    }),
    actions: currentScript.actions.map(action => {
      const params = action.parameters || {};

      if (action.actionId === 'speak_text') {
        const normalizedText =
          typeof params.text === 'string' && params.text.trim()
            ? params.text.trim()
            : '';
        return {
          ...action,
          enabled: action.enabled !== false,
          parameters: {
            ...params,
            text: normalizedText,
          },
        };
      }

      if (action.actionId === 'reply_to_phrase' || action.actionId === 'reply_voice') {
        const normalizedReplyText =
          typeof params.replyText === 'string' && params.replyText.trim()
            ? params.replyText.trim()
            : '';
        return {
          ...action,
          enabled: action.enabled !== false,
          parameters: {
            ...params,
            replyText: normalizedReplyText,
          },
        };
      }

      if (action.actionId === 'open_app') {
        const normalizedPackageName =
          typeof params.packageName === 'string' && params.packageName.trim()
            ? params.packageName.trim()
            : '';
        return {
          ...action,
          enabled: action.enabled !== false,
          parameters: {
            ...params,
            packageName: normalizedPackageName,
          },
        };
      }

      if (
        !Object.prototype.hasOwnProperty.call(params, 'triggerPhrase') &&
        !Object.prototype.hasOwnProperty.call(params, 'replyText') &&
        !Object.prototype.hasOwnProperty.call(params, 'text')
      ) {
        return action;
      }

      const {triggerPhrase, replyText, text, ...rest} = params;
      return {
        ...action,
        enabled: action.enabled !== false,
        parameters: rest,
      };
    }),
  });

  const getValidationMessage = (sanitizedScript: Script): string | null => {
    const invalidReplyAction = sanitizedScript.actions.find(
      action =>
        action.enabled !== false &&
        (action.actionId === 'reply_to_phrase' || action.actionId === 'reply_voice') &&
        !(typeof action.parameters?.replyText === 'string' && action.parameters.replyText.trim()),
    );

    if (invalidReplyAction) {
      return 'Для действия «Ответить голосом» заполните поле «Что должен ответить ассистент».';
    }

    const invalidSpeakAction = sanitizedScript.actions.find(
      action =>
        action.enabled !== false &&
        action.actionId === 'speak_text' &&
        !(typeof action.parameters?.text === 'string' && action.parameters.text.trim()),
    );

    if (invalidSpeakAction) {
      return 'Для действия «Произнести текст» заполните поле «Какой текст произнести».';
    }

    return null;
  };

  const handleExportScript = async () => {
    try {
      const sanitizedScript = getSanitizedScript();
      const fileName = `script_${sanitizedScript.id}.json`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const json = JSON.stringify(sanitizedScript, null, 2);

      await RNFS.writeFile(filePath, json, 'utf8');
      await Share.open({
        title: 'Экспорт скрипта',
        url: `file://${filePath}`,
        type: 'application/json',
        filename: fileName,
        failOnCancel: false,
      });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось экспортировать скрипт');
    }
  };

  const handleSaveScript = async () => {
    try {
      setIsSaving(true);
      const sanitizedScript = getSanitizedScript();
      const validationMessage = getValidationMessage(sanitizedScript);

      if (validationMessage) {
        Alert.alert('Проверьте скрипт', validationMessage);
        return;
      }

      await saveScript(sanitizedScript);
      setCurrentScript(sanitizedScript);
      Alert.alert('Успех', 'Скрипт сохранён');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить скрипт');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestScript = async () => {
    try {
      setIsSaving(true);
      const sanitizedScript = getSanitizedScript();
      const validationMessage = getValidationMessage(sanitizedScript);

      if (validationMessage) {
        Alert.alert('Проверьте скрипт', validationMessage);
        return;
      }

      await saveScript(sanitizedScript);
      setCurrentScript(sanitizedScript);
      onTestScript?.(sanitizedScript);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось запустить тест скрипта');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEvent = (event: AndroidEvent) => {
    const newEvent: ScriptEvent = {
      eventId: event.id,
      eventName: event.name,
      enabled: true,
      conditions: {},
    };

    setCurrentScript({
      ...currentScript,
      events: [...currentScript.events, newEvent],
    });

    setShowEventSelector(false);
  };

  const handleRemoveEvent = (index: number) => {
    setCurrentScript({
      ...currentScript,
      events: currentScript.events.filter((_, i) => i !== index),
    });
  };

  const isPhraseEvent = (eventId: string) =>
    [
      'phrase_heard',
      'wake_word_detected',
      'assistant_command_received',
    ].includes(eventId);

  const getEventPhraseValue = (event: ScriptEvent) => {
    const raw = event.conditions?.triggerPhrase;
    return typeof raw === 'string' ? raw : '';
  };

  const updateEventPhrase = (index: number, phrase: string) => {
    setCurrentScript(prev => ({
      ...prev,
      events: prev.events.map((event, eventIndex) =>
        eventIndex === index
          ? {
              ...event,
              conditions: {
                ...(event.conditions || {}),
                triggerPhrase: phrase,
              },
            }
          : event,
      ),
    }));
  };

  const handleAddAction = (action: AndroidAction) => {
    const newAction: ScriptAction = {
      actionId: action.id,
      actionName: action.name,
      enabled: true,
      parameters: {},
      delay: 0,
    };

    setCurrentScript({
      ...currentScript,
      actions: [...currentScript.actions, newAction],
    });

    setShowActionSelector(false);
  };

  const handleRemoveAction = (index: number) => {
    setCurrentScript({
      ...currentScript,
      actions: currentScript.actions.filter((_, i) => i !== index),
    });
  };

  const isPhraseAction = (actionId: string) =>
    [
      'listen_phrase',
      'stop_listen_phrase',
      'reply_to_phrase',
      'reply_voice',
      'speak_text',
      'run_script_by_phrase',
      'open_app',
    ].includes(actionId);

  const getPhraseValue = (action: ScriptAction) => {
    if (action.actionId === 'speak_text') {
      const raw = action.parameters?.text;
      return typeof raw === 'string' ? raw : '';
    }
    if (action.actionId === 'open_app') {
      const raw = action.parameters?.packageName;
      return typeof raw === 'string' ? raw : '';
    }
    const raw = action.parameters?.replyText ?? action.parameters?.triggerPhrase;
    return typeof raw === 'string' ? raw : '';
  };

  const updateActionPhrase = (index: number, value: string) => {
    const action = currentScript.actions[index];
    if (!action) return;

    setCurrentScript(prev => ({
      ...prev,
      actions: prev.actions.map((act, actionIndex) =>
        actionIndex === index
          ? {
              ...act,
              parameters: {
                ...(act.parameters || {}),
                ...(act.actionId === 'speak_text'
                ? {text: value}
                : act.actionId === 'open_app'
                ? {packageName: value}
                : {replyText: value}),
              },
            }
          : act,
      ),
    }));
  };

  const closeUnifiedEditor = () => {
    setEditorTarget(null);
  };

  const getEditorTitle = () => {
    if (!editorTarget) {
      return '';
    }

    if (editorTarget.kind === 'event') {
      return currentScript.events[editorTarget.index]?.eventName || '';
    }

    return currentScript.actions[editorTarget.index]?.actionName || '';
  };

  const getEditorId = () => {
    if (!editorTarget) {
      return '';
    }

    if (editorTarget.kind === 'event') {
      return currentScript.events[editorTarget.index]?.eventId || '';
    }

    return currentScript.actions[editorTarget.index]?.actionId || '';
  };

  const isEditorPhraseType = () => {
    if (!editorTarget) {
      return false;
    }

    if (editorTarget.kind === 'event') {
      const event = currentScript.events[editorTarget.index];
      return !!event && isPhraseEvent(event.eventId);
    }

    const action = currentScript.actions[editorTarget.index];
    return !!action && isPhraseAction(action.actionId);
  };

  const getEditorPhraseLabel = () => {
    if (!editorTarget) {
      return 'Фраза';
    }
    if (editorTarget.kind === 'event') {
      return 'Что должен сказать пользователь';
    }
    const action = currentScript.actions[editorTarget.index];
    if (action?.actionId === 'speak_text') return 'Какой текст произнести';
    if (action?.actionId === 'open_app') return 'Название пакета приложения';
    return 'Что должен ответить ассистент';
  };

  const getEditorPhrasePlaceholder = () => {
    if (!editorTarget) {
      return '';
    }
    if (editorTarget.kind === 'event') {
      return 'Введите фразу-триггер';
    }
    const action = currentScript.actions[editorTarget.index];
    if (action?.actionId === 'speak_text') return 'Введите текст для озвучивания';
    if (action?.actionId === 'open_app') return 'например: com.whatsapp';
    return 'Введите текст ответа ассистента';
  };

  const getEditorPhraseValue = () => {
    if (!editorTarget) {
      return '';
    }

    if (editorTarget.kind === 'event') {
      const event = currentScript.events[editorTarget.index];
  const handleImportScript = async () => {
    try {
      let filePath = '';
      if (Platform.OS === 'android') {
        // Открыть стандартный file picker через Intent
        const res = await FileSystem.pick({types: ['application/json', 'text/plain', '*/*']});
        if (!res || !res.uri) {
          Alert.alert('Ошибка', 'Файл не выбран');
          return;
        }
        filePath = res.uri.replace('file://', '');
      } else if (Platform.OS === 'ios') {
        // UIDocumentPicker
        const res = await FileSystem.pick({types: ['public.json', 'public.text', 'public.data']});
        if (!res || !res.uri) {
          Alert.alert('Ошибка', 'Файл не выбран');
          return;
        }
        filePath = res.uri.replace('file://', '');
      } else {
        Alert.alert('Ошибка', 'Импорт поддерживается только на Android и iOS');
        return;
      }
      const fileContent = await FileSystem.readFile(filePath);
      if (!fileContent) {
        Alert.alert('Ошибка', 'Файл пустой или не удалось прочитать');
        return;
      }
      let imported: any = null;
      try {
        imported = JSON.parse(fileContent);
      } catch (e) {
        Alert.alert('Ошибка', 'Некорректный JSON');
        return;
      }
      if (!imported || typeof imported !== 'object' || !imported.name) {
        Alert.alert('Ошибка', 'В файле нет корректного скрипта');
        return;
      }
      await saveScript(imported);
      setCurrentScript(imported);
      Alert.alert('Успех', 'Скрипт импортирован!');
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message || 'Не удалось импортировать скрипт');
    }
  };
      return event ? getEventPhraseValue(event) : '';
    }

    const action = currentScript.actions[editorTarget.index];
    return action ? getPhraseValue(action) : '';
  };

  const updateEditorPhraseValue = (value: string) => {
    if (!editorTarget) {
      return;
    }

    if (editorTarget.kind === 'event') {
      updateEventPhrase(editorTarget.index, value);
      return;
    }

    updateActionPhrase(editorTarget.index, value);
  };

  const isEditorEnabled = () => {
    if (!editorTarget) {
      return true;
    }

    if (editorTarget.kind === 'event') {
      const event = currentScript.events[editorTarget.index];
      return event?.enabled !== false;
    }

    const action = currentScript.actions[editorTarget.index];
    return action?.enabled !== false;
  };

  const setEditorEnabled = (value: boolean) => {
    if (!editorTarget) {
      return;
    }

    if (editorTarget.kind === 'event') {
        <Pressable
          onPress={handleImportScript}
          style={({pressed}) => [styles.importButton, pressed && styles.exportButtonPressed]}
          android_ripple={{color: '#DCFCE7'}}>
          <Text style={styles.importButtonText}>⇧ Импорт</Text>
        </Pressable>
      setCurrentScript(prev => ({
        ...prev,
        events: prev.events.map((event, index) =>
          index === editorTarget.index
            ? {
                ...event,
                enabled: value,
              }
            : event,
        ),
      }));
      return;
    }

    setCurrentScript(prev => ({
      ...prev,
  importButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    marginLeft: 8,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
      actions: prev.actions.map((action, index) =>
        index === editorTarget.index
          ? {
              ...action,
              enabled: value,
            }
          : action,
      ),
    }));
  };

  const removeCurrentEditorTarget = () => {
    if (!editorTarget) {
      return;
    }

    const title = getEditorTitle() || 'элемент';
    Alert.alert('Удалить элемент?', `Будет удален: ${title}`, [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          if (editorTarget.kind === 'event') {
            handleRemoveEvent(editorTarget.index);
          } else {
            handleRemoveAction(editorTarget.index);
          }
          closeUnifiedEditor();
        },
      },
    ]);
  };

  const setAllEnabledForActiveTab = (value: boolean) => {
    if (activeTab === 'events') {
      setCurrentScript(prev => ({
        ...prev,
        events: prev.events.map(event => ({
          ...event,
          enabled: value,
        })),
      }));
      return;
    }

    setCurrentScript(prev => ({
      ...prev,
      actions: prev.actions.map(action => ({
        ...action,
        enabled: value,
      })),
    }));
  };

  const eventsByCategory = getEventsByCategory();
  const actionsByCategory = getActionsByCategory();
  const eventCategories = Object.keys(eventsByCategory);
  const actionCategories = Object.keys(actionsByCategory);
  const visibleEvents = currentScript.events
    .map((event, index) => ({event, index}))
    .filter(item => !showOnlyEnabled || item.event.enabled !== false);
  const visibleActions = currentScript.actions
    .map((action, index) => ({action, index}))
    .filter(item => !showOnlyEnabled || item.action.enabled !== false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 14, flexDirection: 'row', alignItems: 'center'}]}>
        <Pressable
          onPress={onBack}
          style={({pressed}) => [styles.backButton, pressed && styles.backButtonPressed]}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <View style={[styles.headerContent, {flex: 1}]}> 
          <Text style={styles.headerTitle}>{currentScript.name}</Text>
        </View>
        <Pressable
          onPress={handleExportScript}
          style={({pressed}) => [styles.exportButton, pressed && styles.exportButtonPressed]}
          android_ripple={{color: '#E0E7FF'}}>
          <Text style={styles.exportButtonText}>⇩ Экспорт</Text>
        </Pressable>
        <Pressable
          onPress={handleSaveScript}
          disabled={isSaving}
          style={({pressed}) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}>
          <Text style={styles.saveButtonText}>{isSaving ? '...сохр.' : '✓ Сохр.'}</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsBar}>
        <Pressable
          onPress={() => setActiveTab('events')}
          style={[
            styles.tab,
            activeTab === 'events' && styles.tabActive,
          ]}>
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            События ({showOnlyEnabled ? visibleEvents.length : currentScript.events.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('actions')}
          style={[
            styles.tab,
            activeTab === 'actions' && styles.tabActive,
          ]}>
          <Text style={[styles.tabText, activeTab === 'actions' && styles.tabTextActive]}>
            Действия ({showOnlyEnabled ? visibleActions.length : currentScript.actions.length})
          </Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Показывать только включенные</Text>
        <Switch
          value={showOnlyEnabled}
          onValueChange={setShowOnlyEnabled}
          thumbColor={showOnlyEnabled ? '#FBC02D' : '#f4f3f4'}
          trackColor={{false: '#CBD5E1', true: '#FDE68A'}}
        />
      </View>
      <View style={styles.bulkRow}>
        <Pressable
          onPress={() => setAllEnabledForActiveTab(true)}
          style={({pressed}) => [styles.bulkButton, styles.bulkButtonEnable, pressed && styles.bulkButtonPressed]}
          android_ripple={{color: '#D1FAE5'}}>
          <Text style={styles.bulkButtonEnableText}>Включить все</Text>
        </Pressable>
        <Pressable
          onPress={() => setAllEnabledForActiveTab(false)}
          style={({pressed}) => [styles.bulkButton, styles.bulkButtonDisable, pressed && styles.bulkButtonPressed]}
          android_ripple={{color: '#FECACA'}}>
          <Text style={styles.bulkButtonDisableText}>Выключить все</Text>
        </Pressable>
      </View>

      <View style={styles.testRow}>
        <Pressable
          onPress={() => { void handleTestScript(); }}
          disabled={isSaving}
          style={({pressed}) => [
            styles.testButton,
            pressed && styles.bulkButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}
          android_ripple={{color: '#BFDBFE'}}>
          <Text style={styles.testButtonText}>▶ Тест скрипта</Text>
        </Pressable>

        <Pressable
          onPress={onSubmit}
          disabled={isSaving}
          style={({pressed}) => [
            styles.submitButton,
            pressed && styles.bulkButtonPressed,
            isSaving && styles.saveButtonDisabled,
          ]}
          android_ripple={{color: '#DBEAFE'}}>
          <Text style={styles.submitButtonText}>📤 Отправить</Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: safeBottomInset + 20},
        ]}>
        
        {activeTab === 'events' ? (
          <View>
            {/* Add Event Button */}
            <Pressable
              onPress={() => setShowEventSelector(true)}
              style={({pressed}) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
              android_ripple={{color: '#FDE68A'}}>
              <Text style={styles.addButtonIcon}>+ Добавить событие</Text>
            </Pressable>

            {/* Events List */}
            {visibleEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {showOnlyEnabled ? 'Нет включенных событий' : 'Событий не добавлено'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {showOnlyEnabled
                    ? 'Отключите фильтр, чтобы увидеть все события.'
                    : 'События — это триггеры, которые запускают скрипт'}
                </Text>
              </View>
            ) : (
              <View>
                {visibleEvents.map(item => (
                  <View key={`event-${item.index}`} style={styles.itemCard}>
                    <Pressable
                      style={({pressed}) => [styles.itemContentPressable, pressed && styles.itemContentPressed]}
                      onPress={() => setEditorTarget({kind: 'event', index: item.index})}
                      android_ripple={{color: '#FDE68A'}}>
                      <Text style={styles.itemTitle}>{item.event.eventName}</Text>
                      <Text style={styles.itemSubtitle}>{item.event.eventId}</Text>
                      <Text style={styles.itemStatus}>{item.event.enabled !== false ? 'Статус: Включено' : 'Статус: Выключено'}</Text>
                      <Text style={styles.itemHint}>Нажмите для редактирования</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
            {/* Add Action Button */}
            <Pressable
              onPress={() => setShowActionSelector(true)}
              style={({pressed}) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
              android_ripple={{color: '#FDE68A'}}>
              <Text style={styles.addButtonIcon}>+ Добавить действие</Text>
            </Pressable>

            {/* Actions List */}
            {visibleActions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {showOnlyEnabled ? 'Нет включенных действий' : 'Действий не добавлено'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {showOnlyEnabled
                    ? 'Отключите фильтр, чтобы увидеть все действия.'
                    : 'Действия — это операции, которые выполняются при срабатывании события'}
                </Text>
              </View>
            ) : (
              <View>
                {visibleActions.map(item => (
                  <View key={`action-${item.index}`} style={styles.itemCard}>
                    <Pressable
                      style={({pressed}) => [styles.itemContentPressable, pressed && styles.itemContentPressed]}
                      onPress={() => setEditorTarget({kind: 'action', index: item.index})}
                      android_ripple={{color: '#FDE68A'}}>
                      <Text style={styles.itemTitle}>{item.action.actionName}</Text>
                      <Text style={styles.itemSubtitle}>{item.action.actionId}</Text>
                      <Text style={styles.itemStatus}>{item.action.enabled !== false ? 'Статус: Включено' : 'Статус: Выключено'}</Text>
                      <Text style={styles.itemHint}>Нажмите для редактирования</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Unified Script Item Editor */}
      <Modal
        visible={editorTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeUnifiedEditor}>
        <View style={styles.unifiedEditorWrap}>
          <Pressable style={styles.unifiedEditorBackdrop} onPress={closeUnifiedEditor} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'android' ? 'padding' : 'height'}
            style={styles.unifiedEditorCard}>
            <Text style={styles.unifiedEditorTitle}>Единый редактор</Text>
            <Text style={styles.unifiedEditorName}>{getEditorTitle()}</Text>
            <Text style={styles.unifiedEditorMeta}>{getEditorId()}</Text>

            <View style={styles.enabledRow}>
              <Text style={styles.enabledLabel}>Включено</Text>
              <Switch
                value={isEditorEnabled()}
                onValueChange={setEditorEnabled}
                thumbColor={isEditorEnabled() ? '#FBC02D' : '#f4f3f4'}
                trackColor={{false: '#CBD5E1', true: '#FDE68A'}}
              />
            </View>

            {isEditorPhraseType() ? (
              <>
                <Text style={styles.phraseFieldLabel}>{getEditorPhraseLabel()}</Text>
                <TextInput
                  style={styles.phraseInput}
                  value={getEditorPhraseValue()}
                  onChangeText={updateEditorPhraseValue}
                  placeholder={getEditorPhrasePlaceholder()}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </>
            ) : (
              <Text style={styles.unifiedEditorHint}>
                Для этого элемента нет дополнительных параметров.
              </Text>
            )}

            <Pressable
              onPress={removeCurrentEditorTarget}
              style={({pressed}) => [styles.unifiedEditorDeleteButton, pressed && styles.removeButtonPressed]}
              android_ripple={{color: '#FECACA'}}>
              <Text style={styles.unifiedEditorDeleteText}>Удалить элемент</Text>
            </Pressable>

            <Pressable
              onPress={closeUnifiedEditor}
              style={({pressed}) => [styles.unifiedEditorCloseButton, pressed && styles.saveButtonPressed]}
              android_ripple={{color: '#FDE68A'}}>
              <Text style={styles.unifiedEditorCloseText}>Готово</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Event Selector Modal */}
      <Modal
        visible={showEventSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventSelector(false)}>
        
        <View style={styles.selectorContainer}>
          <View style={[styles.selectorHeader, {paddingTop: insets.top + 14}]}>
            <Pressable
              onPress={() => setShowEventSelector(false)}
              style={({pressed}) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.selectorTitle}>Выбрать событие</Text>
            <View style={{width: 40}} />
          </View>

          {/* Category Selector */}
          <View style={styles.categoryBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}>
              {eventCategories.map(category => (
                <Pressable
                  key={category}
                  onPress={() => setSelectedEventCategory(category)}
                  style={[
                    styles.categoryButton,
                    selectedEventCategory === category && styles.categoryButtonActive,
                  ]}>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selectedEventCategory === category && styles.categoryButtonTextActive,
                    ]}>
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Events List */}
          <FlatList
            data={eventsByCategory[selectedEventCategory] || []}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <Pressable
                onPress={() => handleAddEvent(item)}
                style={({pressed}) => [
                  styles.selectorItem,
                  pressed && styles.selectorItemPressed,
                ]}
                android_ripple={{color: '#FDE68A'}}>
                <View style={styles.selectorItemContent}>
                  <Text style={styles.selectorItemTitle}>{item.name}</Text>
                  <Text style={styles.selectorItemDesc}>{item.description}</Text>
                </View>
              </Pressable>
            )}
            contentContainerStyle={[
              styles.selectorList,
              {paddingBottom: safeBottomInset + 20},
            ]}
          />
        </View>
      </Modal>

      {/* Action Selector Modal */}
      <Modal
        visible={showActionSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSelector(false)}>
        
        <View style={styles.selectorContainer}>
          <View style={[styles.selectorHeader, {paddingTop: insets.top + 14}]}>
            <Pressable
              onPress={() => setShowActionSelector(false)}
              style={({pressed}) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.selectorTitle}>Выбрать действие</Text>
            <View style={{width: 40}} />
          </View>

          {/* Category Selector */}
          <View style={styles.categoryBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}>
              {actionCategories.map(category => (
                <Pressable
                  key={category}
                  onPress={() => setSelectedActionCategory(category)}
                  style={[
                    styles.categoryButton,
                    selectedActionCategory === category && styles.categoryButtonActive,
                  ]}>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selectedActionCategory === category && styles.categoryButtonTextActive,
                    ]}>
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Actions List */}
          <FlatList
            data={actionsByCategory[selectedActionCategory] || []}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <Pressable
                onPress={() => handleAddAction(item)}
                style={({pressed}) => [
                  styles.selectorItem,
                  pressed && styles.selectorItemPressed,
                ]}
                android_ripple={{color: '#FDE68A'}}>
                <View style={styles.selectorItemContent}>
                  <Text style={styles.selectorItemTitle}>{item.name}</Text>
                  <Text style={styles.selectorItemDesc}>{item.description}</Text>
                  {item.requiresPermission && (
                    <Text style={styles.permissionText}>
                      🔒 Требует: {item.requiresPermission}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
            contentContainerStyle={[
              styles.selectorList,
              {paddingBottom: safeBottomInset + 20},
            ]}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  exportButton: {
    marginRight: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonPressed: {
    opacity: 0.7,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#E0F2FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7DD3FC',
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    elevation: 4,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#1F2937',
    fontWeight: '700',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#BAE6FD',
    borderRadius: 8,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#7DD3FC',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#E0F2FE',
    elevation: 2,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A8700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#1F2937',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8C4',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#FFF8C4',
  },
  bulkButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  bulkButtonEnable: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  bulkButtonDisable: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  bulkButtonEnableText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  bulkButtonDisableText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  bulkButtonPressed: {
    opacity: 0.85,
  },
  testRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: '#FFF8C4',
    gap: 8,
  },
  testButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  submitButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    backgroundColor: '#E0E7FF',
    borderColor: '#C7D2FE',
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  addButton: {
    backgroundColor: '#FFF59D',
    borderWidth: 2,
    borderColor: '#FBC02D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  addButtonIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E0B22B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemContent: {
    flex: 1,
  },
  itemContentPressable: {
    flex: 1,
    borderRadius: 10,
    padding: 2,
  },
  itemContentPressed: {
    opacity: 0.85,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  itemHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  itemStatus: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  unifiedEditorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  unifiedEditorBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  unifiedEditorCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 8,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  unifiedEditorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  unifiedEditorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  unifiedEditorMeta: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  enabledRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  enabledLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  unifiedEditorHint: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  unifiedEditorCloseButton: {
    marginTop: 8,
    backgroundColor: '#FBC02D',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  unifiedEditorCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  unifiedEditorDeleteButton: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  unifiedEditorDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  phraseFieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  phraseInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeButtonPressed: {
    opacity: 0.8,
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
  },
  selectorContainer: {
    flex: 1,
    backgroundColor: '#FFFDE7',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBC02D',
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    elevation: 4,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF59D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#1F2937',
    fontWeight: '700',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  categoryBar: {
    backgroundColor: '#FDE047',
    paddingVertical: 10,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  categoryButtonActive: {
    backgroundColor: '#FBC02D',
    borderColor: '#FBC02D',
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: '#1F2937',
  },
  selectorList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  selectorItem: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E0B22B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  selectorItemPressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  selectorItemContent: {
    gap: 4,
  },
  selectorItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  selectorItemDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  permissionText: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 4,
    fontWeight: '600',
  },
});
