import { ImapFlow } from "imapflow";

function cleanAppPassword(value: string): string {
  return String(value || "")
    .replace(/[\s"']/g, "")
    .trim();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "Method not allowed",
      },
      { status: 405 }
    );
  }

  let client: ImapFlow | null = null;

  try {
    const body = await request.json();

    const email = String(body?.email || "").trim();
    const password = cleanAppPassword(body?.password);

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          error: "البريد الإلكتروني وكلمة مرور التطبيقات مطلوبان",
        },
        { status: 400 }
      );
    }

    client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
    });

    await client.connect();

    const mailbox = await client.mailboxOpen("INBOX", {
      readOnly: true,
    });

    await client.logout();
    client = null;

    return Response.json({
      success: true,
      message: "تم الاتصال بـ Gmail بنجاح",
      mailbox: {
        path: mailbox.path,
        exists: mailbox.exists,
      },
    });
  } catch (error) {
    console.error("Gmail connection error:", error);

    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout errors
      }
    }

    return Response.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
