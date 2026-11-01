import type { User } from '../types';
import { requireSupabase } from './supabaseClient';

function toUser(user: any): User {
  return { id: user.id, email: user.email ?? '', fullName: String(user.user_metadata?.full_name ?? user.email ?? ''), agencyName: String(user.user_metadata?.agency_name ?? ''), createdAt: user.created_at ?? new Date().toISOString(), lastLogin: user.last_sign_in_at };
}

export const authService = {
  validatePasswordStrength(password: string) {
    if (password.length < 8) return { isValid: false, message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' };
    if (!/[A-Za-z]/.test(password)) return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على أحرف إنجليزية' };
    if (!/[0-9]/.test(password)) return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' };
    return { isValid: true };
  },
  async register(email: string, password: string, fullName: string, agencyName = ''): Promise<User> {
    const check = this.validatePasswordStrength(password);
    if (!email.trim() || !email.includes('@')) throw new Error('يرجى إدخال بريد إلكتروني صحيح');
    if (!fullName.trim()) throw new Error('يرجى إدخال الاسم الكامل');
    if (!check.isValid) throw new Error(check.message);
    const { data, error } = await requireSupabase().auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: fullName.trim(), agency_name: agencyName.trim() } } });
    if (error) throw error;
    if (!data.user) throw new Error('تعذر إنشاء الحساب');
    if (!data.session) throw new Error('تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده ثم سجّل الدخول.');
    return toUser(data.user);
  },
  async login(email: string, password: string): Promise<User> {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    if (!data.user) throw new Error('تعذر تسجيل الدخول');
    return toUser(data.user);
  },
  async requestPasswordReset(email: string): Promise<{ code: string }> {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
    if (error) throw error;
    return { code: '' };
  },
  async verifyResetCode(): Promise<boolean> {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('افتح رابط استعادة كلمة المرور المرسل إلى بريدك الإلكتروني أولاً');
    return true;
  },
  async resetPassword(_email: string, _code: string, newPassword: string): Promise<void> {
    const check = this.validatePasswordStrength(newPassword);
    if (!check.isValid) throw new Error(check.message);
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    return data.session?.user ? toUser(data.session.user) : null;
  },
  async logout(): Promise<void> {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
  async updateProfile(_userId: string, fullName: string, agencyName: string): Promise<User> {
    const { data, error } = await requireSupabase().auth.updateUser({ data: { full_name: fullName.trim(), agency_name: agencyName.trim() } });
    if (error) throw error;
    if (!data.user) throw new Error('تعذر تحديث الملف الشخصي');
    return toUser(data.user);
  },
  async changePassword(_userId: string, _currentPassword: string, newPassword: string): Promise<void> {
    const check = this.validatePasswordStrength(newPassword);
    if (!check.isValid) throw new Error(check.message);
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    if (error) throw error;
  }
};
