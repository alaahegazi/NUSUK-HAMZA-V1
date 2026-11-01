import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  X, 
  CheckCircle2, 
  Users, 
  Filter, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { AutomationTask, Group } from '../types';
import { exportTasksToCSV, exportTasksToExcel } from '../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: AutomationTask[];
  filteredTasks: AutomationTask[];
  selectedGroupId: string;
  groups: Group[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  filteredTasks,
  selectedGroupId,
  groups
}) => {
  const [exportScope, setExportScope] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // تحديد اسم المجموعة المحددة
  const currentGroup = groups.find(g => g.id === selectedGroupId);
  const selectedGroupName = selectedGroupId === 'all' 
    ? 'جميع المجموعات' 
    : (currentGroup?.name || 'المجموعة العامة');

  // حساب المهام التابعة للمجموعة المحددة
  const groupTasks = selectedGroupId === 'all' 
    ? tasks 
    : tasks.filter(t => t.groupId === selectedGroupId);

  // تحديد المهام المستهدفة بالتصدير بناءً على الخيار
  const targetTasks = 
    exportScope === 'selected' 
      ? groupTasks 
      : exportScope === 'filtered' 
        ? filteredTasks 
        : tasks;

  const targetTitle = 
    exportScope === 'selected' 
      ? selectedGroupName 
      : exportScope === 'filtered' 
        ? `المفلترة_${selectedGroupName}` 
        : 'كافة_المجموعات';

  // إحصائيات سريعة للبيانات المستهدفة
  const totalCount = targetTasks.length;
  const createdCount = targetTasks.filter(t => t.accountCreated).length;
  const otpCount = targetTasks.filter(t => !!t.data.otpCode).length;

  const handleExport = (format: 'excel' | 'csv') => {
    if (totalCount === 0) return;

    let success = false;
    if (format === 'excel') {
      success = exportTasksToExcel(targetTasks, targetTitle, groups);
    } else {
      success = exportTasksToCSV(targetTasks, targetTitle, groups);
    }

    if (success) {
      setSuccessMessage(`تم تصدير ${totalCount} سجل بنجاح بصيغة ${format.toUpperCase()}!`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0e0e0e] border border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 text-right relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* خلفية جمالية */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="leading-tight">
              <h3 className="text-lg font-black text-white">تصدير بيانات المعتمرين</h3>
              <p className="text-xs text-slate-400">تصدير كامل البيانات للجداول الخارجية كملف Excel أو CSV</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
              <FileSpreadsheet size={22} />
            </div>
          </div>
        </div>

        {/* إشعار النجاح */}
        {successMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-emerald-400 text-xs font-bold animate-fadeIn">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* خيارات نطاق التصدير */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300 block">
            حدد نطاق البيانات المراد تصديرها:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setExportScope('selected')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                exportScope === 'selected'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <Users size={14} />
                <span className="text-xs font-bold truncate">{selectedGroupName}</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {groupTasks.length} معتمر
              </span>
            </button>

            <button
              type="button"
              onClick={() => setExportScope('filtered')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                exportScope === 'filtered'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <Filter size={14} />
                <span className="text-xs font-bold">النتائج المفلترة</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {filteredTasks.length} معتمر
              </span>
            </button>

            <button
              type="button"
              onClick={() => setExportScope('all')}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                exportScope === 'all'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <ShieldCheck size={14} />
                <span className="text-xs font-bold">كافة المجموعات</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {tasks.length} معتمر
              </span>
            </button>
          </div>
        </div>

        {/* ملخص البيانات الجاهزة للتصدير */}
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white font-mono bg-white/5 px-2.5 py-1 rounded-lg">
              {totalCount} معتمر
            </span>
            <span className="text-slate-400 font-bold">إجمالي السجلات المحددة للتصدير:</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400 font-bold font-mono">{createdCount}</span>
              <span>حسابات مكتملة:</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400 font-bold font-mono">{otpCount}</span>
              <span>أكواد OTP مستلمة:</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
            * يتضمن الملف المصدر: رقم الجواز، رقم التأشيرة، تاريخ الميلاد، البريد المولد للتسجيل، رقم الجوال السعودي، كود التحقق وحالته ووقت استلامه، وحالة إنشاء الحساب.
          </p>
        </div>

        {/* أزرار اختيار الصيغة والتنزيل */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* زر التصدير إلى Excel */}
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={totalCount === 0}
            className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-emerald-500 text-black font-black text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span>تصدير كملف Excel (.xls)</span>
          </button>

          {/* زر التصدير إلى CSV */}
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={totalCount === 0}
            className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={16} />
            <span>تصدير كملف CSV (.csv)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
