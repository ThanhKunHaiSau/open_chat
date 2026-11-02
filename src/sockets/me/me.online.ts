import type { Server, Socket } from "socket.io";
import { getAllFriendContact } from "../../controller/index.js";

export const isOnline = (io: Server, socket: Socket) => {
    socket.on("is_online", async () => {
        const userCurent = socket.data.user?.userId;
        if (!userCurent) return;

        const friendIds = await getAllFriendContact(userCurent);

        // 1. Báo cho tất cả bạn bè biết mình đang online
        friendIds.forEach((friendId: any) => {
            io.to(friendId.toString()).emit("user_status_change", {
                userId: userCurent,
                isOnline: true,
            });
        });

        // 2. Kiểm tra xem những bạn bè nào HIỆN TẠI đang online để trả về lại cho chính mình
        const onlineFriendIds = friendIds
            .map((f: any) => f.toString())
            .filter((friendIdStr: string) => {
                const room = io.sockets.adapter.rooms.get(friendIdStr);
                return Boolean(room && room.size > 0);
            });

        socket.emit("online_friends_list", onlineFriendIds);
    });

    socket.on("disconnect", async () => {
        const userCurent = socket.data.user?.userId;
        if (!userCurent) return;

        const friendIds = await getAllFriendContact(userCurent);
        friendIds.forEach((friendId: any) => {
            io.to(friendId.toString()).emit("user_status_change", {
                userId: userCurent,
                isOnline: false,
            });
        });
    });
};