// Vitest setup — imports seasonData to seed the bundle cache and track
// registry so tests that use createNewGame / advanceSeason / getTrackById
// work without each test file needing to import seasonData explicitly.
import './data/seasonData';
