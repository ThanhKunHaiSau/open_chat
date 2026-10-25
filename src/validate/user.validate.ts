import Joi from "joi";

export const getRequestFriendSchema = Joi.object({
    type: Joi.string().valid("receive", "sent").required().messages({
        'any.only': 'Loại yêu cầu không hợp lệ',
        'any.required': 'Vui lòng nhập loại yêu cầu'
    })
});
