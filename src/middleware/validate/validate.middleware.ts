import type { Request, Response, NextFunction } from 'express';
import type { ObjectSchema } from 'joi';
import { AppError } from '../../common/appError.js';

export const validateRequest = (schema: ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return next(new AppError(errorMessage, 400));
        }

        req.body = value;
        next();
    };
};
