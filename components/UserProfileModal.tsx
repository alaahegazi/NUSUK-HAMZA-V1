import React, { useState } from 'react';
import { 
  X, User, Building, Lock, Mail, ShieldCheck, 
  CheckCircle2, AlertCircle, Loader2, KeyRound
} from 'lucide-react';
import { User as UserType } from '../types';
import { authService } from '../services/authService';

interface UserProfileModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (user: UserType) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onLogout
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(user.fullName);
  const [agencyName, setAgencyName] = useState(user.agencyName || '');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setIsLoading(true);

    try {
      const updated = authService.updateProfile(user.id, fullName, agencyName);
      setSuccess('تم تحديث بيانات حسابك بنجاح');
      onUserUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsLoading(true);

    try {
      await authService.changePassword(user.id, currentPassword, newPassword);
      setSuccess('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">إعدادات الحساب والأمان</h3>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 bg-black/20 p-1.5 px-6 gap-2">
          <button
            onClick={() => {
              clearAlerts();
              setActiveTab('profile');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={14} /> البيانات الشخصية
          </button>
          <button
            onClick={() => {
              clearAlerts();
              setActiveTab('password');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'password'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock size={14} /> كلمة المرور والأمان
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} /> {success}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <User size={14} className="text-emerald-500" /> الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Building size={14} className="text-emerald-500" /> اسم الوكالة / شركة العمرة
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Mail size={14} className="text-slate-500" /> البريد الإلكتروني (غير قابل للتعديل)
                </label>
                <input
                  type="text"
                  disabled
                  value={user.email}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-slate-400 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-mono">
                  تاريخ التسجيل: {new Date(user.createdAt).toLocaleDateString('ar-SA')}
                </span>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={14} /> : null}
                  حفظ التغيرات
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <KeyRound size={14} className="text-emerald-500" /> كلمة المرور الحالية
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Lock size={14} className="text-emerald-500" /> كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
                  <Lock size={14} className="text-emerald-500" /> تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl py-3 px-4 text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={14} /> : null}
                  تحديث كلمة المرور
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer with Logout Option */}
        <div className="p-4 border-t border-white/5 bg-black/40 flex justify-between items-center">
          <span className="text-[11px] text-slate-500 font-bold">جلسة آمنة ومنفصلة لبياناتك</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
};
