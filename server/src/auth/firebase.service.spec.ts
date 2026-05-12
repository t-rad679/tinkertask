import { ConfigService } from '@nestjs/config';

const fakeApp = { name: '[DEFAULT]' };
const mockInitializeApp = jest.fn(() => fakeApp);
const mockGetApps = jest.fn(() => [] as typeof fakeApp[]);
const mockCert = jest.fn((cfg: unknown) => cfg);
const mockGetAuth = jest.fn(() => ({ verifyIdToken: jest.fn() }));

jest.mock('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: mockGetAuth,
}));

// Import AFTER mocks are set up
import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  const cfg = {
    get: (k: string) =>
      ({
        FIREBASE_PROJECT_ID: 'p',
        FIREBASE_CLIENT_EMAIL: 'c@x',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n',
      } as Record<string, string>)[k],
  } as unknown as ConfigService;

  it('initialises only once', () => {
    // First call: no apps => calls initializeApp, returns fakeApp
    mockGetApps.mockReturnValueOnce([]);
    const a = new FirebaseService(cfg);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);

    // Second call: app already exists => reuses it
    mockGetApps.mockReturnValueOnce([fakeApp]);
    const b = new FirebaseService(cfg);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1); // still only 1 call

    expect(a.app).toBe(b.app);
  });
});
