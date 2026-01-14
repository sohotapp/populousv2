import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Create database client only if DATABASE_URL is provided
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (connectionString) {
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
  });
  db = drizzle(client, { schema });
}

export { db };
export * from "./schema";
