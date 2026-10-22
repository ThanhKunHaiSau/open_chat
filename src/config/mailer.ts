import dns from "node:dns";
import nodemailer from "nodemailer";
import config from "./index.js";

// Khắc phục lỗi "DNS lookup for smtp.gmail.com timed out" trên Windows:
// Router cấp DNS IPv6 link-local (fe80::1) không phản hồi khiến c-ares bị treo.
try {
    dns.setDefaultResultOrder?.("ipv4first");
    const OriginalResolver = dns.Resolver;
    if (OriginalResolver) {
        dns.Resolver = class extends OriginalResolver {
            constructor(options?: dns.ResolverOptions) {
                super(options);
                try {
                    this.setServers(["8.8.8.8", "1.1.1.1"]);
                } catch {
                    // ignore
                }
            }
        };
    }
} catch {
    // ignore
}

export interface IVerifyEmailTemplateOptions {
    username: string;
    verifyUrl: string;
    token?: string;
}

/**
 * Tạo template HTML email xác thực tài khoản đẹp mắt, tương thích đa nền tảng
 */
export const getVerifyEmailTemplate = ({ username, verifyUrl, token }: IVerifyEmailTemplateOptions): string => {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Xác thực tài khoản OpenChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 40px 15px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #111827; border-radius: 20px; overflow: hidden; border: 1px solid #1f2937; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);">
                    
                    <!-- Top Gradient Header Banner -->
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); padding: 42px 30px; text-align: center;">
                            <div style="display: inline-block; background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50px; padding: 6px 18px; margin-bottom: 14px;">
                                <span style="color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Realtime Chat App</span>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                                ⚡ Open<span style="color: #fce7f3;">Chat</span>
                            </h1>
                            <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 400;">
                                Kết nối và trò chuyện thời gian thực
                            </p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 36px 32px 28px;">
                            <h2 style="margin: 0 0 16px; color: #f9fafb; font-size: 20px; font-weight: 700;">
                                Chào mừng bạn, <span style="color: #818cf8;">${username || "người bạn mới"}</span>! 👋
                            </h2>
                            <p style="margin: 0 0 20px; color: #9ca3af; font-size: 15px; line-height: 1.65;">
                                Cảm ơn bạn đã tham gia cộng đồng <strong style="color: #f3f4f6;">OpenChat</strong>. Để đảm bảo an toàn và kích hoạt đầy đủ tính năng cho tài khoản của bạn, vui lòng bấm vào nút bên dưới để xác nhận email:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${verifyUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 15px 38px; border-radius: 12px; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4); text-align: center; letter-spacing: 0.3px;">
                                            👉 Xác thực tài khoản ngay
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            ${token ? `
                            <!-- Token Box -->
                            <div style="background-color: #1a2234; border: 1px dashed #374151; border-radius: 12px; padding: 18px 20px; margin: 24px 0; text-align: center;">
                                <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af;">
                                    Mã xác thực token (nếu cần)
                                </p>
                                <div style="display: inline-block; background-color: #0f172a; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #a5b4fc; font-weight: 600; word-break: break-all;">
                                    ${token}
                                </div>
                            </div>
                            ` : ""}

                            <!-- Fallback Link -->
                            <div style="background-color: #0f172a; border-radius: 10px; padding: 14px 18px; margin: 24px 0 0; border: 1px solid #1e293b;">
                                <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; font-weight: 500;">
                                    Nếu nút bấm không hoạt động, vui lòng copy liên kết dưới đây dán vào trình duyệt:
                                </p>
                                <a href="${verifyUrl}" target="_blank" style="color: #818cf8; font-size: 12px; word-break: break-all; text-decoration: underline; line-height: 1.5;">
                                    ${verifyUrl}
                                </a>
                            </div>

                            <!-- Expiration Alert -->
                            <div style="margin-top: 26px; background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px;">
                                <p style="margin: 0; font-size: 13px; color: #fbbf24; line-height: 1.5;">
                                    ⏰ <strong>Lưu ý:</strong> Liên kết này có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không thực hiện đăng ký tài khoản tại OpenChat, xin vui lòng bỏ qua thư này.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: #0a0f1d; border-top: 1px solid #1e293b; text-align: center;">
                            <p style="margin: 0 0 6px; color: #6b7280; font-size: 13px; font-weight: 500;">
                                © ${new Date().getFullYear()} OpenChat Team. Tất cả các quyền được bảo lưu.
                            </p>
                            <p style="margin: 0; color: #4b5563; font-size: 12px;">
                                Đây là email tự động từ hệ thống. Vui lòng không trả lời thư này.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
};

/**
 * Gửi email chung
 */
export const sendMail = async (to: string, subject: string, html: string) => {
    try {
        const transporter = nodemailer.createTransport({
            host: config.mail.host,
            port: config.mail.port,
            secure: config.mail.port === 465,
            auth: {
                user: config.mail.user || "oniichann183@gmail.com",
                pass: config.mail.pass,
            },
        });

        return await transporter.sendMail({
            from: `"OpenChat ⚡" <${config.mail.user || "oniichann183@gmail.com"}>`,
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error("❌ [sendMail Error]:", error);
        throw error;
    }
};

/**
 * Helper gửi email xác thực kích hoạt tài khoản
 */
export const sendVerificationEmail = async ({
    to,
    username,
    verifyToken,
    verifyUrl
}: {
    to: string;
    username: string;
    verifyToken: string;
    verifyUrl?: string;
}) => {
    const url = verifyUrl || `${config.client.url}/verify-email/${verifyToken}`;
    const html = getVerifyEmailTemplate({
        username,
        verifyUrl: url,
        token: verifyToken,
    });

    return await sendMail(to, "⚡ [OpenChat] Kích hoạt tài khoản của bạn", html);
};