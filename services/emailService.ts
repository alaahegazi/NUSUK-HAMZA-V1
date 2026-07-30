import { EmailSettings, FetchedOtp } from '../types';

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  email: '',
  appPassword: '',
  useSsl: true,
  isConnected: false,
  autoCheck: true,
  checkInterval: 7 // كل 7 ثوانٍ تلقائياً
};

export const emailService = {
  // Test connection to user's IMAP mailbox with App Password
  async testConnection(settings: EmailSettings): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/email/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imapHost: settings.imapHost,
          imapPort: settings.imapPort,
          email: settings.email,
          appPassword: settings.appPassword,
          useSsl: settings.useSsl
        })
      });

      const data = await res.json();
      return {
        success: data.success || false,
        message: data.message || 'فشل الاتصال بالبريد'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'تعذر الاتصال بسيرفر التطبيق. يرجى إعادة المحاولة.'
      };
    }
  },

  // Fetch recent Nusuk verification codes / OTPs
  async fetchOtps(settings: EmailSettings, sinceMinutes = 30): Promise<{ success: boolean; otps: FetchedOtp[]; message?: string }> {
    if (!settings.email || !settings.appPassword) {
      return { success: false, otps: [], message: 'بيانات البريد غير مكتملة' };
    }

    try {
      const res = await fetch('/api/email/fetch-otps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imapHost: settings.imapHost,
          imapPort: settings.imapPort,
          email: settings.email,
          appPassword: settings.appPassword,
          useSsl: settings.useSsl,
          sinceMinutes
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          otps: [],
          message: data.message || 'فشل جلب الأكواد من البريد'
        };
      }

      return {
        success: true,
        otps: data.otps || [],
        message: `تم العثور على ${data.otps?.length || 0} كود تحقق`
      };
    } catch (err: any) {
      return {
        success: false,
        otps: [],
        message: 'خطأ أثناء التواصل مع سيرفر البريد'
      };
    }
  },

  // Save Settings to LocalStorage for given User ID
  saveSettings(userId: string, settings: EmailSettings): void {
    const key = `nusuk_email_settings_${userId}`;
    localStorage.setItem(key, JSON.stringify(settings));
  },

  // Load Settings from LocalStorage
  loadSettings(userId: string, defaultEmail?: string): EmailSettings {
    const key = `nusuk_email_settings_${userId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return {
      ...DEFAULT_EMAIL_SETTINGS,
      email: defaultEmail || ''
    };
  }
};
