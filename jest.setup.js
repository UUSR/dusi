jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(async () => ''),
    writeFile: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    downloadFile: jest.fn(() => ({promise: Promise.resolve()})),
    DocumentDirectoryPath: '/tmp',
    CachesDirectoryPath: '/tmp',
    MainBundlePath: '/tmp',
  },
}));

jest.mock('react-native-file-access', () => ({
  FileSystem: {
    readFile: jest.fn(async () => ''),
    writeFile: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
  },
}));

jest.mock('react-native-file-picker', () => ({
  showFilePicker: jest.fn(),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn(async () => undefined),
    shareSingle: jest.fn(async () => undefined),
  },
}));

jest.mock('@react-native-voice/voice', () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
    isAvailable: jest.fn(async () => true),
    removeAllListeners: jest.fn(),
    destroy: jest.fn(async () => undefined),
    onSpeechResults: null,
    onSpeechError: null,
    onSpeechPartialResults: null,
    onSpeechStart: null,
    onSpeechEnd: null,
    onSpeechRecognized: null,
    onSpeechVolumeChanged: null,
  },
}));

jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    speak: jest.fn(),
    stop: jest.fn(async () => undefined),
    getInitStatus: jest.fn(async () => undefined),
    setDefaultLanguage: jest.fn(),
    setDefaultRate: jest.fn(),
    setDefaultPitch: jest.fn(),
    addEventListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

jest.mock('react-native-contacts', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(async () => []),
    getCount: jest.fn(async () => 0),
  },
}));

jest.mock('react-native-call-detection', () => ({
  __esModule: true,
  default: jest.fn(() => ({remove: jest.fn()})),
}));

const {NativeModules} = require('react-native');

NativeModules.SystemEvent = NativeModules.SystemEvent ?? {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};