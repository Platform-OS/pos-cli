// Do NOT load dotenv here automatically
// Tests that need real credentials should import 'dotenv/config' at the top of their file
// Tests that don't need credentials will work without loading dotenv

// Note: We do NOT clear credentials here because:
// 1. Integration tests import 'dotenv/config' at the top of their file (before this setup runs)
// 2. Unit tests don't import dotenv, so they won't have credentials
// 3. Clearing credentials here would break integration tests

// If a unit test accidentally has credentials set (e.g., from environment), it should handle that in the test itself
