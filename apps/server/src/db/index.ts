import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "../types";
import * as schema from "./schema";

export function createDb(d1: Bindings["DB"]) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
