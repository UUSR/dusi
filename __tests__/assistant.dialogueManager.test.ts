import {ASSISTANT_SYSTEM_PROMPT, DialogueManager} from '../src/assistant/dialogueManager';

describe('dialogue manager', () => {
  test('keeps bounded history and builds model messages', () => {
    const manager = new DialogueManager({historyLimit: 3, followUpWindowMs: 500});

    manager.addUserMessage('Привет');
    manager.addAssistantMessage('Здравствуйте!');
    manager.addUserMessage('Сколько времени?');
    manager.addAssistantMessage('Сейчас 10:00.');

    const history = manager.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({role: 'assistant', content: 'Здравствуйте!'});

    const messages = manager.buildModelMessages(ASSISTANT_SYSTEM_PROMPT);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('голосовой ассистент Дуся');
    expect(messages[1].role).toBe('assistant');
    expect(messages[3].content).toBe('Сейчас 10:00.');
  });

  test('detects stop command using russian boundaries', () => {
    const manager = new DialogueManager();

    expect(manager.isStopDialogCommand('ладно, стоп')).toBe(true);
    expect(manager.isStopDialogCommand('хватит пожалуйста')).toBe(true);
    expect(manager.isStopDialogCommand('переходим дальше')).toBe(false);
  });

  test('classifies short phrase as follow-up prompt', () => {
    const manager = new DialogueManager();

    expect(manager.isFollowUpPrompt('а еще')).toBe(true);
    expect(manager.isFollowUpPrompt('подробнее про это')).toBe(true);
    expect(manager.isFollowUpPrompt('расскажи полный обзор возможностей ассистента')).toBe(false);
  });

  test('hydrates history with filtering and limit', () => {
    const manager = new DialogueManager({historyLimit: 2});

    manager.setHistory([
      {role: 'user', content: 'привет'},
      // @ts-expect-error intentional invalid role for runtime filter test
      {role: 'system', content: 'invalid'},
      {role: 'assistant', content: 'здравствуйте'},
      {role: 'user', content: 'как дела?'},
    ]);

    expect(manager.getHistory()).toEqual([
      {role: 'assistant', content: 'здравствуйте'},
      {role: 'user', content: 'как дела?'},
    ]);
  });
});
