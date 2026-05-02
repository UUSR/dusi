type SetupResult = {
  createCallDetector: (callback: (event: string, phoneNumber: string) => void) => {dispose: () => void} | null;
  bridgeRegister: jest.Mock;
  iosStart: jest.Mock;
  iosStop: jest.Mock;
  androidStart: jest.Mock;
  androidStop: jest.Mock;
  emitIos: (payload: unknown) => void;
  removeSub: jest.Mock;
  getRegisteredModule: () => {callStateUpdated: (state: string, incomingNumber: string) => void} | null;
};

function setup(os: 'ios' | 'android', includeNativeModules: boolean): SetupResult {
  jest.resetModules();

  const iosStart = jest.fn();
  const iosStop = jest.fn();
  const androidStart = jest.fn();
  const androidStop = jest.fn();
  const removeSub = jest.fn();

  let iosHandler: ((payload: unknown) => void) | null = null;
  let registeredModule: {callStateUpdated: (state: string, incomingNumber: string) => void} | null = null;

  const bridgeRegister = jest.fn((name: string, module: {callStateUpdated: (state: string, incomingNumber: string) => void}) => {
    if (name === 'CallStateUpdateActionModule') {
      registeredModule = module;
    }
  });

  (globalThis as any).__fbBatchedBridge = {
    registerCallableModule: bridgeRegister,
  };

  jest.doMock('react-native', () => {
    const NativeModules = includeNativeModules
      ? {
          CallDetectionManager: {
            startListener: iosStart,
            stopListener: iosStop,
          },
          CallDetectionManagerAndroid: {
            startListener: androidStart,
            stopListener: androidStop,
          },
        }
      : {};

    class MockNativeEventEmitter {
      addListener(_eventName: string, handler: (payload: unknown) => void) {
        iosHandler = handler;
        return {remove: removeSub};
      }
    }

    return {
      Platform: {OS: os},
      NativeModules,
      NativeEventEmitter: MockNativeEventEmitter,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {createCallDetector} = require('../src/native/callDetectionCompat');

  return {
    createCallDetector,
    bridgeRegister,
    iosStart,
    iosStop,
    androidStart,
    androidStop,
    emitIos: (payload: unknown) => {
      iosHandler?.(payload);
    },
    removeSub,
    getRegisteredModule: () => registeredModule,
  };
}

describe('callDetectionCompat', () => {
  afterEach(() => {
    delete (globalThis as any).__fbBatchedBridge;
    jest.dontMock('react-native');
  });

  test('returns null on iOS when native module is unavailable', () => {
    const env = setup('ios', false);
    const detector = env.createCallDetector(jest.fn());

    expect(detector).toBeNull();
    expect(env.bridgeRegister).toHaveBeenCalledTimes(1);
  });

  test('handles iOS payload object and disposes subscription', () => {
    const env = setup('ios', true);
    const callback = jest.fn();

    const detector = env.createCallDetector(callback);

    expect(detector).not.toBeNull();
    expect(env.iosStart).toHaveBeenCalledTimes(1);

    env.emitIos({state: 'Incoming', incomingNumber: '+79990001122'});
    expect(callback).toHaveBeenCalledWith('Incoming', '+79990001122');

    detector?.dispose();
    expect(env.removeSub).toHaveBeenCalledTimes(1);
    expect(env.iosStop).toHaveBeenCalledTimes(1);
  });

  test('maps iOS string payload to event with empty phone number', () => {
    const env = setup('ios', true);
    const callback = jest.fn();

    env.createCallDetector(callback);
    env.emitIos('Connected');

    expect(callback).toHaveBeenCalledWith('Connected', '');
  });

  test('maps invalid iOS payload to Disconnected fallback', () => {
    const env = setup('ios', true);
    const callback = jest.fn();

    env.createCallDetector(callback);
    env.emitIos(null);

    expect(callback).toHaveBeenCalledWith('Disconnected', '');
  });

  test('returns null on Android when native module is unavailable', () => {
    const env = setup('android', false);
    const detector = env.createCallDetector(jest.fn());

    expect(detector).toBeNull();
    expect(env.bridgeRegister).toHaveBeenCalledTimes(1);
  });

  test('handles Android callback lifecycle via callable module', () => {
    const env = setup('android', true);
    const callback = jest.fn();

    const detector = env.createCallDetector(callback);
    expect(detector).not.toBeNull();
    expect(env.androidStart).toHaveBeenCalledTimes(1);

    const registeredModule = env.getRegisteredModule();
    expect(registeredModule).not.toBeNull();

    registeredModule?.callStateUpdated('Incoming', '+70000000000');
    expect(callback).toHaveBeenCalledWith('Incoming', '+70000000000');

    detector?.dispose();
    expect(env.androidStop).toHaveBeenCalledTimes(1);

    callback.mockClear();
    registeredModule?.callStateUpdated('Incoming', '+71111111111');
    expect(callback).not.toHaveBeenCalled();
  });
});
