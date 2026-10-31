export interface ICreateNoitication {
    sender: {
        id: string;
        avatar?: string;
        username: string;
    };
    receiver: {
        id: string;
        username?: string;
        avatar?: string;
    };
    type: string;
    content: string;
    isRead?: boolean;
}
