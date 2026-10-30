export interface IAuthLogin {
    email: string;
    password: string;
}


export interface IAuthRegister {
    username: string;
    password: string;
    email?: string;
    phoneNumber?: string;
    gender: string;
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

export interface IUser {
    userId: string,
    email: string,
    username: string,
    gender: string,
    role: string,
    avatar?: string,
    phone?: string,
    address?: string
}