import { ImapFlow } from "imapflow";

function cleanAppPassword(value: string): string {
  return String(value || "")
    .replace(/[\s"']/g, "")
    .trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, message: "Method not allowed" },
      { status: 405 }
    );
  }

  let client: ImapFlow | null = null;

  try {
    const body = await request.json();
    const email = String(body?.email || "").trim();
    // The UI sends appPassword; accept password too for backwards compatibility.
    const password = cleanAppPassword(body?.appPassword ?? body?.password);

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          message: "البريد الإلكتروني وكلمة مرور التطبيقات مطلوبان",
        },
        { status: 400 }
      );
    }

    const host = String(body?.imapHost || "imap.gmail.com").trim();
    const port = Number(body?.imapPort) || 993;

    client = new ImapFlow({
      host,
      port,
      secure: body?.useSsl !== false,
      auth: { user: email, pass: password },
      logger: false,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000,
    });

    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });

    await client.logout();
    client = null;

    return Response.json({
      success: true,
      message: "تم الاتصال بـ Gmail بنجاح",
      mailbox: { path: mailbox.path, exists: mailbox.exists },
    });
  } catch (error) {
    console.error("Gmail connection error:", error);

    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore cleanup errors.
    }
    }

    const message = getErrorMessage(error);
    return Response.json(
      {
        success: false,
        message:
          /timeout|timed out|econn|enotfound/i.test(message)
            ? "انتهت مهلة الاتصال بسيرفر Gmail. تحقق من إمكانية اتصال الاستضافة بمنفذ IMAP 993."
            : message,
      },
      { status: 500 }
    );
  }
}
