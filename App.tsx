import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, Loader2, FileText, Trash2, 
  ShieldCheck, UserPlus, QrCode, User as UserIcon, 
  CreditCard, Calendar, Smartphone, Copy, CheckCircle2, Search, Mail, Info,
  Users, Folder, FolderPlus, Plus, ChevronLeft, LogOut, Settings, Building,
  KeyRound, Zap, RefreshCw, Inbox, Sparkles, Check, AlertCircle, ExternalLink
} from 'lucide-react';
import { AutomationTask, TaskStatus, VisaData, Group, User, EmailSettings } from './types';
import { extractBulkIdentityInfo } from './services/geminiService';
import { authService } from './services/authService';
import { emailService } from './services/emailService';
import { AuthScreen } from './components/AuthScreen';
import { UserProfileModal } from './components/UserProfileModal';
import { EmailConfigModal } from './components/EmailConfigModal';
import { OtpCardField } from './components/OtpCardField';

const App: React.FC = () => {
  // حالة المستخدم الحالي والجلسة الآمنة
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // مفاتيح التخزين المخصصة لكل مستخدم لضمان خصوصية البيانات وعزلها
  const getTasksKey = (uid?: string) => uid ? `nusuk_tasks_${uid}` : 'nusuk_tasks';
  const getGroupsKey = (uid?: string) => uid ? `nusuk_groups_${uid}` : 'nusuk_groups';
  const getSelectedGroupKey = (uid?: string) => uid ? `nusuk_selected_group_${uid}` : 'nusuk_selected_group';
  const getMainEmailKey = (uid?: string) => uid ? `nusuk_main_email_${uid}` : 'nusuk_main_email';

  // تحميل البيانات من LocalStorage مع الربط بمعرف المستخدم
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('general');
  const [mainEmail, setMainEmail] = useState('');

  // إعدادات البريد الإلكتروني وربط كلمة مرور التطبيقات
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    const uid = currentUser?.id || '';
    const email = currentUser?.email || '';
    return emailService.loadSettings(uid, email);
  });
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isFetchingOtps, setIsFetchingOtps] = useState(false);
  const [lastOtpSync, setLastOtpSync] = useState<string | null>(null);
  const [otpSyncMessage, setOtpSyncMessage] = useState<string | null>(null);

  // عند تغيير المستخدم المسجل، نقوم بتحميل بياناته الخاصة
  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.id;
    
    // 1. تحميل المهام
    const savedTasks = localStorage.getItem(getTasksKey(uid));
    setTasks(savedTasks ? JSON.parse(savedTasks) : []);

    // 2. تحميل المجموعات
    const savedGroups = localStorage.getItem(getGroupsKey(uid));
    setGroups(savedGroups ? JSON.parse(savedGroups) : [
      { id: 'general', name: 'المجموعة العامة', createdAt: new Date().toISOString() }
    ]);

    // 3. تحميل المجموعة المحددة
    const savedSelectedGroup = localStorage.getItem(getSelectedGroupKey(uid));
    setSelectedGroupId(savedSelectedGroup || 'general');

    // 4. تحميل البريد الإلكتروني الأساسي
    const savedMainEmail = localStorage.getItem(getMainEmailKey(uid));
    const finalEmail = savedMainEmail || currentUser.email || '';
    setMainEmail(finalEmail);

    // 5. تحميل إعدادات البريد
    const loadedSettings = emailService.loadSettings(uid, finalEmail);
    setEmailSettings(loadedSettings);
  }, [currentUser]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'created' | 'not_created'>('all');
  
  // حالات إنشاء مجموعة جديدة من الواجهة مباشرة
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // حفظ البيانات في LocalStorage الخاصة بالمستخدم الحالي عند كل تحديث
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getTasksKey(currentUser.id), JSON.stringify(tasks));
  }, [tasks, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getGroupsKey(currentUser.id), JSON.stringify(groups));
  }, [groups, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getSelectedGroupKey(currentUser.id), selectedGroupId);
  }, [selectedGroupId, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getMainEmailKey(currentUser.id), mainEmail);
  }, [mainEmail, currentUser]);

  // Handle Logout
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsProfileModalOpen(false);
  };

  // وظيفة لتوليد البريد الفريد بنظام Plus Addressing
  const generatePlusEmail = (baseEmail: string, identifier: string) => {
    if (!baseEmail || !baseEmail.includes('@')) return baseEmail;
    const [user, domain] = baseEmail.split('@');
    // تنظيف المعرف من المسافات والرموز
    const cleanId = identifier.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${user}+${cleanId}@${domain}`;
  };

  // تحديث البريد الإلكتروني لجميع المعتمرين عند تغيير البريد الأساسي
  useEffect(() => {
    if (tasks.length > 0 && mainEmail.includes('@')) {
      setTasks(prev => prev.map(task => ({
        ...task,
        data: {
          ...task.data,
          generatedEmail: generatePlusEmail(mainEmail, task.data.passportNumber)
        }
      })));
    }
  }, [mainEmail]);

  // وظيفة فحص وجلب أكواد التحقق من البريد
  const handleFetchOtps = async (manual = false) => {
    if (!emailSettings.email || !emailSettings.appPassword) {
      if (manual) setIsEmailModalOpen(true);
      return;
    }

    setIsFetchingOtps(true);
    const result = await emailService.fetchOtps(emailSettings, 30);
    setIsFetchingOtps(false);

    if (result.success) {
      const timeStr = new Date().toLocaleTimeString('ar-SA');
      setLastOtpSync(timeStr);

      if (result.otps && result.otps.length > 0) {
        setTasks(prevTasks => {
          let matchedCount = 0;
          const newTasks = prevTasks.map(task => {
            const taskEmail = (task.data.generatedEmail || '').toLowerCase();
            const passport = (task.data.passportNumber || '').toLowerCase();
            const visa = (task.data.visaNumber || '').toLowerCase();
            
            // البحث عن كود مطابق تماماً للمعتمر بواسطة بريد التسجيل أو رقم الجواز أو التأشيرة
            const match = result.otps.find(otp => {
              const recip = (otp.recipientEmail || '').toLowerCase();
              const allRecips = (otp.allRecipients || []).map((r: any) => String(r).toLowerCase());
              const fullText = (otp.subject + ' ' + (otp as any).fullText).toLowerCase();

              const emailMatches = (taskEmail && taskEmail.includes('@')) && 
                (recip === taskEmail || allRecips.includes(taskEmail) || recip.includes(passport));
              
              const textMatches = (passport && passport.length > 3 && fullText.includes(passport)) ||
                                  (visa && visa.length > 3 && fullText.includes(visa));

              return emailMatches || textMatches;
            });

            if (match && match.otpCode) {
              matchedCount++;
              return {
                ...task,
                data: {
                  ...task.data,
                  otpCode: match.otpCode,
                  otpReceivedAt: match.receivedAt
                }
              };
            }
            return task;
          });

          return newTasks;
        });

        if (manual) {
          setOtpSyncMessage(`تم العثور على ${result.otps.length} كود تحقق فعلي في صندوق الوارد!`);
          setTimeout(() => setOtpSyncMessage(null), 4000);
        }
      } else if (manual) {
        setOtpSyncMessage('لا توجد أكواد نسك جديدة في صندوق الوارد حالياً');
        setTimeout(() => setOtpSyncMessage(null), 3000);
      }
    } else if (manual) {
      setOtpSyncMessage(result.message || 'خطأ أثناء الاتصال بالبريد');
      setTimeout(() => setOtpSyncMessage(null), 4000);
    }
  };

  // المراقبة التلقائية والفحص كل 7 ثوانٍ
  useEffect(() => {
    if (!currentUser || !emailSettings.isConnected || !emailSettings.autoCheck) return;

    // تشغيل فحص فوري
    handleFetchOtps(false);

    // مؤقت فحص دوري كل 7 ثوانٍ
    const interval = setInterval(() => {
      handleFetchOtps(false);
    }, 7000);

    return () => clearInterval(interval);
  }, [currentUser, emailSettings.isConnected, emailSettings.autoCheck, emailSettings.email, emailSettings.appPassword]);

  // إدخال يدوياً لكود معتمر معين
  const handleSetManualOtp = (taskId: string, code: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, data: { ...t.data, otpCode: code, otpReceivedAt: new Date().toISOString() } }
        : t
    ));
  };

  // رفع ملف التأشيرات
  const handleVisaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const data = await extractBulkIdentityInfo(base64, file.type);
        
        // ربط التأشيرات المرفوعة بالمجموعة المحددة حالياً
        const activeGroup = selectedGroupId === 'all' ? (groups[0]?.id || 'general') : selectedGroupId;

        const newTasks: AutomationTask[] = data.map(v => ({
          id: Math.random().toString(36).substr(2, 9),
          status: TaskStatus.COMPLETED,
          groupId: activeGroup,
          accountCreated: false,
          data: {
            ...v,
            generatedEmail: generatePlusEmail(mainEmail, v.passportNumber)
          },
          logs: []
        }));

        setTasks(prev => [...prev, ...newTasks]);
      } catch (err) {
        alert(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
      } finally {
        setIsExtracting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleAccountCreated = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, accountCreated: !t.accountCreated } : t
    ));
  };

  const moveTaskToGroup = (taskId: string, targetGroupId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, groupId: targetGroupId } : t
    ));
  };

  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    const newGroup: Group = {
      id: Math.random().toString(36).substr(2, 9),
      name: newGroupName.trim(),
      createdAt: new Date().toISOString()
    };
    
    setGroups(prev => [...prev, newGroup]);
    setSelectedGroupId(newGroup.id);
    setNewGroupName("");
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = (id: string) => {
    if (id === 'general') return;
    if (window.confirm("هل أنت متأكد من حذف هذه المجموعة؟ سيتم نقل جميع المعتمرين المضافين إليها إلى المجموعة العامة.")) {
      setGroups(prev => prev.filter(g => g.id !== id));
      setTasks(prev => prev.map(t => t.groupId === id ? { ...t, groupId: 'general' } : t));
      if (selectedGroupId === id) {
        setSelectedGroupId('general');
      }
    }
  };

  // إذا لم يكن هناك مستخدم مسجل دخول، نعرض شاشة المصادقة الآمنة
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // تصفية المهام بناءً على المجموعة، حالة الحساب، والبحث
  const filteredTasks = tasks.filter(t => {
    if (selectedGroupId !== 'all' && t.groupId !== selectedGroupId) return false;
    if (statusFilter === 'created' && !t.accountCreated) return false;
    if (statusFilter === 'not_created' && t.accountCreated) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      t.data.fullName.toLowerCase().includes(searchLower) || 
      t.data.passportNumber.includes(searchTerm)
    );
  });

  // حساب إحصائيات المجموعة المحددة حالياً
  const activeGroupTasks = selectedGroupId === 'all' ? tasks : tasks.filter(t => t.groupId === selectedGroupId);
  const activeGroupTotal = activeGroupTasks.length;
  const activeGroupCreated = activeGroupTasks.filter(t => t.accountCreated).length;
  const activeGroupNotCreated = activeGroupTotal - activeGroupCreated;

  return (
    <div className="min-h-screen bg-[#020202] text-slate-200 font-['Cairo'] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-[#080808] border-l border-white/5 p-6 flex flex-col gap-6 shrink-0 custom-scrollbar overflow-y-auto">
        
        {/* App Title Header */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="text-black" />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-black text-white uppercase">مستخرج البيانات</h1>
            <span className="text-[10px] text-emerald-500/50 font-bold tracking-widest">NUSUK PRO AUTH</span>
          </div>
        </div>

        {/* User Account Card */}
        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl shrink-0">
              <UserIcon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white truncate">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                {currentUser.agencyName ? (
                  <>
                    <Building size={10} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{currentUser.agencyName}</span>
                  </>
                ) : (
                  currentUser.email
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-xl transition-colors"
              title="إعدادات الحساب"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* كارت ربط البريد الإلكتروني وكلمة مرور التطبيقات */}
        <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
          emailSettings.isConnected 
            ? 'bg-emerald-500/10 border-emerald-500/20' 
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className={emailSettings.isConnected ? 'text-emerald-400' : 'text-amber-500'} />
              <span className="text-xs font-bold text-white">ربط البريد لجلب الكود</span>
            </div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
              emailSettings.isConnected 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/20 text-amber-500'
            }`}>
              {emailSettings.isConnected ? '🟢 متصل' : '⚪ غير مربوط'}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 leading-tight">
            {emailSettings.isConnected 
              ? `مرتبط بـ ${emailSettings.email} (استماع تلقائي للأكواد)` 
              : 'ربط بريدك بكلمة مرور التطبيقات للالتقاط التلقائي لكود نسك'}
          </p>

          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-all"
          >
            <Settings size={14} className="text-emerald-500" />
            {emailSettings.isConnected ? 'إعدادات ربط البريد' : 'ربط كلمة مرور التطبيقات الآن'}
          </button>
        </div>

        {/* حقل البريد الأساسي */}
        <div className="space-y-3">
          <label className="text-xs text-slate-500 font-bold flex items-center gap-2">
            <Mail size={14} className="text-emerald-500"/>
            البريد الأساسي (للاستقبال)
          </label>
          <input 
            type="email" 
            placeholder="example@gmail.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-emerald-400 font-bold"
            value={mainEmail}
            onChange={(e) => setMainEmail(e.target.value)}
          />
          <p className="text-[9px] text-slate-600 leading-tight">
            * سيتم توليد بريد "مستعار" لكل معتمر، وستصل جميع الرسائل إلى هذا البريد الأساسي.
          </p>
        </div>

        {/* قسم المجموعات المنظمة */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
              <Folder size={14} className="text-emerald-500"/>
              تنظيم المجموعات ({groups.length})
            </label>
            <button 
              onClick={() => setIsCreatingGroup(!isCreatingGroup)}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-black flex items-center gap-1 transition-colors"
            >
              <FolderPlus size={13}/>
              مجموعة جديدة
            </button>
          </div>

          {/* إضافة مجموعة جديدة بشكل أنيق */}
          {isCreatingGroup && (
            <form onSubmit={handleAddGroupSubmit} className="space-y-2 p-3 bg-white/[0.02] border border-emerald-500/10 rounded-2xl">
              <input
                type="text"
                placeholder="أدخل اسم المجموعة..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50 text-white font-bold"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 text-black py-1.5 rounded-lg text-[10px] font-black hover:bg-emerald-400"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupName("");
                  }}
                  className="flex-1 bg-white/5 text-slate-400 py-1.5 rounded-lg text-[10px] font-black hover:bg-white/10"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {/* قائمة المجموعات النشطة */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            <button
              onClick={() => setSelectedGroupId('all')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-right border ${
                selectedGroupId === 'all' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={14}/>
                <span>جميع المعتمرين</span>
              </div>
              <span className="bg-white/5 px-2 py-0.5 rounded-full text-[10px] text-slate-400">
                {tasks.length}
              </span>
            </button>

            {groups.map(g => {
              const groupTasks = tasks.filter(t => t.groupId === g.id);
              const createdCount = groupTasks.filter(t => t.accountCreated).length;
              return (
                <div 
                  key={g.id}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border group/group-item ${
                    selectedGroupId === g.id 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
                  }`}
                >
                  <button
                    onClick={() => setSelectedGroupId(g.id)}
                    className="flex-1 text-right flex items-center gap-2 min-w-0 py-1"
                  >
                    <Folder size={14} className={selectedGroupId === g.id ? 'text-emerald-400' : 'text-slate-500'}/>
                    <span className="truncate">{g.name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="bg-white/5 px-2 py-0.5 rounded-full text-[10px] text-slate-400 font-mono">
                      {createdCount}/{groupTasks.length}
                    </span>
                    {g.id !== 'general' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(g.id);
                        }}
                        className="opacity-0 group-hover/group-item:opacity-100 text-slate-500 hover:text-red-500 transition-all p-1"
                        title="حذف المجموعة"
                      >
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* إحصائيات المجموعة النشطة */}
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-bold">إحصائيات المجموعة المحددة</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-2xl font-black text-emerald-500">{activeGroupTotal}</p>
              <p className="text-[10px] text-slate-500">إجمالي المعتمرين</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-2xl font-black text-blue-500">{activeGroupCreated}</p>
              <p className="text-[10px] text-slate-500 font-bold">تم إنشاء حساب</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 space-y-4">
           <div className="flex items-center gap-3 text-emerald-500">
             <Info size={18}/>
             <span className="text-xs font-black">تقنية الربط الذكي والخصوصية</span>
           </div>
           <p className="text-[11px] text-slate-400 leading-relaxed">
             بيانات حزمة التأشيرات والمجموعات محفوظة بأمان ومشفرة محلياً في حسابك الآمن على هذا الجهاز.
           </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-4xl font-black text-white tracking-tighter">أداة الاستخراج الذكية</h2>
                {selectedGroupId !== 'all' && (
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold">
                    {groups.find(g => g.id === selectedGroupId)?.name || 'المجموعة العامة'}
                  </span>
                )}
              </div>
              <p className="text-slate-500">استخراج منظم ودقيق لبيانات المعتمرين مع بريد إلكتروني فريد وجلب تلقائي لأكواد التحقق</p>
            </div>
            
            <div className="flex gap-4 w-full lg:w-auto">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleVisaUpload} 
                className="hidden" 
                accept=".pdf,image/*" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="flex-1 lg:flex-none bg-emerald-500 text-black px-10 py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-2xl hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {isExtracting ? <Loader2 className="animate-spin" size={20}/> : <FileText size={20}/>}
                رفع تأشيرات PDF للمجموعة المحددة
              </button>
            </div>
          </header>

          {/* شريط حالة جلب أكواد OTP التلقائي */}
          <div className="p-4 bg-[#0c0c0c] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                emailSettings.isConnected 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}>
                <Zap size={20} className={emailSettings.isConnected && emailSettings.autoCheck ? 'animate-pulse' : ''} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-white">مستقبل أكواد النسك التلقائي (OTP Engine)</h4>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                    emailSettings.isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {emailSettings.isConnected ? 'مستمع نشط 🟢' : 'غير مربوط ⚪'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {emailSettings.isConnected 
                    ? `جلب الكود تلقائياً من ${emailSettings.email} ${lastOtpSync ? `(آخر فحص: ${lastOtpSync})` : ''}`
                    : 'قم بربط بريدك بكلمة مرور التطبيقات لالتقاط كود التحقق أوتوماتيكياً'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {otpSyncMessage && (
                <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 animate-fade-in">
                  {otpSyncMessage}
                </span>
              )}
              <button
                onClick={() => handleFetchOtps(true)}
                disabled={isFetchingOtps}
                className="flex-1 sm:flex-none bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isFetchingOtps ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                فحص الأكواد الآن
              </button>
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                title="إعدادات البريد وكلمة مرور التطبيقات"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* شريط التحكم، تبويبات تصفية حالة إنشاء الحساب، والبحث */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* تبويبات الفلترة السريعة (الكل، تم الإنشاء، لم يتم الإنشاء) */}
              <div className="flex bg-[#0c0c0c] p-1.5 rounded-2xl border border-white/5 self-start">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === 'all' 
                      ? 'bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الكل ({activeGroupTotal})
                </button>
                <button
                  onClick={() => setStatusFilter('created')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === 'created' 
                      ? 'bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  تم إنشاء حساب ({activeGroupCreated})
                </button>
                <button
                  onClick={() => setStatusFilter('not_created')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === 'not_created' 
                      ? 'bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  لم يتم الإنشاء ({activeGroupNotCreated})
                </button>
              </div>

              {/* الاسم المختار للمجموعة حالياً لسهولة التصفح */}
              <div className="text-right px-1">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">المجموعة المستهدفة حالياً</span>
                <span className="text-sm text-emerald-400 font-black">
                  {selectedGroupId === 'all' ? 'جميع المجموعات (مشترك)' : groups.find(g => g.id === selectedGroupId)?.name || 'المجموعة العامة'}
                </span>
              </div>
            </div>

            {/* مربع البحث الذكي */}
            {tasks.length > 0 && (
              <div className="relative group">
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20}/>
                <input 
                  type="text"
                  placeholder="ابحث بالاسم أو رقم الجواز في المجموعة الحالية..."
                  className="w-full bg-[#0c0c0c] border border-white/5 rounded-2xl py-5 pr-14 pl-6 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* شبكة البيانات المستخرجة */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full h-80 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-slate-700">
                <UserPlus size={48} className="opacity-10 mb-4"/>
                <p className="text-xl font-bold opacity-20">لا توجد سجلات مطابقة في المجموعة المحددة...</p>
                <p className="text-xs opacity-20 mt-2">قم برفع كشوفات تأشيرات لتعبئة المجموعة ببيانات المعتمرين.</p>
              </div>
            ) : (
              filteredTasks.map((task, idx) => (
                <div key={task.id} className="bg-[#0c0c0c] border border-white/5 p-6 rounded-[2.5rem] space-y-4 hover:border-emerald-500/40 transition-all group relative overflow-hidden">
                   
                   {/* رأس بطاقة المعتمر */}
                   <div className="flex justify-between items-center mb-2 gap-4">
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full uppercase tracking-widest">سجل رقم #{tasks.length - idx}</span>
                       
                       {/* قائمة تبديل المجموعة */}
                       <select 
                         value={task.groupId || 'general'} 
                         onChange={(e) => moveTaskToGroup(task.id, e.target.value)}
                         className="bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold rounded-full px-2.5 py-1 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                       >
                         {groups.map(g => (
                           <option key={g.id} value={g.id} className="bg-[#0c0c0c] text-slate-300">
                             {g.name}
                           </option>
                         ))}
                       </select>
                     </div>

                     {/* حالة إنشاء الحساب */}
                     <div className="flex items-center gap-2">
                       <button
                         onClick={() => toggleAccountCreated(task.id)}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                           task.accountCreated 
                             ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                             : 'bg-amber-500/10 text-amber-500/75 hover:bg-amber-500/20 border border-amber-500/20'
                         }`}
                         title="اضغط لتغيير حالة الحساب"
                       >
                         {task.accountCreated ? <CheckCircle2 size={12}/> : <div className="w-2 h-2 rounded-full bg-amber-500/50 animate-pulse"/>}
                         {task.accountCreated ? 'تم إنشاء الحساب' : 'لم ينشأ حساب بعد'}
                       </button>

                       <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-slate-600 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-white/5">
                         <Trash2 size={18}/>
                       </button>
                     </div>
                   </div>
                   
                   {/* بيانات المعتمر */}
                   <div className="space-y-4">
                     <div className="flex items-start gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-500 shrink-0">
                          <UserIcon size={24}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">الاسم الكامل</p>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white truncate">{task.data.fullName}</h3>
                            <button onClick={() => copyToClipboard(task.data.fullName)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-600 hover:text-emerald-500"><Copy size={14}/></button>
                          </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DataField 
                          icon={<CreditCard size={16}/>} 
                          label="رقم الجواز" 
                          value={task.data.passportNumber} 
                          onCopy={() => copyToClipboard(task.data.passportNumber)}
                        />
                        <DataField 
                          icon={<QrCode size={16}/>} 
                          label="رقم التأشيرة" 
                          value={task.data.visaNumber} 
                          onCopy={() => copyToClipboard(task.data.visaNumber)}
                        />
                        <DataField 
                          icon={<Calendar size={16}/>} 
                          label="تاريخ الميلاد" 
                          value={task.data.dateOfBirth} 
                          onCopy={() => copyToClipboard(task.data.dateOfBirth)}
                        />
                        <DataField 
                          icon={<UserIcon size={16}/>} 
                          label="النوع" 
                          value={task.data.gender || "غير محدد"} 
                          onCopy={() => copyToClipboard(task.data.gender)}
                        />
                        <DataField 
                          icon={<Smartphone size={16}/>} 
                          label="جوال سعودي (عشوائي)" 
                          value={task.data.phoneNumber} 
                          onCopy={() => copyToClipboard(task.data.phoneNumber)}
                          highlight
                        />
                        <div className="col-span-full">
                          <DataField 
                            icon={<Mail size={16}/>} 
                            label="البريد المولد (للتسجيل)" 
                            value={task.data.generatedEmail || "يرجى إدخال البريد الأساسي أولاً"} 
                            onCopy={() => copyToClipboard(task.data.generatedEmail)}
                            highlight={!!task.data.generatedEmail}
                            warning={!task.data.generatedEmail || !mainEmail}
                          />
                        </div>
                     </div>

                     {/* حقل كود التحقق الأوتوماتيكي الخاص بنسك */}
                     <OtpCardField
                       otpCode={task.data.otpCode}
                       otpReceivedAt={task.data.otpReceivedAt}
                       generatedEmail={task.data.generatedEmail}
                       isFetching={isFetchingOtps}
                       onFetchSingleOtp={() => handleFetchOtps(true)}
                       onSetManualOtp={(code) => handleSetManualOtp(task.id, code)}
                     />
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* User Settings Modal */}
      {currentUser && (
        <UserProfileModal
          user={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
          onLogout={handleLogout}
        />
      )}

      {/* Email App Password Config Modal */}
      {currentUser && (
        <EmailConfigModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          userId={currentUser.id}
          settings={emailSettings}
          onSaveSettings={(newSettings) => setEmailSettings(newSettings)}
        />
      )}
    </div>
  );
};

const DataField = ({ icon, label, value, onCopy, highlight, warning }: { icon: any, label: string, value: string, onCopy: () => void, highlight?: boolean, warning?: boolean }) => (
  <div className={`bg-white/[0.02] border ${warning ? 'border-amber-500/20' : 'border-white/5'} p-4 rounded-2xl flex items-center justify-between group/field transition-all`}>
    <div className="flex items-center gap-3 overflow-hidden">
      <div className={`${highlight ? 'text-emerald-500' : warning ? 'text-amber-500' : 'text-slate-500'}`}>
        {icon}
      </div>
      <div className="overflow-hidden">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{label}</p>
        <p className={`text-sm font-bold truncate ${highlight ? 'text-emerald-400' : warning ? 'text-amber-500' : 'text-slate-200'}`}>{value}</p>
      </div>
    </div>
    <button onClick={onCopy} className="opacity-0 group-hover/field:opacity-100 p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-emerald-500 transition-all shrink-0">
      <Copy size={14}/>
    </button>
  </div>
);

export default App;
