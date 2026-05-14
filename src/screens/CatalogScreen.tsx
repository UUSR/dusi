import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Script} from '../scripts/types';
import {saveScript} from '../scripts/storageService';

const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/index.json';

interface CatalogScriptEntry {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  version?: number;
  fileUrl: string;
}

interface CatalogIndex {
  schemaVersion: number;
  title?: string;
  scripts: CatalogScriptEntry[];
}

const generateScriptId = (): string =>
  Math.random().toString(36).substring(2, 11);

const normalizeImportedScript = (script: Script): Script => ({
  ...script,
  id: generateScriptId(),
  enabled: script.enabled !== false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  events: Array.isArray(script.events) ? script.events : [],
  actions: Array.isArray(script.actions) ? script.actions : [],
  tags: Array.isArray(script.tags) ? script.tags : [],
});

export default function CatalogScreen() {
  const [indexUrl, setIndexUrl] = useState(DEFAULT_CATALOG_URL);
  const [catalogTitle, setCatalogTitle] = useState('Каталог скриптов');
  const [scripts, setScripts] = useState<CatalogScriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');

  const canLoad = useMemo(() => indexUrl.trim().length > 0, [indexUrl]);

  const loadCatalog = useCallback(async () => {
    const url = indexUrl.trim();
    if (!url) {
      setErrorText('Укажите URL индекса каталога.');
      return;
    }

    try {
      setLoading(true);
      setErrorText('');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as CatalogIndex;
      if (!Array.isArray(data?.scripts)) {
        throw new Error('Неверный формат index.json');
      }

      const filtered = data.scripts.filter(item => {
        return item && typeof item.name === 'string' && typeof item.fileUrl === 'string';
      });

      setCatalogTitle(data.title || 'Каталог скриптов');
      setScripts(filtered);
    } catch (error) {
      setScripts([]);
      setErrorText(error instanceof Error ? error.message : 'Не удалось загрузить каталог.');
    } finally {
      setLoading(false);
    }
  }, [indexUrl]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const importScript = useCallback(async (entry: CatalogScriptEntry) => {
    try {
      setImportingId(entry.id);

      const response = await fetch(entry.fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const sourceScript = (await response.json()) as Script;
      if (!sourceScript || !sourceScript.name) {
        throw new Error('Некорректный JSON скрипта');
      }

      const imported = normalizeImportedScript(sourceScript);
      await saveScript(imported);

      Alert.alert('Импорт выполнен', `Скрипт «${imported.name}» сохранен локально.`);
    } catch (error) {
      Alert.alert(
        'Ошибка импорта',
        error instanceof Error ? error.message : 'Не удалось импортировать скрипт.',
      );
    } finally {
      setImportingId(null);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inputBlock}>
        <Text style={styles.label}>URL index.json</Text>
        <TextInput
          value={indexUrl}
          onChangeText={setIndexUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          placeholder="https://.../index.json"
          placeholderTextColor="#9CA3AF"
        />
        <Pressable
          disabled={!canLoad || loading}
          onPress={() => {
            void loadCatalog();
          }}
          style={({pressed}) => [
            styles.loadButton,
            pressed && styles.buttonPressed,
            (!canLoad || loading) && styles.buttonDisabled,
          ]}
          android_ripple={{color: '#BFDBFE'}}>
          <Text style={styles.loadButtonText}>{loading ? 'Загрузка...' : 'Загрузить каталог'}</Text>
        </Pressable>
      </View>

      <Text style={styles.catalogTitle}>{catalogTitle}</Text>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={styles.stateText}>Получаем список скриптов...</Text>
        </View>
      ) : scripts.length === 0 ? (
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Скрипты не найдены в каталоге.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {scripts.map(item => {
            const isImporting = importingId === item.id;
            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
                {Array.isArray(item.tags) && item.tags.length > 0 ? (
                  <Text style={styles.cardTags}>{item.tags.join(' · ')}</Text>
                ) : null}

                <Pressable
                  disabled={isImporting}
                  onPress={() => {
                    void importScript(item);
                  }}
                  style={({pressed}) => [
                    styles.importButton,
                    pressed && styles.buttonPressed,
                    isImporting && styles.buttonDisabled,
                  ]}
                  android_ripple={{color: '#DCFCE7'}}>
                  <Text style={styles.importButtonText}>{isImporting ? 'Импорт...' : 'Импортировать'}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  inputBlock: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  loadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
  },
  loadButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  catalogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    color: '#475569',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 22,
    gap: 10,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 7,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 19,
  },
  cardTags: {
    color: '#64748B',
    fontSize: 12,
  },
  importButton: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
