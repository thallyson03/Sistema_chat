import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.flatten();
      res.status(400).json({
        error: 'Dados inválidos',
        details: details.fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
