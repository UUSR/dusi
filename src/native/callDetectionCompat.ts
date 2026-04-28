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

  const bridge = (global as any)?.__fbBatchedBridge;
  if (bridge && typeof bridge.registerCallableModule === 'function') {
    bridge.registerCallableModule('CallStateUpdateActionModule', callStateUpdateActionModule);
    isRegistered = true;
  }
}

export function createCallDetector(callback: CallEventCallback): DisposableCallDetector | null {
  registerCallableModule();

  if (Platform.OS === 'ios') {
    if (!NativeCallDetector) {
      return null;
    }

    NativeCallDetector.startListener?.();
    const emitter = new NativeEventEmitter(NativeCallDetector);
    const sub = emitter.addListener('PhoneCallStateUpdate', callback);

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
