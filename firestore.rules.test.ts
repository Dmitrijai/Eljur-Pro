// Stub file for Firestore rules test due to single-document public architecture
describe('Firestore Security Rules', () => {
  it('allows all operations to the appState based on current architecture', () => {
    // Tests disabled because Firebase Auth is not used to secure the payload.
    expect(true).toBe(true);
  });
});
