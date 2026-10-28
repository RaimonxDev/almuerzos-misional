import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

export const crearDb = (d1: D1Database) =>
  drizzle(d1, { schema: { ...schema, ...authSchema } });

export type Db = ReturnType<typeof crearDb>;
