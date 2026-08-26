import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

function cleanAppPassword(pass: string): string {
  return (pass || "").replace(/[\s"']/g, "").trim();
}

function extractOtpFromMail(parsed: any) {
  const text = (parsed.text || "") + "\n" + (parsed.html || "");
  const subject = parsed.subject || "";
  const fullText = `${subject}\n${text}`;

  const recipients: string[] = [];

  if (parsed.to) {
    const toArr = Array.isArray(parsed.to) ? parsed.to : [parsed.to];

    toArr.forEach((t: any) => {
      if (t.value) {
        t.value.forEach((addr: any) => {
          if (addr.address) {
            recipients.push(addr.address.toLowerCase());
          }
        });
      } else if (typeof t === "string") {
        recipients.push(t.toLowerCase());
      }
    });
  }

  if (parsed.headers) {
    const deliveredTo =
      parsed.headers.get("delivered-to") ||
      parsed.headers.get("x-original-to");

    if (deliveredTo) {
      const addr = String(deliveredTo).toLowerCase().trim();

      if (addr && !recipients.includes(addr)) {
        recipients.push(addr);
      }
    }
  }

  let extractedCode = "";

  const patterns = [
    /(?:كود|رمز|رمز\s+التحقق|كود\s+التحقق|رمز\s+التفعيل|كود\s+نسك|كود\s+التسجيل|تأكيد\s+البريد|Verification\s+Code|OTP|Passcode|Pin\s+code)\s*(?:هو|is|:|=|\s|-)*\s*([0-9]{4,6})/i,

    /([0-9]{4,6})\s*(?:هو|is)?\s*(?:كود|رمز|كود\s+التحقق|رمز\s+التحقق|OTP|verification)/i,

    /(?:["'<b>\s>])([0-9]{4,6})(?:["'<\/b\s<])/,
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);

    if (match && match[1]) {
      const code = match[1];

      if (
        code.length >= 4 &&
        code.length <= 6 &&
        ![
          "2024",
          "2025",
          "2026",
          "2027",
          "1234",
          "12345",
          "123456",
          "0000",
          "00000",
          "000000",
        ].includes(code)
      ) {
        extractedCode = code;
        break;
      }
    }
  }

  return {
    otpCode: extractedCode,
    subject,
    sender:
      parsed.from?.text ||
      parsed.from?.value?.[0]?.address ||
      "غير معروف",
    recipients,
    receivedAt: parsed.date
      ? new Date(parsed.date).toISOString()
      : new Date().toISOString(),
    fullText,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function getResponseText(error: any): string {
  return String(error?.responseText || "");
}

function createImapClient({
  host,
  port,
  email,
  password,
  useSsl,
}: {
  host: string;
  port: number;
  email: string;
  password: string;
  useSsl: boolean;
}) {
  const client = new ImapFlow({
    host,
    port,
    secure: useSsl,
    auth: {
      user: email.trim(),
      pass: password,
    },
    logger: false,
    emitLogs: false,
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
  });

  client.on("error", (err) => {
    console.error(
      "ImapFlow fetch OTPs client error:",
      err?.message || err
    );
  });

  return client;
}

export default async function handler(
  request: Request
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      {
        success: false,
        message: "Method not allowed",
      },
      { status: 405 }
    );
  }

  let client: ImapFlow | null = null;
  let lock: any = null;

  try {
    const body = await request.json();

    const {
      imapHost,
      imapPort,
      email,
      appPassword,
      useSsl,
      sinceMinutes = 30,
      searchKeywords = [
        "نسك",
        "Nusuk",
        "كود",
        "رمز",
        "Verification",
      ],
    } = body || {};

    if (!email || !appPassword) {
      return Response.json(
        {
          success: false,
          message:
            "يرجى توفير البريد الإلكتروني وكلمة مرور التطبيقات",
        },
        { status: 400 }
      );
    }

    const host = String(imapHost || "imap.gmail.com").trim();
    const port = Number(imapPort) || 993;
    const pass = cleanAppPassword(String(appPassword));

    const sslEnabled = useSsl !== false;

    client = createImapClient({
      host,
      port,
      email: String(email),
      password: pass,
      useSsl: sslEnabled,
    });

    await client.connect();

    lock = await client.getMailboxLock("INBOX");

    const otpsFetched: any[] = [];

    try {
      const minutes = Math.min(
        Math.max(Number(sinceMinutes) || 30, 1),
        1440
      );

      const sinceDate = new Date(
        Date.now() - minutes * 60 * 1000
      );

      const searchCriteria = {
        since: sinceDate,
      };

      const messages = client.fetch(
        searchCriteria,
        {
          uid: true,
          envelope: true,
          source: true,
        }
      );

      let count = 0;

      for await (const message of messages) {
        if (!message.source) {
          continue;
        }

        count++;

        if (count > 30) {
          break;
        }

        try {
          const parsed = await simpleParser(message.source);

          const extracted = extractOtpFromMail(parsed);

          const fullContent = (
            extracted.subject +
            " " +
            extracted.fullText
          ).toLowerCase();

          const defaultKeywords = [
            "نسك",
            "nusuk",
            "كود",
            "رمز",
            "verification",
            "otp",
            "passcode",
            "تحقق",
            "تفعيل",
            "تسجيل",
          ];

          const activeKeywords =
            Array.isArray(searchKeywords) &&
            searchKeywords.length > 0
              ? searchKeywords
              : defaultKeywords;

          const hasKeyword = activeKeywords.some(
            (keyword: unknown) =>
              typeof keyword === "string" &&
              fullContent.includes(keyword.toLowerCase())
          );

          if (extracted.otpCode && hasKeyword) {
            const primaryRecipient =
              extracted.recipients[0] ||
              String(email).trim().toLowerCase();

            otpsFetched.push({
              id:
                "otp_" +
                message.uid +
                "_" +
                Date.now(),

              recipientEmail: primaryRecipient,

              allRecipients: extracted.recipients,

              otpCode: extracted.otpCode,

              subject: extracted.subject,

              sender: extracted.sender,

              receivedAt: extracted.receivedAt,
            });
          }
        } catch (parseError) {
          console.error(
            "Mail parse error:",
            parseError
          );
        }
      }
    } finally {
      if (lock) {
        lock.release();
        lock = null;
      }
    }

    return Response.json({
      success: true,
      count: otpsFetched.length,
      otps: otpsFetched,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "Fetch OTPs IMAP Error:",
      error
    );

    const responseText = getResponseText(error);
    const errorMessage = getErrorMessage(error);

    const fullText = (
      responseText +
      " " +
      errorMessage
    ).toLowerCase();

    let userMsg =
      "حدث خطأ أثناء جلب البريد الإلكتروني. ";

    if (
      fullText.includes("invalid credentials") ||
      fullText.includes("authenticationfailed") ||
      fullText.includes("command failed")
    ) {
      userMsg +=
        'كلمة المرور أو البريد غير صحيح. يرجى التأكد من استخدام "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرفاً.';
    } else if (
      fullText.includes("disabled") ||
      fullText.includes("imap")
    ) {
      userMsg +=
        "يرجى التأكد من أن IMAP متاح في حساب Gmail.";
    } else if (
      fullText.includes("enotfound") ||
      fullText.includes("ehostunreach")
    ) {
      userMsg +=
        "خادم IMAP غير موجود أو يتعذر الوصول إليه. تحقق من إعدادات السيرفر.";
    } else if (
      fullText.includes("etimedout") ||
      fullText.includes("econnrefused")
    ) {
      userMsg +=
        "انتهت مهلة الاتصال بسيرفر IMAP. حاول مرة أخرى.";
    } else {
      userMsg +=
        responseText ||
        errorMessage ||
        "يرجى التحقق من بيانات Gmail.";
    }

    return Response.json(
      {
        success: false,
        message: userMsg,
      },
      { status: 500 }
    );
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch {
        // Ignore lock release errors
      }
    }

    if (client) {
      try {
        if (client.usable) {
          await client.logout();
        } else {
          client.close();
        }
      } catch {
        // Ignore connection close errors
      }
    }
  }
}
