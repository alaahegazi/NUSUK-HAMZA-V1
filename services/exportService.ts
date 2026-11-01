import { AutomationTask, Group } from '../types';

/**
 * دالة مساعدة لتنسيق التاريخ والوقت إلى نص مقروء
 */
const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return `${d.toLocaleDateString('ar-SA')} ${d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoString;
  }
};

/**
 * تجهيز صفوف البيانات بصيغة معيارية لجميع أنواع التصدير
 */
export const prepareExportData = (
  tasks: AutomationTask[],
  groups: Group[] = []
) => {
  const groupNameMap: Record<string, string> = {
    general: 'المجموعة العامة',
    all: 'جميع المجموعات'
  };
  groups.forEach(g => {
    groupNameMap[g.id] = g.name;
  });

  return tasks.map((task, index) => {
    const groupName = groupNameMap[task.groupId || 'general'] || 'المجموعة العامة';
    const otpStatus = task.data.otpCode ? 'تم استلام الكود' : 'بانتظار الكود';
    const accountStatus = task.accountCreated ? 'تم إنشاء الحساب' : 'لم ينشأ حساب بعد';

    return {
      index: index + 1,
      fullName: task.data.fullName || '',
      passportNumber: task.data.passportNumber || '',
      visaNumber: task.data.visaNumber || '',
      dateOfBirth: task.data.dateOfBirth || '',
      gender: task.data.gender || 'غير محدد',
      nationality: task.data.nationality || '',
      phoneNumber: task.data.phoneNumber || '',
      generatedEmail: task.data.generatedEmail || '',
      otpCode: task.data.otpCode || '',
      otpStatus,
      otpReceivedAt: formatDateTime(task.data.otpReceivedAt),
      accountStatus,
      groupName
    };
  });
};

/**
 * تصدير البيانات إلى ملف CSV متوافق مع Excel (UTF-8 BOM)
 */
export const exportTasksToCSV = (
  tasks: AutomationTask[],
  groupTitle: string,
  groups: Group[] = []
): boolean => {
  if (!tasks || tasks.length === 0) return false;

  const rows = prepareExportData(tasks, groups);

  const headers = [
    'م',
    'اسم المعتمر',
    'رقم الجواز',
    'رقم التأشيرة',
    'تاريخ الميلاد',
    'النوع',
    'الجنسية',
    'رقم الجوال السعودي',
    'البريد المولد للتسجيل',
    'كود التحقق (OTP)',
    'حالة كود التحقق',
    'تاريخ ووقت استلام الكود',
    'حالة الحساب في نسك',
    'المجموعة'
  ];

  // دالة لتنظيف وتغليف الخلية في CSV مع الحفاظ على الأصفار الأولى والأرقام الطويلة
  const escapeCSV = (value: string | number) => {
    const str = String(value ?? '');
    // إذا احتوت على فواصل أو أسطر جديدة أو علامات تنصيص
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvRows: string[] = [];
  
  // إضافة صف العناوين
  csvRows.push(headers.map(escapeCSV).join(','));

  // إضافة صفوف البيانات
  rows.forEach(r => {
    // نضع علامة ="قيمة" لرقم الجواز والهاتف والتأشيرة حتى لا يقوم إكسل بحذف الصفر في البداية أو تحويلها لصيغة علمية
    const rowValues = [
      r.index,
      escapeCSV(r.fullName),
      `="${r.passportNumber}"`,
      `="${r.visaNumber}"`,
      escapeCSV(r.dateOfBirth),
      escapeCSV(r.gender),
      escapeCSV(r.nationality),
      `="${r.phoneNumber}"`,
      escapeCSV(r.generatedEmail),
      r.otpCode ? `="${r.otpCode}"` : '""',
      escapeCSV(r.otpStatus),
      escapeCSV(r.otpReceivedAt),
      escapeCSV(r.accountStatus),
      escapeCSV(r.groupName)
    ];
    csvRows.push(rowValues.join(','));
  });

  // إضافة UTF-8 BOM (\uFEFF) لضمان ظهور النصوص العربية بوضوح تام دون أي تشويه في إكسل
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const cleanTitle = groupTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || 'المعتمرين';
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `معتمري_${cleanTitle}_${dateStr}.csv`;

  downloadBlob(blob, fileName);
  return true;
};

/**
 * تصدير البيانات إلى ملف Excel (.xls) منسق ومجدول بجداول أنيقة وألوان وتنسيق RTL
 */
export const exportTasksToExcel = (
  tasks: AutomationTask[],
  groupTitle: string,
  groups: Group[] = []
): boolean => {
  if (!tasks || tasks.length === 0) return false;

  const rows = prepareExportData(tasks, groups);
  const cleanTitle = groupTitle.replace(/[\\/:*?"<>|]/g, '_').trim() || 'المعتمرين';
  const dateStr = new Date().toISOString().slice(0, 10);
  const exportTime = new Date().toLocaleTimeString('ar-SA');

  // إنشاء جدول HTML متوافق مع محرك Microsoft Excel مع تحديد اتجاه RTL ونوع الخط
  const excelHtml = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" 
        xmlns:x="urn:schemas-microsoft-com:office:excel" 
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>${cleanTitle.substring(0, 31)}</x:Name>
            <x:WorksheetOptions>
              <x:DisplayRightToLeft/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body {
        direction: rtl;
        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        direction: rtl;
      }
      th {
        background-color: #059669;
        color: #ffffff;
        font-weight: bold;
        font-size: 13px;
        border: 1px solid #047857;
        padding: 10px 8px;
        text-align: right;
      }
      td {
        border: 1px solid #d1d5db;
        padding: 8px;
        font-size: 12px;
        text-align: right;
        vertical-align: middle;
      }
      .text-cell {
        mso-number-format: "\\@"; /* يحافظ على النصوص والأرقام التي تبدأ بأصفار */
      }
      .center-cell {
        text-align: center;
      }
      .badge-success {
        background-color: #d1fae5;
        color: #065f46;
        font-weight: bold;
        border-radius: 4px;
        padding: 4px 8px;
      }
      .badge-pending {
        background-color: #fef3c7;
        color: #92400e;
        font-weight: bold;
        border-radius: 4px;
        padding: 4px 8px;
      }
      .header-info {
        background-color: #f0fdf4;
        padding: 12px;
        margin-bottom: 12px;
        border: 1px solid #bbf7d0;
        font-size: 14px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="header-info">
      تقرير بيانات المعتمرين - ${cleanTitle} | إجمالي السجلات: ${tasks.length} | تاريخ التصدير: ${dateStr} ${exportTime}
    </div>
    <table border="1">
      <thead>
        <tr>
          <th style="width: 40px;">م</th>
          <th style="width: 200px;">اسم المعتمر الكامل</th>
          <th style="width: 120px;">رقم الجواز</th>
          <th style="width: 130px;">رقم التأشيرة</th>
          <th style="width: 100px;">تاريخ الميلاد</th>
          <th style="width: 70px;">النوع</th>
          <th style="width: 100px;">الجنسية</th>
          <th style="width: 130px;">رقم الجوال السعودي</th>
          <th style="width: 220px;">البريد المولد للتسجيل</th>
          <th style="width: 100px;">كود التحقق (OTP)</th>
          <th style="width: 120px;">حالة كود التحقق</th>
          <th style="width: 150px;">تاريخ ووقت الاستلام</th>
          <th style="width: 130px;">حالة حساب نسك</th>
          <th style="width: 120px;">المجموعة</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <td class="center-cell">${r.index}</td>
            <td style="font-weight: bold; color: #111827;">${escapeXml(r.fullName)}</td>
            <td class="text-cell" style="font-family: monospace; font-weight: bold;">${escapeXml(r.passportNumber)}</td>
            <td class="text-cell" style="font-family: monospace;">${escapeXml(r.visaNumber)}</td>
            <td class="center-cell">${escapeXml(r.dateOfBirth)}</td>
            <td class="center-cell">${escapeXml(r.gender)}</td>
            <td>${escapeXml(r.nationality || '—')}</td>
            <td class="text-cell" style="direction: ltr; text-align: right;">${escapeXml(r.phoneNumber)}</td>
            <td class="text-cell" style="direction: ltr; text-align: right; color: #047857; font-weight: 500;">${escapeXml(r.generatedEmail)}</td>
            <td class="text-cell center-cell" style="font-weight: bold; color: #047857; font-size: 13px;">${r.otpCode ? escapeXml(r.otpCode) : '—'}</td>
            <td class="center-cell">
              <span class="${r.otpCode ? 'badge-success' : 'badge-pending'}">${escapeXml(r.otpStatus)}</span>
            </td>
            <td class="center-cell" style="font-size: 11px; color: #4b5563;">${escapeXml(r.otpReceivedAt || '—')}</td>
            <td class="center-cell">
              <span class="${r.accountStatus === 'تم إنشاء الحساب' ? 'badge-success' : 'badge-pending'}">${escapeXml(r.accountStatus)}</span>
            </td>
            <td>${escapeXml(r.groupName)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const fileName = `معتمري_${cleanTitle}_${dateStr}.xls`;

  downloadBlob(blob, fileName);
  return true;
};

/**
 * دالة لتنظيف الرموز الخاصة في HTML/XML
 */
const escapeXml = (unsafe: string): string => {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * دالة مساعدة لتنزيل الـ Blob كملف للمستخدم
 */
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
