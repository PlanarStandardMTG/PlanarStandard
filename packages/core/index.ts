// packages/core — pure logic only.
// MUST NEVER import from db, next, react, or @supabase/*.
// If a function needs data, it takes it as an argument.
// Modules land under core/<area>/<name>/ per §8 of the master plan
// (decklist, legality, metrics, similarity, elo, identity, stats, reddit).
export {};
