import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const app = express();
const PORT = 3000;

app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper: Clean App Password (remove spaces and quotes e.g. "abcd efgh ijkl mnop")
function cleanAppPassword(pass: string): string {
  return (pass || '').replace(/[\s"']/g, '').trim();
}

// Helper: Extract OTP and Recipients from Email Parsed Content
function extractOtpFromMail(parsed: any) {
  const text = (parsed.text || '') + '\n' + (parsed.html || '');
  const subject = parsed.subject || '';
  const fullText = `${subject}\n${text}`;

  // Recipients
  const recipients: string[] = [];
  if (parsed.to) {
    const toArr = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
    toArr.forEach((t: any) => {
      if (t.value) {
        t.value.forEach((addr: any) => {
          if (addr.address) recipients.push(addr.address.toLowerCase());
        });
      } else if (typeof t === 'string') {
        recipients.push(t.toLowerCase());
      }
    });
  }

  // Check headers for Delivered-To or X-Original-To
  if (parsed.headers) {
    const deliveredTo = parsed.headers.get('delivered-to') || parsed.headers.get('x-original-to');
    if (deliveredTo) {
      const addr = String(deliveredTo).toLowerCase().trim();
      if (addr && !recipients.includes(addr)) {
        recipients.push(addr);
      }
    }
  }

  // OTP Code Extraction Regexes
  // Look for explicit Arabic/English OTP phrases
  let extractedCode = '';

  const patterns = [
    // Explicit pattern 1: "رمز التحقق: 123456" or "كود نسك: 123456" or "Verification code is 123456" or "OTP: 123456"
    /(?:كود|رمز|رمز\s+التحقق|كود\s+التحقق|رمز\s+التفعيل|كود\s+نسك|كود\s+التسجيل|تأكيد\s+البريد|Verification\s+Code|OTP|Passcode|Pin\s+code)\s*(?:هو|is|:|=|:|\s|-)*\s*([0-9]{4,6})/i,
    // Explicit pattern 2: "123456 هو كود/رمز"
    /([0-9]{4,6})\s*(?:هو|is)?\s*(?:كود|رمز|كود\s+التحقق|رمز\s+التحقق|OTP|verification)/i,
    // Explicit pattern 3: Standalone 4-6 digit code formatted prominently like <b>123456</b> or "123456"
    /(?:["'<b>\s>])([0-9]{4,6})(?:["'<\/b\s<])/
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const code = match[1];
      // Filter out non-OTP numbers like years or repetitive numbers
      if (code.length >= 4 && code.length <= 6 && !['2024', '2025', '2026', '2027', '1234', '12345', '123456', '0000', '00000', '000000'].includes(code)) {
        extractedCode = code;
        break;
      }
    }
  }

  return {
    otpCode: extractedCode,
    subject,
    sender: parsed.from?.text || parsed.from?.value?.[0]?.address || 'غير معروف',
    recipients,
    receivedAt: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
    fullText
  };
}

// 1. API Endpoint: Test IMAP Connection
app.post('/api/email/test-connection', async (req, res) => {
  const { imapHost, imapPort, email, appPassword, useSsl } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'يرجى إدخال البريد الإلكتروني وكلمة مرور التطبيقات (App Password)' 
    });
  }

  const host = (imapHost || 'imap.gmail.com').trim();
  const port = Number(imapPort) || 993;
  const pass = cleanAppPassword(appPassword);

  const client = new ImapFlow({
    host,
    port,
    secure: useSsl !== false,
    auth: {
      user: email.trim(),
      pass
    },
    logger: false,
    emitLogs: false,
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000
  });

  // Prevent unhandled error event crash
  client.on('error', (err) => {
    console.error('ImapFlow test connection client error:', err?.message || err);
  });

  try {
    await client.connect();
    return res.json({
      success: true,
      message: `تم الاتصال بنجاح بالبريد الإلكتروني (${email}) عبر سيرفر ${host}:${port}`
    });
  } catch (err: any) {
    console.error('IMAP Test Connection Error:', err);
    
    const responseText = err.responseText || '';
    const errMessage = err.message || '';
    const fullText = (responseText + ' ' + errMessage).toLowerCase();

    let userMsg = 'فشل الاتصال بالبريد الإلكتروني. ';

    if (fullText.includes('invalid credentials') || fullText.includes('authenticationfailed') || fullText.includes('command failed')) {
      userMsg += 'كلمة المرور أو البريد غير صحيح. يرجى التأكد من استخدام "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرفاً من إعدادات Google والتأكد من تفعيل المصادقة الثنائية (2-Step Verification).';
    } else if (fullText.includes('disabled') || fullText.includes('imap')) {
      userMsg += 'يرجى التأكد من تفعيل IMAP في إعدادات البريد (Gmail Settings -> Forwarding and POP/IMAP -> Enable IMAP).';
    } else if (fullText.includes('enotfound') || fullText.includes('ehostunreach')) {
      userMsg += `خادم IMAP (${host}) غير موجود أو يتعذر الوصول إليه. تحقق من عنوان السيرفر.`;
    } else if (fullText.includes('etimedout') || fullText.includes('econnrefused')) {
      userMsg += `انتهت مهلة الاتصال بالمنفذ (${port}). تحقق من اتصال الإنترنت أو سيرفر IMAP.`;
    } else {
      userMsg += responseText || errMessage || 'يرجى التحقق من صحة البريد وكلمة مرور التطبيقات.';
    }

    return res.status(400).json({
      success: false,
      message: userMsg
    });
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch (e) {
        // ignore logout errors on closing
      }
    }
  }
});

