import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  FlatList,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import {FileSystem} from 'react-native-file-access';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Script, createNewScript} from '../scripts/types';
import {loadScripts, saveScript, deleteScript, importScripts} from '../scripts/storageService';
import FilePicker from 'react-native-file-picker';

interface ScriptsScreenProps {
  onSelectScript?: (script: Script) => void;
  onEditScript?: (script: Script) => void;
}

export default function ScriptsScreen({onSelectScript, onEditScript}: ScriptsScreenProps) {
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 16);

  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewScriptModal, setShowNewScriptModal] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [isCreatingScript, setIsCreatingScript] = useState(false);

  // Загрузить скрипты при открытии экрана
  useEffect(() => {
    const loadScriptsFromStorage = async () => {
      try {
        setIsLoading(true);
        const loadedScripts = await loadScripts();
        setScripts(loadedScripts);
      } catch (error) {
        console.error('[ScriptsScreen] Error loading scripts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScriptsFromStorage();
  }, []);

  const handleCreateScript = async () => {
    if (!newScriptName.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите название скрипта');
      return;
    }

    try {
      setIsCreatingScript(true);
      const newScript = createNewScript(newScriptName.trim());
      
      // Сохранить в хранилище
      await saveScript(newScript);
      
      // Обновить список
      setScripts([...scripts, newScript]);
      
      // Закрыть модальное окно
      setShowNewScriptModal(false);
      setNewScriptName('');
      
      // Если передана функция редактирования, сразу открыть редактор
      if (onEditScript) {
        setTimeout(() => {
          onEditScript(newScript);
        }, 300);
      }
    } catch (error) {
      console.error('[ScriptsScreen] Error creating script:', error);
      Alert.alert('Ошибка', 'Не удалось создать скрипт');
    } finally {
      setIsCreatingScript(false);
    }
  };

  const handleToggleScript = async (script: Script) => {
    try {
      const updated = {...script, enabled: !script.enabled};
      await saveScript(updated);
      
      setScripts(scripts.map(s => (s.id === script.id ? updated : s)));
    } catch (error) {
      console.error('[ScriptsScreen] Error toggling script:', error);
      Alert.alert('Ошибка', 'Не удалось обновить скрипт');
    }
  };

  const handleDeleteScript = (script: Script) => {
    Alert.alert('Удалить скрипт?', `Скрипт "${script.name}" будет удалён безвозвратно.`, [
      {text: 'Отмена', onPress: () => {}, style: 'cancel'},
      {
        text: 'Удалить',
        onPress: async () => {
          try {
            await deleteScript(script.id);
            setScripts(scripts.filter(s => s.id !== script.id));
          } catch (error) {
            console.error('[ScriptsScreen] Error deleting script:', error);
            Alert.alert('Ошибка', 'Не удалось удалить скрипт');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleImportScript = async () => {
    try {
      const result = await new Promise<{
        didCancel?: boolean;
        error?: unknown;
        fileName?: string;
        path?: string;
        uri?: string;
      }>((resolve, reject) => {
        FilePicker.showFilePicker(res => {
          if (res.didCancel) {
            resolve({didCancel: true});
            return;
          }

          if (res.error) {
            reject(res.error);
            return;
          }

          resolve({fileName: res.fileName, path: res.path, uri: res.uri});
        });
      });

      if (result.didCancel) {
        console.log('Импорт отменён');
        return;
      }

      const sourcePath = result.path ?? result.uri;
      if (!sourcePath) {
        Alert.alert('Ошибка', 'Не удалось получить путь к файлу');
        return;
      }

      const normalizedPath = sourcePath.startsWith('file://')
        ? sourcePath.replace('file://', '')
        : sourcePath;

      const readCandidates = [
        result.path,
        normalizedPath,
        sourcePath,
        result.uri,
      ].filter((candidate): candidate is string => !!candidate && candidate.trim().length > 0);

      let fileContent = '';
      let lastReadError: unknown = null;

      for (const candidate of readCandidates) {
        try {
          const candidatePath = candidate.startsWith('file://')
            ? candidate.replace('file://', '')
            : candidate;
          fileContent = await RNFS.readFile(candidatePath, 'utf8');
          if (fileContent) {
            break;
          }
        } catch (error) {
          lastReadError = error;
        }

        try {
          fileContent = await FileSystem.readFile(candidate);
          if (fileContent) {
            break;
          }
        } catch (error) {
          lastReadError = error;
        }
      }

      if (!fileContent) {
        if (lastReadError instanceof Error) {
          throw new Error(`Не удалось прочитать файл: ${lastReadError.message}`);
        }
        throw new Error('Не удалось прочитать файл');
      }

      const importedCount = await importScripts(fileContent);
      const updatedScripts = await loadScripts();
      setScripts(updatedScripts);

      const selectedName = result.fileName ?? normalizedPath ?? 'без имени';
      Alert.alert(
        'Импорт завершён',
        `Файл: ${selectedName}\nИмпортировано скриптов: ${importedCount}`,
      );
    } catch (err) {
      console.error('Ошибка при импорте файла:', err);
      const message = err instanceof Error ? err.message : 'Не удалось импортировать файл';
      Alert.alert('Ошибка импорта', message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={[styles.content, {paddingBottom: safeBottomInset + 100}]}
        showsVerticalScrollIndicator={false}>
        
        {isLoading ? (
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>Загрузка скриптов...</Text>
          </View>
        ) : scripts.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={styles.emptyTitle}>Скрипты не найдены</Text>
            <Text style={styles.emptyDesc}>Нажмите кнопку плюс, чтобы создать первый скрипт</Text>
          </View>
        ) : (
          <View>
            {scripts.map(script => (
              <Pressable
                key={script.id}
                onPress={() => onEditScript?.(script)}
                android_ripple={{color: '#F0F4C3'}}
                style={({pressed}) => [
                  styles.scriptCard,
                  pressed && styles.scriptCardPressed,
                ]}>
                
                <View style={styles.scriptCardContent}>
                  <View style={styles.scriptCardHeader}>
                    <Text style={styles.scriptName}>{script.name}</Text>
                    <Switch
                      value={script.enabled}
                      onValueChange={() => handleToggleScript(script)}
                      thumbColor={script.enabled ? '#FBC02D' : '#f4f3f4'}
                      trackColor={{false: '#CBD5E1', true: '#FDE047'}}
                    />
                  </View>

                  <View style={styles.scriptCardMeta}>
                    <Text style={styles.metaText}>
                      {script.events.length} событ. • {script.actions.length} действ.
                    </Text>
                    {script.description && (
                      <Text style={styles.descriptionText}>{script.description}</Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={() => handleDeleteScript(script)}
                  style={({pressed}) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                  ]}
                  android_ripple={{color: '#FFCDD2'}}>
                  <Text style={styles.deleteButtonText}>🗑</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button для создания нового скрипта */}
      <Pressable
        onPress={() => setShowNewScriptModal(true)}
        style={({pressed}) => [
          styles.fab,
          {bottom: safeBottomInset + 20},
          pressed && styles.fabPressed,
        ]}
        android_ripple={{color: '#FDE68A'}}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Модальное окно для создания скрипта */}
      {showNewScriptModal ? (
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setShowNewScriptModal(false);
              setNewScriptName('');
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'android' ? 'padding' : 'height'}
            style={styles.modal}>

            <Text style={styles.modalTitle}>Создать новый скрипт</Text>

            <Text style={styles.modalLabel}>Название скрипта</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Введите название..."
              placeholderTextColor="#9CA3AF"
              value={newScriptName}
              onChangeText={setNewScriptName}
              editable={!isCreatingScript}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowNewScriptModal(false);
                  setNewScriptName('');
                }}
                style={({pressed}) => [
                  styles.modalButton,
                  styles.modalButtonCancel,
                  pressed && styles.modalButtonPressed,
                ]}
                disabled={isCreatingScript}
                android_ripple={{color: '#EBF5FB'}}>
                <Text style={styles.modalButtonCancelText}>Отмена</Text>
              </Pressable>

              <Pressable
                onPress={handleCreateScript}
                style={({pressed}) => [
                  styles.modalButton,
                  styles.modalButtonOk,
                  pressed && styles.modalButtonPressed,
                  isCreatingScript && styles.modalButtonDisabled,
                ]}
                disabled={isCreatingScript}
                android_ripple={{color: '#FDE68A'}}>
                <Text style={styles.modalButtonOkText}>
                  {isCreatingScript ? 'Создание...' : 'OK'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      {/* Floating Action Button для импорта файла */}
      <Pressable
        onPress={handleImportScript}
        style={({pressed}) => [
          styles.importButton,
          {bottom: safeBottomInset + 20},
          pressed && styles.importButtonPressed,
        ]}
        android_ripple={{color: '#D1FAE5'}}>
        <Text style={styles.importButtonText}>Импорт</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2FE',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyTitle: {
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
  scriptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#E0B22B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  scriptCardPressed: {
    transform: [{scale: 0.98}],
  },
  scriptCardContent: {
    flex: 1,
  },
  scriptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scriptName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  scriptCardMeta: {
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButtonPressed: {
    opacity: 0.8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FBC02D',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#7A5800',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  fabPressed: {
    transform: [{scale: 0.95}],
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 20,
  },
  modal: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalButtonOk: {
    backgroundColor: '#FBC02D',
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  modalButtonOkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  importButton: {
    position: 'absolute',
    left: 16,
    width: 90,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 20,
    shadowColor: '#065F46',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  importButtonPressed: {
    transform: [{scale: 0.95}],
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#064E3B',
  },
});
