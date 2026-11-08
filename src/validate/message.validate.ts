import Joi from "joi";

export const validateMessage = Joi.object({
    conversationId: Joi.string().required(),
    page: Joi.string().optional(),
    limit: Joi.string().optional()

});
