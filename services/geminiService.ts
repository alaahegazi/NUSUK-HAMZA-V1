
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL } from "../constants";
import { VisaData } from "../types";

/**
 * تنظيف وتنسيق رقم الجوال السعودي ليبدأ برقم 5 ويتكون من 9 خانات بدقة
 */
function sanitizeSaudiPhone(rawPhone?: string): string {
  let phone = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('966')) phone = phone.substring(3);
  if (phone.startsWith('0')) phone = phone.substring(1);
  if (!phone.startsWith('5') || phone.length !== 9) {
    const random8 = Math.floor(10000000 + Math.random() * 90000000);
    phone = `5${random8}`;
  }
  return phone;
}

export const extractBulkIdentityInfo = async (base64Data: string, mimeType: string): Promise<VisaData[]> => {
  // 1. المحاولة الأولى: عبر خادم Express الداخلي (/api/extract-visas) لحماية المفتاح وضمان الأداء
  try {
    const res = await fetch('/api/extract-visas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64Data,
        mimeType: mimeType || 'application/pdf'
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pilgrims)) {
        return data.pilgrims.map((p: any) => ({
          ...p,
          phoneNumber: sanitizeSaudiPhone(p.phoneNumber)
        }));
      }
    }
  } catch (serverErr) {
    console.warn("Server-side extraction failed, trying client-side fallback...", serverErr);
  }

  // 2. المحاولة الاحتياطية المباشرة عبر المتصفح
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      throw new Error("مفتاح Gemini API غير معرف");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'application/pdf', data: base64Data } },
          { text: `Extract all pilgrim data from this document. 
          For each individual, I need:
          1. fullName: Full name as written.
          2. passportNumber: Passport number.
          3. visaNumber: Visa number.
          4. dateOfBirth: Date of birth.
          5. gender: Gender (must be 'ذكر' for male or 'أنثى' for female).
          6. phoneNumber: Generate a random Saudi mobile number starting with '5' followed by 8 digits (e.g., 512345678). DO NOT include the leading zero or 966.
          
          Return the data as a clean JSON array of objects.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              passportNumber: { type: Type.STRING },
              visaNumber: { type: Type.STRING },
              dateOfBirth: { type: Type.STRING },
              gender: { type: Type.STRING, description: "Gender: 'ذكر' or 'أنثى'" },
              phoneNumber: { type: Type.STRING }
            },
            required: ["fullName", "passportNumber", "visaNumber", "dateOfBirth", "gender", "phoneNumber"]
          }
        }
      }
    });
    
    const textOutput = response.text;
    if (!textOutput) return [];
    
    const parsed = JSON.parse(textOutput);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((item: any) => ({
      ...item,
      phoneNumber: sanitizeSaudiPhone(item.phoneNumber)
    }));
  } catch (error) {
    console.error("Extraction Error:", error);
    throw new Error("فشل استخراج البيانات من الملف. يرجى التأكد من وضوح كشف التأشيرات أو تجربة ملف PDF بديل.");
  }
};
