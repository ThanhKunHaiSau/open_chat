export interface IAuthLogin {
    email: string;
    password: string;
}


export interface IAuthRegister {
    username: string;
    password: string;
    email?: string;
    phoneNumber?: string;
}

export interface IcreateUser {
    username: string;
    email: string;
    password: string;
    phone?: string;
    gender?: string;
    role?: string;
    address?: string;
    avatar?: string;
}