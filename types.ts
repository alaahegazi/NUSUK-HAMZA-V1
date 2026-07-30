
export interface User {
  id: string;
  email: string;
  fullName: string;
  agencyName?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface StoredUser extends User {
  passwordHash: string;
  salt: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

export interface PasswordResetToken {
  email: string;
  code: string;
  expiresAt: number;
}

export type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export enum TaskStatus {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  READY_TO_START = 'READY_TO_START',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface EmailSettings {
  imapHost: string;
  imapPort: number;
  email: string;
  appPassword: string;
  useSsl: boolean;
  isConnected: boolean;
  autoCheck: boolean;
  checkInterval: number; // in seconds
  lastCheckTime?: string;
}

export interface FetchedOtp {
  id: string;
  recipientEmail: string;
  allRecipients?: string[];
  otpCode: string;
  subject: string;
  sender: string;
  receivedAt: string;
  matchedPassportNumber?: string;
}

export interface VisaData {
  fullName: string;
  passportNumber: string;
  visaNumber: string;
  dateOfBirth: string;
  gender: 'ذكر' | 'أنثى' | string;
  phoneNumber: string; // الرقم السعودي العشوائي
  generatedEmail: string; // البريد المولد بنظام Plus Addressing
  nationality?: string;
  otpCode?: string; // كود التحقق المستخرج تلقائياً
  otpReceivedAt?: string; // وقت استلام كود التحقق
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface AutomationTask {
  id: string;
  status: TaskStatus;
  data: VisaData;
  groupId?: string; // لربط المهمة بالمجموعة
  accountCreated?: boolean; // لتتبع حالة إنشاء الحساب
  logs: { timestamp: string; message: string; type: 'info' | 'success' | 'error' }[];
}

