import Joi from 'joi';

// Schema cho Đăng ký tài khoản
export const registerSchema = Joi.object({
    username: Joi.string().min(3).max(30).required().messages({
        'string.empty': 'Tên đăng nhập không được để trống',
        'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
        'any.required': 'Tên đăng nhập là bắt buộc'
    }),
    email: Joi.string().email().required().messages({
        'string.empty': 'Email không được để trống',
        'string.email': 'Định dạng email không hợp lệ',
        'any.required': 'Email là bắt buộc'
    }),
    password: Joi.string().min(6).required().messages({
        'string.empty': 'Mật khẩu không được để trống',
        'string.min': 'Mật khẩu phải có tối thiểu 6 ký tự',
        'any.required': 'Mật khẩu là bắt buộc'
    }),
    gender: Joi.string().valid('Male', 'Female').optional().messages({
        'any.only': 'Giới tính không hợp lệ',
    }),
    phone: Joi.string().allow('', null).optional()
});

// Schema cho Đăng nhập
export const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email không đúng định dạng',
        'any.required': 'Vui lòng nhập email'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Vui lòng nhập mật khẩu'
    })
});
