import {NativeModules, Platform} from 'react-native';

const {VoiceNotifications} = NativeModules;

export type VoiceNotificationMode = 'all' | 'selected';

export interface VoiceNotificationsSettings {
  enabled: boolean;
  mode: VoiceNotificationMode;
  selectedPackages: string[];
  accessGranted: boolean;
}

export interface InstalledAppInfo {
  packageName: string;
  label: string;
  isSystem: boolean;
}

function ensureAndroid() {
  if (Platform.OS !== 'android') {
    throw new Error('VoiceNotifications доступен только на Android');
  }
  if (!VoiceNotifications) {
    throw new Error('Нативный модуль VoiceNotifications не найден');
  }
}

export async function getVoiceNotificationsSettings(): Promise<VoiceNotificationsSettings> {
  ensureAndroid();
  return VoiceNotifications.getSettings();
}

export async function setVoiceNotificationsEnabled(enabled: boolean): Promise<void> {
  ensureAndroid();
  await VoiceNotifications.setEnabled(enabled);
}

export async function setVoiceNotificationsMode(mode: VoiceNotificationMode): Promise<void> {
  ensureAndroid();
  await VoiceNotifications.setMode(mode);
}

export async function setVoiceNotificationsSelectedPackages(packages: string[]): Promise<void> {
  ensureAndroid();
  await VoiceNotifications.setSelectedPackages(packages);
}

export async function getInstalledApps(includeSystem: boolean): Promise<InstalledAppInfo[]> {
  ensureAndroid();
  return VoiceNotifications.getInstalledApps(includeSystem);
}

export async function isVoiceNotificationAccessGranted(): Promise<boolean> {
  ensureAndroid();
  return VoiceNotifications.isNotificationAccessGranted();
}

export async function openVoiceNotificationAccessSettings(): Promise<void> {
  ensureAndroid();
  await VoiceNotifications.openNotificationAccessSettings();
}
