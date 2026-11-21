import type { Response } from "express";
import { z } from "zod";

export const fail = (res: Response, status: number, error: string, extra: Record<string, unknown> = {}) =>
  void res.status(status).json({ error, ...extra });

/** Parses `data` with a zod schema; sends 400 and returns null when invalid. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, res: Response): z.infer<T> | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    fail(res, 400, "invalid_input", { fields: r.error.issues.map((i) => i.path.join(".")).filter(Boolean) });
    return null;
  }
  return r.data;
}
