import { User, StoredUser, PasswordResetToken } from '../types';

const USERS_STORAGE_KEY = 'nusuk_auth_users';
const SESSION_STORAGE_KEY = 'nusuk_auth_session';
const RESETS_STORAGE_KEY = 'nusuk_auth_resets';

// Helper: Secure Random Salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper: SHA-256 Hashing with Web Crypto API
async function hashValue(value: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value + salt);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Get Stored Users
function getStoredUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Error reading stored users:', err);
    return [];
  }
}

// Helper: Save Stored Users
function saveStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Ensure default demo and primary accounts are seeded if missing
export async function seedDefaultAccountsIfNeeded(): Promise<StoredUser[]> {
  try {
    const users = getStoredUsers();
    let updated = false;

    // 1. Account 1: pharmacydr127@gmail.com / Alaa@1111
    if (!users.some(u => u.email.toLowerCase() === 'pharmacydr127@gmail.com')) {
      const salt1 = 'salt_primary_127';
      const hash1 = await hashValue('Alaa@1111', salt1);
      users.push({
        id: 'usr_primary_admin',
        email: 'pharmacydr127@gmail.com',
        fullName: 'د. علاء - إدارة العمرة',
        agencyName: 'حملة النسك المعتمدة',
        passwordHash: hash1,
        salt: salt1,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        securityQuestion: 'ما هو اسم وكالتك/شركتك الأولى؟',
        securityAnswerHash: await hashValue('النسك', salt1)
      });
      updated = true;
    }

    // 2. Account 2: agency.admin@nusuk-demo.com / Nusuk2026!
    if (!users.some(u => u.email.toLowerCase() === 'agency.admin@nusuk-demo.com')) {
      const salt2 = 'salt_demo_2026';
      const hash2 = await hashValue('Nusuk2026!', salt2);
      users.push({
        id: 'usr_demo_admin',
        email: 'agency.admin@nusuk-demo.com',
        fullName: 'مدير الحملات والخدمات',
        agencyName: 'وكالة الأنوار للعمرة والحج',
        passwordHash: hash2,
        salt: salt2,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        securityQuestion: 'ما هو اسم وكالتك/شركتك الأولى؟',
        securityAnswerHash: await hashValue('الأنوار', salt2)
      });
      updated = true;
    }

    if (updated) {
      saveStoredUsers(users);
    }
    return users;
  } catch (err) {
    console.error('Error seeding default accounts:', err);
    return getStoredUsers();
  }
}

// Automatically seed on import
if (typeof window !== 'undefined') {
  seedDefaultAccountsIfNeeded();
}

