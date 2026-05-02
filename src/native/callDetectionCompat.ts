import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

type CallEvent = 'Incoming' | 'Disconnected' | 'Dialing' | 'Connected' | 'Offhook';
type CallEventCallback = (event: CallEvent, phoneNumber: string) => void;

interface DisposableCallDetector {
  dispose: () => void;
}

const NativeCallDetector = NativeModules.CallDetectionManager;
const NativeCallDetectorAndroid = NativeModules.CallDetectionManagerAndroid;

const callStateUpdateActionModule: {
  callback?: CallEventCallback;
  callStateUpdated: (state: CallEvent, incomingNumber: string) => void;
} = {
  callStateUpdated(state, incomingNumber) {
    callStateUpdateActionModule.callback?.(state, incomingNumber);
  },
};

let isRegistered = false;

function registerCallableModule() {
  if (isRegistered) {
    return;
  }

  const bridge = (globalThis as any)?.__fbBatchedBridge;
  if (bridge && typeof bridge.registerCallableModule === 'function') {
    bridge.registerCallableModule('CallStateUpdateActionModule', callStateUpdateActionModule);
    isRegistered = true;
  }
}

function toCallEvent(payload: unknown): {event: CallEvent; phoneNumber: string} {
  if (typeof payload === 'string') {
    return {event: payload as CallEvent, phoneNumber: ''};
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as {
      event?: string;
      state?: string;
      phoneNumber?: string;
      incomingNumber?: string;
    };
    const event = (candidate.event ?? candidate.state ?? 'Disconnected') as CallEvent;
    const phoneNumber = candidate.phoneNumber ?? candidate.incomingNumber ?? '';
    return {event, phoneNumber};
  }

  return {event: 'Disconnected', phoneNumber: ''};
}

export function createCallDetector(callback: CallEventCallback): DisposableCallDetector | null {
  registerCallableModule();

  if (Platform.OS === 'ios') {
    if (!NativeCallDetector) {
      return null;
    }

    NativeCallDetector.startListener?.();
    const emitter = new NativeEventEmitter(NativeCallDetector);
    const sub = emitter.addListener('PhoneCallStateUpdate', payload => {
      const {event, phoneNumber} = toCallEvent(payload);
      callback(event, phoneNumber);
    });

    return {
      dispose: () => {
        sub.remove();
        NativeCallDetector.stopListener?.();
      },
    };
  }

  if (Platform.OS === 'android') {
    if (!NativeCallDetectorAndroid) {
      return null;
    }

    callStateUpdateActionModule.callback = callback;
    NativeCallDetectorAndroid.startListener?.();

    return {
      dispose: () => {
        callStateUpdateActionModule.callback = undefined;
        NativeCallDetectorAndroid.stopListener?.();
      },
    };
  }

  return null;
}
