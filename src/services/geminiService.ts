import { GoogleGenAI } from "@google/genai";
import { JobStepStatus, CHECKLIST_STEPS } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getSmartSuggestions(steps: JobStepStatus[]) {
  const failedSteps = steps
    .filter(s => s.status === 'fail')
    .map(s => CHECKLIST_STEPS.find(cs => cs.id === s.stepId)?.label);

  if (failedSteps.length === 0) return "All systems looking good so far. Proceed with standard checks.";

  const prompt = `As an HVAC expert assistant, provide a concise (1-2 sentence) diagnostic suggestion for a technician. 
  The following checks failed: ${failedSteps.join(', ')}.
  What should they look for next?`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Continue diagnostic to narrow down the root cause.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Based on symptoms: possible system imbalance. Verify pressures and electrical loads.";
  }
}
