// Keep the default test suite hermetic and prevent it from mutating a developer's OS keychain.
process.env.NODE_ENV = 'test';
process.env.REDSHIFT_TEST_KEYCHAIN_BACKEND = 'memory';
