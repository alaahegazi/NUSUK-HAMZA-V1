import React, { useState } from 'react';
import { 
  X, Mail, KeyRound, Server, CheckCircle2, AlertCircle, 
  Loader2, ExternalLink, HelpCircle, RefreshCw, Zap, ShieldCheck
} from 'lucide-react';
import { EmailSettings } from '../types';
import { emailService } from '../services/emailService';

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  settings: EmailSettings;
  onSaveSettings: (newSettings: EmailSettings) => void;
}

export const EmailConfigModal: React.FC<EmailConfigModalProps> = ({
  isOpen,
  onClose,
  userId,
  settings,
  onSaveSettings
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'settings' | 'guide'>('settings');

  // Form States
  const [email, setEmail] = useState(settings.email);
  const [appPassword, setAppPassword] = useState(settings.appPassword);
  const [imapHost, setImapHost] = useState(settings.imapHost || 'imap.gmail.com');
  const [imapPort, setImapPort] = useState(settings.imapPort || 993);
  const [autoCheck, setAutoCheck] = useState(settings.autoCheck !== false);
  const [showPassword, setShowPassword] = useState(false);

  // Connection Test Status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTestResult(null);
    setIsTesting(true);

    const tempSettings: EmailSettings = {
      email: email.trim(),
      appPassword,
      imapHost,
      imapPort,
      useSsl: true,
      isConnected: false,
      autoCheck,
      checkInterval: 7
    };

    const result = await emailService.testConnection(tempSettings);
    setIsTesting(false);
    setTestResult(result);

    if (result.success) {
      const updated = { ...tempSettings, isConnected: true, lastCheckTime: new Date().toISOString() };
      emailService.saveSettings(userId, updated);
      onSaveSettings(updated);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: EmailSettings = {
      email: email.trim(),
      appPassword,
      imapHost,
      imapPort,
      useSsl: true,
      isConnected: testResult?.success || settings.isConnected,
      autoCheck,
      checkInterval: 7,
      lastCheckTime: new Date().toISOString()
    };

    emailService.saveSettings(userId, updatedSettings);
    onSaveSettings(updatedSettings);
    onClose();
  };

  // Preset Provider Presets
  const applyPreset = (provider: 'gmail' | 'outlook' | 'yahoo') => {
    if (provider === 'gmail') {
      setImapHost('imap.gmail.com');
      setImapPort(993);
    } else if (provider === 'outlook') {
      setImapHost('outlook.office365.com');
      setImapPort(993);
    } else if (provider === 'yahoo') {
      setImapHost('imap.mail.yahoo.com');
      setImapPort(993);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">ربط البريد لجلب أكواد النسك تلقائياً</h3>
              <p className="text-xs text-slate-400">ربط آمن عبر كلمة مرور التطبيقات (App Password)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-black/20 p-1.5 px-6 gap-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={14} /> إعدادات الربط
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle size={14} /> طريقة استخراج كلمة مرور التطبيقات
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {activeTab === 'settings' && (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold">مزود البريد الإلكتروني السريع:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('gmail')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      imapHost === 'imap.gmail.com'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-black border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    Google / Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('outlook')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      imapHost === 'outlook.office365.com'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-black border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    Outlook / Hotmail
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('yahoo')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      imapHost === 'imap.mail.yahoo.com'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-black border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    Yahoo Mail
                  </button>
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Mail size={14} className="text-emerald-500" /> عنوان البريد الإلكتروني
                </label>
                <input
                  type="email"
                  required
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              {/* App Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                    <KeyRound size={14} className="text-emerald-500" /> كلمة مرور التطبيقات (App Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide')}
                    className="text-[10px] text-emerald-400 hover:underline font-bold"
                  >
                    كيف أحصل عليها؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500/60 pl-24"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-2 py-1"
                  >
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  * ليست كلمة المرور العادية لحسابك، بل هي كلمة المرور المكونة من 16 حرفاً والتي تُولّد خصيصاً للتطبيقات.
                </p>
              </div>

              {/* IMAP Server Settings */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold">سيرفر IMAP</label>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold">المنفذ (Port)</label>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 font-mono text-center"
                  />
                </div>
              </div>

              {/* Auto Check Switch */}
              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Zap size={18} className="text-emerald-500" />
                  <div>
                    <p className="text-xs font-bold text-white">الفحص الآلي المستمر للأكواد</p>
                    <p className="text-[10px] text-slate-400">جلب كود التحقق أوتوماتيكياً بمجرد وصوله للبريد</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(e) => setAutoCheck(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded-lg"
                />
              </div>

              {/* Connection Status Feedback */}
              {testResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{testResult.message}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !email || !appPassword}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                >
                  {isTesting ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  اختبار الاتصال بالسيرفر
                </button>

                <button
                  type="submit"
                  disabled={!email || !appPassword}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-7 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-40"
                >
                  <ShieldCheck size={16} />
                  حفظ إعدادات الربط
                </button>
              </div>
            </form>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <ShieldCheck size={16} /> ماهي كلمة مرور التطبيقات (App Password)؟
                </h4>
                <p className="text-[11px] text-slate-300">
                  هي كلمة مرور مكونة من 16 حرفاً تمنح هذا التطبيق الإذن لقراءة أكواد التحقق الواردة إلى بريدك بأمان تام، دون الحاجة لمشاركة كلمة مرور حسابك الرئيسية.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-black text-white text-sm">خطوات استخراجها من حساب Google (Gmail):</h4>
                <ol className="space-y-2.5 list-decimal list-inside pr-1 text-slate-300">
                  <li className="font-bold">
                    افتح إعدادات الأمان في حسابك على Google بالدخول إلى:
                    <a
                      href="https://myaccount.google.com/security"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline mr-1 inline-flex items-center gap-1 font-mono"
                    >
                      myaccount.google.com/security <ExternalLink size={12} />
                    </a>
                  </li>
                  <li>تأكد من تفعيل <span className="text-white font-bold">"التحقق بظرفين / المصادقة الثنائية" (2-Step Verification)</span>.</li>
                  <li>ابحث في قائمة الأمان عن <span className="text-white font-bold">"كلمات مرور التطبيقات" (App Passwords)</span>.</li>
                  <li>أنشئ كلمة مرور جديدة واكتب اسماً للتطبيق مثل <span className="text-emerald-400 font-mono">"Nusuk OTP"</span>.</li>
                  <li>سيظهر لك مربع يحتوي على 16 حرفاً (مثل: <code className="bg-black border border-white/10 px-1.5 py-0.5 rounded text-emerald-400">abcd efgh ijkl mnop</code>).</li>
                  <li>قم بنسخها ولصقها في حقل "كلمة مرور التطبيقات" بأعلى هذه الصفحة، ثم اضغط على "اختبار الاتصال".</li>
                </ol>
              </div>

              <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                <span className="text-[11px] text-slate-400">هل تستخدم Outlook أو Hotmail؟</span>
                <a
                  href="https://account.live.com/proofs/manage/additional"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 font-bold hover:underline text-[11px] flex items-center gap-1"
                >
                  إعدادات كلمة مرور أوتلوك <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