// Helper: Get Reset Tokens
function getStoredResets(): PasswordResetToken[] {
  try {
    const data = localStorage.getItem(RESETS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Helper: Save Reset Tokens
function saveStoredResets(resets: PasswordResetToken[]): void {
  localStorage.setItem(RESETS_STORAGE_KEY, JSON.stringify(resets));
}

export const authService = {
  // Check Password Strength
  validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' };
    }
    if (!/[A-Z]/.test(password) && !/[a-z]/.test(password)) {
      return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على أحرف إنجليزية' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' };
    }
    return { isValid: true };
  },

  // Register New User
  async register(
    email: string,
    password: string,
    fullName: string,
    agencyName: string = '',
    securityQuestion?: string,
    securityAnswer?: string
  ): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('يرجى إدخال بريد إلكتروني صحيح');
    }

    if (!fullName.trim()) {
      throw new Error('يرجى إدخال الاسم الكامل');
    }

    const passCheck = this.validatePasswordStrength(password);
    if (!passCheck.isValid) {
      throw new Error(passCheck.message || 'كلمة المرور غير مطابقة للشروط الأمنية');
    }

    const users = getStoredUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول مباشرة');
    }

    const salt = generateSalt();
    const passwordHash = await hashValue(password, salt);
    
    let securityAnswerHash: string | undefined;
    if (securityAnswer && securityAnswer.trim()) {
      securityAnswerHash = await hashValue(securityAnswer.trim().toLowerCase(), salt);
    }

    const newUser: StoredUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      email: cleanEmail,
      fullName: fullName.trim(),
      agencyName: agencyName.trim(),
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      securityQuestion: securityQuestion?.trim(),
      securityAnswerHash
    };

    users.push(newUser);
    saveStoredUsers(users);

    const publicUser: User = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      agencyName: newUser.agencyName,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin
    };

    // Save session
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publicUser));
    return publicUser;
  },

  // Login Existing User
  async login(email: string, password: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
    }

    let users = getStoredUsers();
    let storedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!storedUser) {
      // Try seeding defaults in case of fresh browser session
      users = await seedDefaultAccountsIfNeeded();
      storedUser = users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!storedUser) {
      throw new Error('بيانات الدخول غير صحيحة. تحقق من البريد أو أنشئ حساباً جديداً');
    }

    const inputHash = await hashValue(password, storedUser.salt);
    if (inputHash !== storedUser.passwordHash) {
      throw new Error('كلمة المرور غير صحيحة');
    }

    // Update lastLogin
    storedUser.lastLogin = new Date().toISOString();
    saveStoredUsers(users);

    const publicUser: User = {
      id: storedUser.id,
      email: storedUser.email,
      fullName: storedUser.fullName,
      agencyName: storedUser.agencyName,
      createdAt: storedUser.createdAt,
      lastLogin: storedUser.lastLogin
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(publicUser));
    return publicUser;
  },

  // Request Password Reset Code
  async requestPasswordReset(email: string): Promise<{ code: string; securityQuestion?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('يرجى إدخال البريد الإلكتروني');
    }

    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('لا يوجد حساب مرتبط بهذا البريد الإلكتروني');
    }

    // Generate 6-digit random code securely
    const randomArray = new Uint32Array(1);
    window.crypto.getRandomValues(randomArray);
    const code = (100000 + (randomArray[0] % 900000)).toString();

    const resets = getStoredResets().filter(r => r.email !== cleanEmail);
    resets.push({
      email: cleanEmail,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    saveStoredResets(resets);

    return {
      code,
      securityQuestion: user.securityQuestion
    };
  },

  // Verify Reset Code or Security Answer
  async verifyResetCode(email: string, code: string, securityAnswer?: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const resets = getStoredResets();
    const token = resets.find(r => r.email === cleanEmail && r.code === code.trim());

    if (!token) {
      throw new Error('رمز التحقق غير صحيح');
    }

    if (Date.now() > token.expiresAt) {
      throw new Error('انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد');
    }

    if (securityAnswer && securityAnswer.trim()) {
      const users = getStoredUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (user && user.securityAnswerHash) {
        const answerHash = await hashValue(securityAnswer.trim().toLowerCase(), user.salt);
        if (answerHash !== user.securityAnswerHash) {
          throw new Error('إجابة سؤال الأمان غير صحيحة');
        }
      }
    }

    return true;
  },

  // Reset Password
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await this.verifyResetCode(cleanEmail, code);

    const passCheck = this.validatePasswordStrength(newPassword);
    if (!passCheck.isValid) {
      throw new Error(passCheck.message || 'كلمة المرور غير مطابقة للشروط');
    }

    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (userIndex === -1) {
      throw new Error('المستخدم غير موجود');
    }

    const salt = generateSalt();
    const passwordHash = await hashValue(newPassword, salt);

    users[userIndex].salt = salt;
    users[userIndex].passwordHash = passwordHash;
    saveStoredUsers(users);

    // Remove consumed reset token
    const resets = getStoredResets().filter(r => r.email !== cleanEmail);
    saveStoredResets(resets);
  },

  // Get Currently Logged-In User
  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Logout
  logout(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  // Update Profile
  updateProfile(userId: string, fullName: string, agencyName: string): User {
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('المستخدم غير موجود');
    }

    users[userIndex].fullName = fullName.trim();
    users[userIndex].agencyName = agencyName.trim();
    saveStoredUsers(users);

    const updatedUser: User = {
      id: users[userIndex].id,
      email: users[userIndex].email,
      fullName: users[userIndex].fullName,
      agencyName: users[userIndex].agencyName,
      createdAt: users[userIndex].createdAt,
      lastLogin: users[userIndex].lastLogin
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
    return updatedUser;
  },

  // Change Password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('المستخدم غير موجود');
    }

    const user = users[userIndex];
    const currentHash = await hashValue(currentPassword, user.salt);
    if (currentHash !== user.passwordHash) {
      throw new Error('كلمة المرور الحالية غير صحيحة');
    }

    const passCheck = this.validatePasswordStrength(newPassword);
    if (!passCheck.isValid) {
      throw new Error(passCheck.message || 'كلمة المرور الجديدة غير مطابقة للشروط');
    }

    const newSalt = generateSalt();
    const newHash = await hashValue(newPassword, newSalt);

    users[userIndex].salt = newSalt;
    users[userIndex].passwordHash = newHash;
    saveStoredUsers(users);
  }
};