// 2. API Endpoint: Fetch Latest OTPs from Mailbox
app.post('/api/email/fetch-otps', async (req, res) => {
  const { imapHost, imapPort, email, appPassword, useSsl, sinceMinutes = 30, searchKeywords = ['نسك', 'Nusuk', 'كود', 'رمز', 'Verification'] } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'يرجى توفير البريد الإلكتروني وكلمة مرور التطبيقات' 
    });
  }

  const host = (imapHost || 'imap.gmail.com').trim();
  const port = Number(imapPort) || 993;
  const pass = cleanAppPassword(appPassword);

  const client = new ImapFlow({
    host,
    port,
    secure: useSsl !== false,
    auth: {
      user: email.trim(),
      pass
    },
    logger: false,
    emitLogs: false,
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000
  });

  client.on('error', (err) => {
    console.error('ImapFlow fetch OTPs client error:', err?.message || err);
  });

  try {
    await client.connect();

    // Select INBOX
    const lock = await client.getMailboxLock('INBOX');
    const otpsFetched: any[] = [];

    try {
      // Calculate since date (last N minutes, default 30 mins)
      const sinceDate = new Date(Date.now() - Number(sinceMinutes) * 60 * 1000);

      // Search for recent messages
      const searchCriteria = { since: sinceDate };
      const messages = client.fetch(searchCriteria, { envelope: true, source: true });

      let count = 0;
      for await (let message of messages) {
        if (!message.source) continue;
        count++;
        if (count > 30) break;

        try {
          const parsed = await simpleParser(message.source);
          const extracted = extractOtpFromMail(parsed);

          const fullContent = (extracted.subject + ' ' + extracted.fullText).toLowerCase();
          const defaultKeywords = ['نسك', 'nusuk', 'كود', 'رمز', 'verification', 'otp', 'passcode', 'تحقق', 'تفعيل', 'تسجيل'];
          const activeKeywords = (Array.isArray(searchKeywords) && searchKeywords.length > 0) ? searchKeywords : defaultKeywords;
          const hasKeyword = activeKeywords.some((kw: string) => fullContent.includes(kw.toLowerCase()));

          // Strict check: Must have extracted code AND match OTP verification keywords
          if (extracted.otpCode && hasKeyword) {
            const primaryRecipient = extracted.recipients[0] || email.trim().toLowerCase();

            otpsFetched.push({
              id: 'otp_' + message.uid + '_' + Date.now(),
              recipientEmail: primaryRecipient,
              allRecipients: extracted.recipients,
              otpCode: extracted.otpCode,
              subject: extracted.subject,
              sender: extracted.sender,
              receivedAt: extracted.receivedAt
            });
          }
        } catch (parseErr) {
          console.error('Mail parse error:', parseErr);
        }
      }
    } finally {
      lock.release();
    }

    return res.json({
      success: true,
      count: otpsFetched.length,
      otps: otpsFetched,
      fetchedAt: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Fetch OTPs IMAP Error:', err);
    
    const responseText = err.responseText || '';
    const errMessage = err.message || '';
    const fullText = (responseText + ' ' + errMessage).toLowerCase();

    let userMsg = 'حدث خطأ أثناء جلب البريد الإلكتروني. ';
    if (fullText.includes('invalid credentials') || fullText.includes('authenticationfailed') || fullText.includes('command failed')) {
      userMsg += 'كلمة المرور أو البريد غير صحيح. يرجى التأكد من استخدام "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرفاً.';
    } else {
      userMsg += responseText || errMessage;
    }

    return res.status(500).json({
      success: false,
      message: userMsg
    });
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch (e) {
        // ignore logout errors
      }
    }
  }
});


export default app;
