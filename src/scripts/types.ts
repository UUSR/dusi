/**
 * Script Data Types
 * Типы данных для работы со скриптами
 */

export interface ScriptEvent {
  eventId: string;
  eventName: string;
  enabled?: boolean;
  conditions?: Record<string, any>;
}

export interface ScriptAction {
  actionId: string;
  actionName: string;
  enabled?: boolean;
  parameters?: Record<string, any>;
  delay?: number;
}

export interface ScriptRule {
  id: string;
  events: ScriptEvent[];
  actions: ScriptAction[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Script {
  id: string;
  name: string;
  description?: string;
  events: ScriptEvent[];
  actions: ScriptAction[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export const createNewScript = (name: string): Script => ({
  id: Math.random().toString(36).substring(2, 11),
  name,
  description: '',
  events: [],
  actions: [],
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tags: [],
});
