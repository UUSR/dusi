import React, {useMemo, useState} from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Script} from '../scripts/types';
import {sha256} from 'js-sha256';

interface SubmitScriptScreenProps {
  script: Script;
  onBack?: () => void;
}

const computeSha256 = (str: string): string => {
  return sha256(str);
};

export default function SubmitScriptScreen({script, onBack}: SubmitScriptScreenProps) {
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 16);

  const [name, setName] = useState(script.name);
  const [description, setDescription] = useState(script.description || '');
  const [tags, setTags] = useState(script.tags?.join(', ') || '');
  const [version, setVersion] = useState('1.0');
  const [author, setAuthor] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scriptJson = JSON.stringify(script, null, 2);
  const checksumSha256 = useMemo(() => computeSha256(scriptJson), [scriptJson]);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (!name.trim()) errors.push('Укажите название скрипта');
    if (script.events.length === 0) errors.push('Добавьте хотя бы одно событие');
    if (script.actions.length === 0) errors.push('Добавьте хотя бы одно действие');
    if (description.trim().length < 20) errors.push('Описание должно быть не менее 20 символов');
    if (!author.trim()) errors.push('Укажите ваше имя/ник');

    return {isValid: errors.length === 0, errors};
  }, [name, description, author, script.events.length, script.actions.length]);

  const handleSubmitToGitHub = async () => {
    if (!validation.isValid) {
      Alert.alert('Ошибка валидации', validation.errors.join('\n'));
      return;
    }

    try {
      setIsSubmitting(true);

      const bodyContent = `## Информация о скрипте

**Название:** ${name}

**Описание:** ${description}

**Теги:** ${tags || 'не указаны'}

**Версия:** ${version}

**Автор:** ${author}

**SHA-256:** \`${checksumSha256}\`

## JSON скрипта

\`\`\`json
${scriptJson}
\`\`\`

## Проверка

- [x] Скрипт имеет хотя бы одно событие
- [x] Скрипт имеет хотя бы одно действие
- [x] Все параметры действий заполнены
- [x] Я согласен сделать скрипт общедоступным`;

      const params = new URLSearchParams();
      params.append('title', `Новый скрипт: ${name}`);
      params.append('labels', 'script-submission');
      params.append('body', bodyContent);

      const issueUrl =
        `https://github.com/UUSR/dusi-script-catalog/issues/new?${params.toString()}`;

      await Linking.openURL(issueUrl);

      Alert.alert(
        'Переход на GitHub',
        'Браузер откроется с готовым шаблоном Issue. Заполните поля и нажмите Submit.',
      );
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось открыть GitHub. Проверьте интернет-соединение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: safeBottomInset + 100}]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.sectionTitle}>Отправить скрипт в каталог</Text>
          <Text style={styles.hint}>
            Ваш скрипт будет проверен модератором и добавлен в общий каталог.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Название скрипта *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Озвучка уведомления"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Описание *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={[styles.input, styles.textarea]}
            placeholder="Объясните, что делает этот скрипт (минимум 20 символов)"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.charCount}>{description.length} символов</Text>

          <Text style={styles.label}>Теги (через запятую) *</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            style={styles.input}
            placeholder="уведомления, голос, tts"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Версия скрипта *</Text>
          <TextInput
            value={version}
            onChangeText={setVersion}
            style={styles.input}
            placeholder="1.0"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Ваше имя или ник *</Text>
          <TextInput
            value={author}
            onChangeText={setAuthor}
            style={styles.input}
            placeholder="@username или Full Name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.checksumCard}>
          <Text style={styles.label}>SHA-256 хэш скрипта</Text>
          <Text style={styles.checksumText}>{checksumSha256}</Text>
          <Text style={styles.hint}>
            Этот хэш автоматически вычислен и гарантирует целостность скрипта.
          </Text>
        </View>

        <Pressable
          onPress={() => setShowJson(!showJson)}
          style={({pressed}) => [
            styles.toggleButton,
            pressed && styles.toggleButtonPressed,
          ]}>
          <Text style={styles.toggleButtonText}>
            {showJson ? '▼ Скрыть JSON' : '▶ Показать JSON для проверки'}
          </Text>
        </Pressable>

        {showJson && (
          <View style={styles.jsonCard}>
            <Text style={styles.jsonText}>{scriptJson}</Text>
          </View>
        )}

        <View style={styles.validationCard}>
          <Text style={styles.validationTitle}>Проверка скрипта</Text>
          <Text style={validation.isValid ? styles.validationOk : styles.validationError}>
            {validation.isValid
              ? '✓ Скрипт готов к отправке'
              : `✗ Ошибки валидации:\n${validation.errors.join('\n')}`}
          </Text>
        </View>

        {!validation.isValid && (
          <View style={styles.errorCard}>
            {validation.errors.map((error, i) => (
              <Text key={i} style={styles.errorText}>
                • {error}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, {paddingBottom: safeBottomInset + 14}]}>
        <Pressable
          onPress={onBack}
          style={({pressed}) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.backButtonText}>Отмена</Text>
        </Pressable>

        <Pressable
          disabled={!validation.isValid || isSubmitting}
          onPress={handleSubmitToGitHub}
          style={({pressed}) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
            (!validation.isValid || isSubmitting) && styles.submitButtonDisabled,
          ]}>
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Отправка...' : 'Отправить в GitHub'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  checksumCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  checksumText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#334155',
    lineHeight: 16,
    backgroundColor: '#F5F3F0',
    padding: 8,
    borderRadius: 6,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 12,
  },
  toggleButtonPressed: {
    opacity: 0.7,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  jsonCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#E2E8F0',
    lineHeight: 15,
  },
  validationCard: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  validationOk: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
    fontWeight: '600',
  },
  validationError: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
