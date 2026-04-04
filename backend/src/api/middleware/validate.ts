import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../../types/errors";

type Target = "body" | "query" | "params";

/**
 * Returns middleware that validates req[target] against the given Zod schema.
 * On success the parsed (coerced) value replaces the raw value.
 */
export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        fieldErrors[key] = fieldErrors[key] ?? [];
        fieldErrors[key].push(issue.message);
      }
      next(new ValidationError(fieldErrors));
      return;
    }
    req[target] = result.data;
    next();
  };
}
