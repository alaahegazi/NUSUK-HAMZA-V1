import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

// Enable large body limit for PDF / image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// 3. API Endpoint: Extract Pilgrims from Visa PDF or Image
app.post('/api/extract-visas', async (req, res) => {
  try {
    const { base64Data, mimeType = 'application/pdf' } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم استلام محتوى الملف'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'مفتاح Gemini API غير متاح في بيئة السيرفر'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          {
            text: `Extract all pilgrim data from this document.
          For each individual, I need:
          1. fullName: Full name as written.
          2. passportNumber: Passport number.
          3. visaNumber: Visa number.
          4. dateOfBirth: Date of birth.
          5. gender: Gender (must be 'ذكر' for male or 'أنثى' for female).
          6. phoneNumber: A Saudi mobile number starting with '5' followed by 8 digits (e.g., 512345678). DO NOT include a leading zero, do NOT include +966 or 00966. Exactly 9 digits starting with 5.
          
          Return the data as a clean JSON array of objects.`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              passportNumber: { type: Type.STRING },
              visaNumber: { type: Type.STRING },
              dateOfBirth: { type: Type.STRING },
              gender: { type: Type.STRING, description: "Gender: 'ذكر' or 'أنثى'" },
              phoneNumber: { type: Type.STRING }
            },
            required: ['fullName', 'passportNumber', 'visaNumber', 'dateOfBirth', 'gender', 'phoneNumber']
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      return res.json({ success: true, pilgrims: [] });
    }

    let parsed = JSON.parse(textOutput);
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }

    // Sanitize phone numbers to ensure they strictly start with 5 and have 8 following digits (9 digits total)
    const sanitized = parsed.map((item: any) => {
      let phone = String(item.phoneNumber || '').trim();
      phone = phone.replace(/[^0-9]/g, '');
      if (phone.startsWith('966')) {
        phone = phone.substring(3);
      }
      if (phone.startsWith('0')) {
        phone = phone.substring(1);
      }
      if (!phone.startsWith('5') || phone.length !== 9) {
        const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
        phone = `5${random8Digits}`;
      }

      return {
        fullName: String(item.fullName || '').trim(),
        passportNumber: String(item.passportNumber || '').trim(),
        visaNumber: String(item.visaNumber || '').trim(),
        dateOfBirth: String(item.dateOfBirth || '').trim(),
        gender: item.gender === 'أنثى' ? 'أنثى' : 'ذكر',
        phoneNumber: phone
      };
    });

    return res.json({
      success: true,
      pilgrims: sanitized
    });
  } catch (error: any) {
    console.error('Server Gemini Extraction Error:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل استخراج البيانات من الملف. يرجى التأكد من جودة ووضوح كشف التأشيرات.',
      details: error?.message || String(error)
    });
  }
});

// Vite Middleware for development mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
