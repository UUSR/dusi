import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Обходим react-native-sensors publish()+refCount() — после первой отписки
// их внутренний Subject закрывается и повторные подписки данных не получают.
// Работаем напрямую с нативным модулем, чтобы каждый start() создавал
// свежий слушатель без этого ограничения.
const AccNative = NativeModules.RNSensorsAccelerometer as {
  startUpdates: () => void;
  stopUpdates: () => void;
  setUpdateInterval: (ms: number) => void;
} | undefined;

const SENSOR_EVENT = 'RNSensorsAccelerometer';

// Ускорение свободного падения, м/с²
const GRAVITY = 9.81;

export type ShakeDetectorConfig = {
  // Порог суммарного ускорения в м/с². В покое ~9.81 м/с².
  threshold?: number;
  interval?: number;
  onShake: () => void;
};

export class ShakeDetector {
  private threshold: number;
  private interval: number;
  private onShake: () => void;
  private lastShake: number = 0;
  private subscription: { remove: () => void } | null = null;

  constructor(config: ShakeDetectorConfig) {
    this.threshold = config.threshold ?? GRAVITY * 1.4;
    this.interval = config.interval ?? 800;
    this.onShake = config.onShake;
  }

  start() {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    if (this.subscription) return;
    if (!AccNative) {
      console.warn('[ShakeDetector] RNSensorsAccelerometer not available');
      return;
    }
    try {
      AccNative.setUpdateInterval(50); // 20 Гц
      AccNative.startUpdates();
      const emitter = new NativeEventEmitter(NativeModules.RNSensorsAccelerometer);
      this.subscription = emitter.addListener(SENSOR_EVENT, ({ x, y, z }: { x: number; y: number; z: number }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        if (magnitude > this.threshold) {
          const now = Date.now();
          if (now - this.lastShake > this.interval) {
            this.lastShake = now;
            this.onShake();
          }
        }
      });
    } catch (e) {
      console.warn('[ShakeDetector] start failed:', e);
    }
  }

  stop() {
    try {
      this.subscription?.remove();
      this.subscription = null;
      AccNative?.stopUpdates();
    } catch (e) {
      console.warn('[ShakeDetector] stop failed:', e);
    }
  }
}
