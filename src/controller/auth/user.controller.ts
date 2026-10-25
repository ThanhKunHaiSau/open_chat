import mongoose from "mongoose";
import type { IResponseResult } from "../../interfaces/index.js";
import User from "../../models/user.model.js";
import { redisService } from "../../common/redis.service.js";
import { findAddedFriend, getFriendContract, getRequestFriend } from "../contact/contact.controller.js";

export const fetchAllUser = async (params: {
    userId: string,
    name: string,
    limit: number,
    page: number
}): Promise<IResponseResult> => {
    try {
        const { userId, name, limit, page } = params;
        const excludeIds = await findAddedFriend(userId);

        const filter: { $match: Record<string, any> } = {
            $match: {
                _id: {
                    $nin: excludeIds
                },
                "local.is_active": true,
                deletedAt: null,
            }
        };
        if (name && name.trim()) {
            filter.$match.username = {
                $regex: name.trim(),
                $options: "i"

            }
        }
        const facet = {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                ],
            },
        };
        const project = {
            $project: {
                _id: 1,
                username: 1,
                avatar: 1,
                gender: 1,
                phone: 1,
                address: 1,
            }
        }
        const keyRedis = `:allUser:${page}:${limit}:name:${name}`
        const checkExistRedis = await redisService.getKeyCache(userId, keyRedis);
        if (checkExistRedis) {
            return JSON.parse(checkExistRedis);
        }
        const pipeline = [filter, project, facet];
        const result = await User.aggregate(pipeline);

        const total = result[0]?.metadata[0]?.total || 0;
        const data = result[0]?.data || [];
        const dataRedis = {
            data,
            meta: {
                page,
                limit,
                totalPage: Math.ceil(total / limit),
                total
            }
        };
        await redisService.setKeyCache(userId, keyRedis, dataRedis, 100);
        return {
            data,
            meta: {
                page,
                limit,
                totalPage: Math.ceil(total / limit),
                total
            }
        };
    } catch (error: any) {
        throw new Error(error.message || error);
    }
}

export const getRequestAddFriend = async (userId: string, type: string) => {
    try {

        const ids = await getRequestFriend(userId, type);
        const users = await User.find({
            _id: {
                $in: ids
            }
        }).select("username avatar gender phone address")
        return users;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
}

export const getFriend = async (userId: string) => {
    try {

        const ids = await getFriendContract(userId);
        const users = await User.find({
            _id: {
                $in: ids
            }
        }).select("username avatar gender phone address")
        return users;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
}