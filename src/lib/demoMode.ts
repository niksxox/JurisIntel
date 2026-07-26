// JurisIntel Demo Mode Configuration
// When DEMO_MODE is true, all API routes return realistic mock data
// derived from the project's Karnataka crime seed dataset.
// Set to false to switch back to live Prisma/PostgreSQL queries.

export const DEMO_MODE = true;

export const DEMO_BANNER =
  'JurisIntel is currently running in Demo Mode.\n' +
  'The PostgreSQL database has not yet been initialized.\n' +
  "The responses below are generated from the project's realistic Karnataka crime seed dataset.\n" +
  'Database functionality will automatically activate once Prisma migrations and seed execution are completed.';
