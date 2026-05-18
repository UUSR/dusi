import AsyncStorage from '@react-native-async-storage/async-storage';
import {DialogueMessage} from './dialogueManager';

const DIALOGUE_HISTORY_KEY = '@dusi_dialogue_history_v1';

interface StoredDialogueSession {
  messages: DialogueMessage[];
  updatedAt: number;
}

interface LoadDialogueHistoryOptions {
  maxAgeMs?: number;
}

function isDialogueMessage(value: unknown): value is DialogueMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybe = value as {role?: unknown; content?: unknown};
  const validRole = maybe.role === 'user' || maybe.role === 'assistant';
  const validContent = typeof maybe.content === 'string' && maybe.content.trim().length > 0;
  return validRole && validContent;
}

export async function loadDialogueHistory(): Promise<DialogueMessage[]> {
  return loadDialogueHistoryWithOptions();
}

async function loadDialogueHistoryWithOptions(options: LoadDialogueHistoryOptions = {}): Promise<DialogueMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(DIALOGUE_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const maxAgeMs = typeof options.maxAgeMs === 'number' && options.maxAgeMs > 0 ? options.maxAgeMs : 0;

    if (Array.isArray(parsed)) {
      // Backward compatibility: previous format stored only message array.
      return parsed
        .filter(isDialogueMessage)
        .map(item => ({
          role: item.role,
          content: item.content.trim(),
        }));
    }

    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const session = parsed as {messages?: unknown; updatedAt?: unknown};
    const updatedAt = typeof session.updatedAt === 'number' ? session.updatedAt : 0;

    if (maxAgeMs > 0 && updatedAt > 0 && Date.now() - updatedAt > maxAgeMs) {
      await AsyncStorage.removeItem(DIALOGUE_HISTORY_KEY);
      return [];
    }

    const rawMessages = Array.isArray(session.messages) ? session.messages : [];
    return rawMessages
      .filter(isDialogueMessage)
      .map(item => ({
        role: item.role,
        content: item.content.trim(),
      }));
  } catch (error) {
    console.warn('[DialogueStorage] Failed to load history:', error);
    return [];
  }
}

export async function loadDialogueHistoryByAge(maxAgeMs: number): Promise<DialogueMessage[]> {
  return loadDialogueHistoryWithOptions({maxAgeMs});
}

export async function saveDialogueHistory(messages: DialogueMessage[]): Promise<void> {
  try {
    const safeMessages = messages
      .filter(isDialogueMessage)
      .map(item => ({
        role: item.role,
        content: item.content.trim(),
      }));

    if (safeMessages.length === 0) {
      await AsyncStorage.removeItem(DIALOGUE_HISTORY_KEY);
      return;
    }

    const payload: StoredDialogueSession = {
      messages: safeMessages,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(DIALOGUE_HISTORY_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[DialogueStorage] Failed to save history:', error);
  }
}

export async function clearDialogueHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DIALOGUE_HISTORY_KEY);
  } catch (error) {
    console.warn('[DialogueStorage] Failed to clear history:', error);
  }
}
