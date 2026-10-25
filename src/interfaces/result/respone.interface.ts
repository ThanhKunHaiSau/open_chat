export interface IResponseResult {
    data: any[];
    meta: {
        page: number;
        limit: number;
        totalPage: number;
        total: number;
    }
}