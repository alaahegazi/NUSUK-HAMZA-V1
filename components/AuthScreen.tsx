import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Mail, User, Building, Eye, EyeOff, 
  ArrowRight, KeyRound, CheckCircle2, AlertCircle, Loader2, Sparkles, HelpCircle
} from 'lucide-react';
import { AuthMode, User as UserType } from '../types';
import { authService } from '../services/authService';

interface AuthScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('ما هو اسم وكالتك/شركتك الأولى؟');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  // Reset Password States
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [securityQuestionPrompt, setSecurityQuestionPrompt] = useState<string | null>(null);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const user = await authService.login(email, password);
      setSuccessMsg(`مرحباً بك مجدداً، ${user.fullName}`);
      setTimeout(() => {
        onLoginSuccess(user);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsLoading(true);

    try {
      const user = await authService.register(
        email,
        password,
        fullName,
        agencyName,
        securityQuestion,
        securityAnswer
      );
      setSuccessMsg('تم إنشاء الحساب بنجاح! يتم الآن توجيهك...');
      setTimeout(() => {
        onLoginSuccess(user);
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const res = await authService.requestPasswordReset(email);
      setGeneratedCode(res.code);
      if (res.securityQuestion) {
        setSecurityQuestionPrompt(res.securityQuestion);
      }
      setSuccessMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. افتح الرابط ثم ارجع لإدخال كلمة المرور الجديدة.');
      setMode('RESET_PASSWORD');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل طلب إعادة التعيين');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(email, resetCode, password);
      setSuccessMsg('تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بها.');
      setTimeout(() => {
        setMode('LOGIN');
        setPassword('');
        setConfirmPassword('');
        setResetCode('');
        setGeneratedCode(null);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-slate-200 font-['Cairo'] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#080808] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Header Branding */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center bg-emerald-500 p-3.5 rounded-2xl shadow-xl shadow-emerald-500/20 mb-1">
            <ShieldCheck className="text-black" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">نظام النسك الذكي Pro</h1>
            <p className="text-xs text-emerald-500/80 font-bold tracking-widest uppercase mt-1">
              Secure Authentication Engine
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMsg}</div>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <Mail size={14} className="text-emerald-500" /> البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Lock size={14} className="text-emerald-500" /> كلمة المرور
                </label>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode('FORGOT_PASSWORD');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60 transition-all placeholder:text-slate-600 pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 transition-all active:scale-98 disabled:opacity-50 mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={18} />}
              تسجيل الدخول الآمن
            </button>

            {/* Switch to Register */}
            <div className="pt-4 border-t border-white/5 text-center space-y-3">
              <p className="text-xs text-slate-400">
                ليس لديك حساب بعد؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode('REGISTER');
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-black underline underline-offset-4 mr-1"
                >
                  إنشاء حساب جديد
                </button>
              </p>

              </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <User size={14} className="text-emerald-500" /> الاسم الكامل
              </label>
              <input
                type="text"
                required
                placeholder="عبدالرحمن محمد"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <Building size={14} className="text-emerald-500" /> اسم الوكالة / شركة العمرة
              </label>
              <input
                type="text"
                placeholder="وكالة الوفاء للعمرة"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <Mail size={14} className="text-emerald-500" /> البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                placeholder="agency@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  <Lock size={13} className="text-emerald-500" /> كلمة المرور
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-3 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  <Lock size={13} className="text-emerald-500" /> تأكيد كلمة المرور
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-3 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>

            {/* Password rules indicator */}
            <div className="text-[10px] text-slate-500 space-y-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
              <p className="font-bold text-slate-400 mb-1">متطلبات الأمان:</p>
              <div className="flex items-center gap-2">
                <span className={password.length >= 8 ? 'text-emerald-400' : 'text-slate-600'}>● 8 حروف على الأقل</span>
                <span className={/[0-9]/.test(password) ? 'text-emerald-400' : 'text-slate-600'}>● يحتوي رقم</span>
              </div>
            </div>

            {/* Security Question for Easy Reset */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <HelpCircle size={14} className="text-emerald-500" /> سؤال أمان اختياري للاستعادة
              </label>
              <input
                type="text"
                placeholder="السؤال: ما اسم أول وكالة عملت بها؟"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-2.5 px-3 text-xs text-white"
              />
              <input
                type="text"
                placeholder="الإجابة..."
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-2.5 px-3 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 transition-all active:scale-98 disabled:opacity-50 mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <User size={18} />}
              إنشاء الحساب الجديد
            </button>

            <div className="pt-3 text-center border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('LOGIN');
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                لديك حساب بالفعل؟ <span className="text-emerald-400 font-bold">تسجيل الدخول</span>
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleRequestResetCode} className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">استعادة كلمة المرور</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                أدخل البريد الإلكتروني المرتبط بحسابك لاستلام رمز التحقق الآمن الخاص بإنشاء كلمة مرور جديدة.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                <Mail size={14} className="text-emerald-500" /> البريد الإلكتروني المسجل
              </label>
              <input
                type="email"
                required
                placeholder="name@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={18} />}
              إرسال رمز التحقق
            </button>

            <div className="pt-3 text-center border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('LOGIN');
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowRight size={14} /> العودة لتسجيل الدخول
              </button>
            </div>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {mode === 'RESET_PASSWORD' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">تعيين كلمة المرور الجديدة</h2>
              <p className="text-xs text-slate-400">بعد فتح رابط الاستعادة من بريدك الإلكتروني، أدخل كلمة المرور الجديدة.</p>
            </div>

            {/* Generated Code Display for preview demo accessibility */}
            {generatedCode && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-1">
                <p className="text-[10px] text-emerald-400 font-bold">رمز التحقق الآمن المولّد (لغرض التجربة):</p>
                <p className="text-2xl font-black text-white font-mono tracking-widest">{generatedCode}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold">رمز الاستعادة (اتركه فارغاً عند استخدام رابط البريد)</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-center text-lg font-mono tracking-widest text-emerald-400 font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            {securityQuestionPrompt && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold">{securityQuestionPrompt}</label>
                <input
                  type="text"
                  placeholder="الإجابة..."
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-2.5 px-3 text-xs text-white"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold">كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold">تأكيد كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={18} />}
              حفظ كلمة المرور وتفعيل الحساب
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
