import {getAssistantResponse, getVoiceIntent} from '../src/assistant/rules';

describe('assistant rules', () => {
  test('uses explicit rule priority: joke beats generic help', () => {
    const response = getAssistantResponse('помощь и расскажи анекдот', {
      now: () => new Date(2026, 4, 2, 10, 5),
      random: () => 0,
    });

    expect(response).toContain('Программист жалуется другу');
  });

  test('formats time with Intl and injected clock', () => {
    const response = getAssistantResponse('который час?', {
      now: () => new Date(2026, 4, 2, 9, 5),
      random: () => 0,
    });

    expect(response).toContain('09:05');
  });

  test('formats date with Intl and injected clock', () => {
    const response = getAssistantResponse('какая дата', {
      now: () => new Date(2026, 4, 2, 9, 5),
      random: () => 0,
    });

    expect(response).toMatch(/^Сегодня .+2026/);
  });

  test('normalizes punctuation for call intent', () => {
    expect(getVoiceIntent('Позвони   маме!!!')).toEqual({type: 'call', name: 'маме'});
  });

  test('maps redial phrases to redial intent', () => {
    expect(getVoiceIntent('позвони снова')).toEqual({type: 'redial'});
    expect(getVoiceIntent('Перезвони мне!!!')).toEqual({type: 'redial'});
  });

  test('cleans service words in callee name', () => {
    expect(getVoiceIntent('позвони, пожалуйста, контакту мама')).toEqual({
      type: 'call',
      name: 'мама',
    });
  });

  test('rejects invalid callee-only command', () => {
    expect(getVoiceIntent('вызови мне')).toBeNull();
  });
});
