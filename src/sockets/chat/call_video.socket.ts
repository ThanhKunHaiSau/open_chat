// open_chat/src/sockets/chat/call_video.socket.ts
import type { Server, Socket } from "socket.io";
import { saveCallLogMessage } from "../../controller/index.js";

interface ICallSession {
    sessionId: string;
    callerId: string;
    receiverId: string;
    callerSocketId: string;
    receiverSocketId?: string | undefined;
    callType: "video" | "audio";
    conversationId?: string | undefined;
    startTime?: number | undefined; // timestamp khi cuộc gọi bắt đầu kết nối
    status: "calling" | "connected" | "ended";
    hasSavedMessage?: boolean | undefined;
}

// Quản lý các phiên gọi đang diễn ra (Key: userId -> ICallSession)
const activeCalls = new Map<string, ICallSession>();

/**
 * Tự động tạo tin nhắn ghi lại lịch sử cuộc gọi (ủy quyền cho Controller)
 */
const saveCallMessage = async (
    io: Server,
    session: ICallSession,
    reason: string = "ended"
) => {
    if (session.hasSavedMessage) return;
    session.hasSavedMessage = true;

    try {
        const duration = session.startTime
            ? Math.max(1, Math.round((Date.now() - session.startTime) / 1000))
            : 0;

        let callStatus: "completed" | "missed" | "rejected" | "busy" | "failed" = "completed";

        if (session.status === "connected") {
            callStatus = "completed";
        } else if (reason === "rejected") {
            callStatus = "rejected";
        } else if (reason === "busy") {
            callStatus = "busy";
        } else {
            callStatus = "missed";
        }

        // Gọi Controller xử lý toàn bộ logic lưu DB
        const { message: populatedMsg, conversation: updatedConv, conversationId: convId } =
            await saveCallLogMessage({
                callerId: session.callerId,
                receiverId: session.receiverId,
                callType: session.callType,
                conversationId: session.conversationId,
                duration,
                status: callStatus,
            });

        // Bắn sự kiện realtime tin nhắn mới tới cả hai bên
        io.to(convId.toString()).emit("receive_message", populatedMsg);
        io.to(session.callerId).emit("receive_message", populatedMsg);
        io.to(session.receiverId).emit("receive_message", populatedMsg);

        if (updatedConv) {
            io.to(session.callerId).emit("conversation_updated", updatedConv);
            io.to(session.receiverId).emit("conversation_updated", updatedConv);
        }

        console.log(`📞 [Call Log] Đã ghi nhận cuộc gọi vào hộp thoại ${convId}`);
    } catch (err) {
        console.error("❌ [Call Log] Lỗi khi lưu tin nhắn cuộc gọi:", err);
    }
};

export const callSocket = (io: Server, socket: Socket) => {
    const currentUserId = socket.data.user?.userId?.toString();
    if (!currentUserId) return;

    // 1. Khi người gọi A bấm nút gọi B
    socket.on("call_user", (data: {
        toUserId: string;
        offer: any;
        callType: "video" | "audio";
        conversationId?: string;
    }) => {
        if (!data.toUserId) return;

        // Tránh tự gọi cho chính mình
        if (data.toUserId === currentUserId) {
            socket.emit("call_ended", {
                fromUserId: currentUserId,
                reason: "cannot_call_self",
            });
            return;
        }

        // A. Kiểm tra người nhận có online không
        const targetRoom = io.sockets.adapter.rooms.get(data.toUserId);
        if (!targetRoom || targetRoom.size === 0) {
            socket.emit("call_ended", {
                fromUserId: data.toUserId,
                reason: "offline",
            });
            return;
        }

        // B. Kiểm tra người nhận có đang bận cuộc gọi khác không (Busy)
        if (activeCalls.has(data.toUserId)) {
            socket.emit("call_ended", {
                fromUserId: data.toUserId,
                reason: "busy",
            });
            return;
        }

        // Khởi tạo phiên cuộc gọi mới
        const session: ICallSession = {
            sessionId: `${currentUserId}-${data.toUserId}-${Date.now()}`,
            callerId: currentUserId,
            receiverId: data.toUserId,
            callerSocketId: socket.id,
            callType: data.callType,
            conversationId: data.conversationId,
            status: "calling",
        };

        activeCalls.set(currentUserId, session);
        activeCalls.set(data.toUserId, session);
        socket.data.activeCallTarget = data.toUserId;

        // Gửi tín hiệu gọi đến B (kèm fromSocketId để B phản hồi chính xác tab)
        console.log("check socket data caller", socket.data.user)
        io.to(data.toUserId).emit("incoming_call", {
            fromUserId: currentUserId,
            fromSocketId: socket.id,
            caller: {
                id: currentUserId,
                username: socket.data.user?.username,
                avatar: socket.data.user?.avatar,
            },
            offer: data.offer,
            callType: data.callType,
            conversationId: data.conversationId,
        });
    });

    // 2. Khi người B bấm "Chấp nhận cuộc gọi" và gửi Answer SDP
    socket.on("answer_call", (data: { toUserId: string; toSocketId?: string; answer: any }) => {
        if (!data.toUserId) return;

        const session = activeCalls.get(currentUserId);
        if (session) {
            session.status = "connected";
            session.startTime = Date.now();
            session.receiverSocketId = socket.id;
        }

        socket.data.activeCallTarget = data.toUserId;

        // Gửi Answer về tab của người gọi A
        const target = data.toSocketId || data.toUserId;
        io.to(target).emit("call_accepted", {
            fromUserId: currentUserId,
            fromSocketId: socket.id,
            answer: data.answer,
        });

        // Tắt chuông ở các tab khác của chính người nghe (nếu mở nhiều tab)
        socket.to(currentUserId).emit("call_ended", {
            fromUserId: currentUserId,
            reason: "answered_elsewhere",
        });
    });

    // 3. Trao đổi địa chỉ mạng (ICE Candidate) giữa 2 máy
    socket.on("send_ice_candidate", (data: { toUserId: string; toSocketId?: string; candidate: any }) => {
        const target = data.toSocketId || data.toUserId;
        if (!target) return;

        io.to(target).emit("receive_ice_candidate", {
            fromUserId: currentUserId,
            fromSocketId: socket.id,
            candidate: data.candidate,
        });
    });

    // 4. Từ chối hoặc kết thúc cuộc gọi
    socket.on("end_call", async (data: { toUserId?: string; toSocketId?: string; reason?: string }) => {
        const peerId = data?.toUserId || socket.data.activeCallTarget;
        const session = activeCalls.get(currentUserId) || (peerId ? activeCalls.get(peerId) : undefined);

        if (session) {
            await saveCallMessage(io, session, data?.reason || "ended");
            activeCalls.delete(session.callerId);
            activeCalls.delete(session.receiverId);
        }

        socket.data.activeCallTarget = null;

        const target = data?.toSocketId || peerId;
        if (target) {
            io.to(target).emit("call_ended", {
                fromUserId: currentUserId,
                reason: data?.reason || "ended",
            });
        }
    });

    // 5. Xử lý khi người dùng mất kết nối đột ngột (tắt tab / rớt mạng)
    socket.on("disconnect", async () => {
        const peerId = socket.data.activeCallTarget;
        const session = activeCalls.get(currentUserId) || (peerId ? activeCalls.get(peerId) : undefined);

        if (session) {
            await saveCallMessage(io, session, "disconnected");
            activeCalls.delete(session.callerId);
            activeCalls.delete(session.receiverId);
        }

        if (peerId) {
            io.to(peerId).emit("call_ended", {
                fromUserId: currentUserId,
                reason: "disconnected",
            });
        }
    });
};
