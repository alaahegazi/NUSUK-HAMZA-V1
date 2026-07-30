
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL } from "../constants";
import { VisaData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractBulkIdentityInfo = async (base64Data: string, mimeType: string): Promise<VisaData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: `Extract all pilgrim data from this document. 
          For each individual, I need:
          1. fullName: Full name as written.
          2. passportNumber: Passport number.
          3. visaNumber: Visa number.
          4. dateOfBirth: Date of birth.
          5. gender: Gender (must be 'ذكر' for male or 'أنثى' for female).
          6. phoneNumber: Generate a random, unique Saudi mobile number for this pilgrim starting with '5' followed by 8 digits (e.g., 512345678). DO NOT include the leading zero.
          
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
    
    return JSON.parse(textOutput);
  } catch (error) {
    console.error("Extraction Error:", error);
    throw new Error("فشل استخراج البيانات، يرجى التأكد من جودة الملف");
  }
};
