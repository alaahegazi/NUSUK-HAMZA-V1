import React, { useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface OtpCardFieldProps {
  otpCode?: string;
  otpReceivedAt?: string;
  generatedEmail: string;
  isFetching: boolean;
  onFetchSingleOtp: () => void;
  onSetManualOtp: (code: string) => void;
}

export const OtpCardField: React.FC<OtpCardFieldProps> = ({
  otpCode,
  otpReceivedAt,
  generatedEmail,
  isFetching,
  onFetchSingleOtp,
  onSetManualOtp
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const handleCopy = () => {
    if (!otpCode) return;
    navigator.clipboard.writeText(otpCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onSetManualOtp(manualCode.trim());
      setIsEditing(false);
      setManualCode('');
    }
  };

  // Format time relative or simple string
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      otpCode 
        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
        : 'bg-white/[0.02] border-white/5'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className={otpCode ? 'text-emerald-400' : 'text-slate-500'} />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            كود التحقق الخاص بنسك (OTP)
          </span>
          {otpCode && (
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Sparkles size={10} /> تم الجلب من البريد
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onFetchSingleOtp}
            disabled={isFetching}
            className="text-[10px] text-slate-400 hover:text-emerald-400 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
            title="جلب الكود من البريد الآن"
          >
            {isFetching ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            <span>فحص</span>
          </button>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              {otpCode ? 'تعديل' : 'إدخال يدوياً'}
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveManual} className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="أدخل كود التحقق..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
            autoFocus
          />
          <button
            type="submit"
            className="bg-emerald-500 text-black px-3 py-1.5 rounded-xl text-xs font-black hover:bg-emerald-400"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-white/5 text-slate-400 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-white/10"
          >
            إلغاء
          </button>
        </form>
      ) : otpCode ? (
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black font-mono text-emerald-400 tracking-widest bg-black/40 px-3 py-1 rounded-xl border border-emerald-500/30">
              {otpCode}
            </span>
            {otpReceivedAt && (
              <span className="text-[10px] text-slate-500 font-bold">
                استلم {formatTime(otpReceivedAt)}
              </span>
            )}
          </div>

          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
              copied
                ? 'bg-emerald-500 text-black font-black'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} /> تم النسخ!
              </>
            ) : (
              <>
                <Copy size={14} /> نسخ الكود
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-slate-500 py-1">
          <span className="text-[11px] flex items-center gap-1.5 italic">
            <AlertCircle size={13} className="text-amber-500/70" />
            في انتظار وصول الكود للبريد المولد...
          </span>
          <button
            onClick={onFetchSingleOtp}
            className="text-[11px] text-emerald-400 font-bold hover:underline"
          >
            جلب الكود الآن
          </button>
        </div>
      )}
    </div>
  );
};
