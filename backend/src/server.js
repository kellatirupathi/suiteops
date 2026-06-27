import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

// Fail fast on a missing/weak signing secret rather than 500-ing on every login.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    '[server] FATAL: JWT_SECRET must be set and at least 32 characters long.'
  );
  process.exit(1);
}

// Don't let a stray rejection/exception silently kill the process unlogged.
process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] SuitesOps API running on http://localhost:${PORT}`);
  });
}

start();
