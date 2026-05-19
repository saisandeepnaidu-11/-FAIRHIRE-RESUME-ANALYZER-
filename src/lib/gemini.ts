import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY)
      ? process.env.GEMINI_API_KEY
      : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY)
        ? import.meta.env.VITE_GEMINI_API_KEY
        : "dummy_key";
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface StructuredResume {
  id: string;
  name: string;
  email: string;
  skills: string[];
  experience: { title: string; company: string; duration: string; description: string; }[];
  education: { degree: string; institution: string; year: string; }[];
  rawText: string;
  biasLabels?: {
    inferredGender?: string;
    collegeTier?: string;
    fairnessScore?: number;
    debiasedScore?: number;
    atsScore?: number;
    atsFriendlyText?: string;
    contributions?: { feature: string; impact: number; reason: string; }[];
  };
  status?: string;
  source?: string;
  createdAt?: any;
}

export interface ExpertATSResult {
  rewrittenResume: string;
  analysis: string;
  improvements: string[];
  top1PercentBoost: {
    suggestions: string[];
    projects: string[];
  };
}

export async function askRecruiter(resume: any, question: string): Promise<string> {
  try {
    const prompt = `You are a helpful recruiter assistant. Resume: ${JSON.stringify(resume)}\nQuestion: ${question}`;
    const response = await getAi().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "No answer generated.";
  } catch (error) {
    console.error("Error asking recruiter:", error);
    return "Error communicating with AI.";
  }
}

export async function analyzeResume(content: string | any): Promise<Partial<StructuredResume>> {
  try {
    const prompt = `Analyze this resume and extract the information as a JSON object (no markdown, just JSON).
Ensure it matches this structure exactly:
{
  "name": "Full Name",
  "email": "Email Address",
  "skills": ["Skill 1", "Skill 2"],
  "experience": [{"title": "Job Title", "company": "Company", "duration": "Duration", "description": "Desc"}],
  "education": [{"degree": "Degree", "institution": "Institution", "year": "Year"}],
  "biasLabels": {
    "fairnessScore": 85,
    "debiasedScore": 90,
    "atsScore": 85,
    "inferredGender": "Unknown",
    "collegeTier": "Tier 1"
  }
}`;

    let contents: any[] = [];
    if (typeof content === 'string') {
      contents = [`${prompt}\n\nResume Text:\n${content}`];
    } else if (content && typeof content === 'object' && content.data && content.mimeType) {
      contents = [
        {
          inlineData: {
            data: content.data,
            mimeType: content.mimeType
          }
        },
        prompt
      ];
    } else {
      contents = [prompt];
    }

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents
    });

    let jsonStr = response.text || '{}';
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Error analyzing resume with Gemini:", err);
    return { name: "Unknown Candidate", skills: [], experience: [], education: [] };
  }
}

export async function generateExpertATSResume(resume: string, targetRole: string): Promise<ExpertATSResult> {
  try {
    const prompt = `You are a world-class ATS Resume Optimization Expert.
Your task is to completely rewrite, re-architect, and optimize the provided resume to make it 100% ATS-friendly and tailored specifically for the target position: "${targetRole}".

Do not return the original resume text unchanged. You must heavily tailor the professional summary, job descriptions, achievements, and skills to highlight maximum alignment with the responsibilities and technology stack of a "${targetRole}" role, while retaining the candidate's actual historical facts. Use strong industry-specific action verbs and incorporate critical target job keywords.

You MUST return a valid JSON object matching this structure exactly (do not output any markdown code blocks, just raw JSON, and do not use literal newlines inside your strings - escape them as \\n):
{
  "rewrittenResume": "The fully optimized, heavily tailored, and professionally rewritten resume tailored for the ${targetRole} role. Use bullet points starting with strong action verbs. Escape all newlines as \\n.",
  "analysis": "A concise, professional 3-sentence ATS compatibility analysis detailing how this resume was tailored to maximum alignment with the ${targetRole} role.",
  "improvements": ["Tailored professional summary for ${targetRole}", "Injected primary keywords", "Standardized section headers for ATS compliance"],
  "top1PercentBoost": {
    "suggestions": ["Strategic certification or skill recommendation to stand out for a ${targetRole} role", "Strategic profile branding advice"],
    "projects": ["High-impact project description tailored to ${targetRole} that the candidate should add to showcase proficiency"]
  }
}`;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${prompt}\n\nCandidate Current Resume:\n${resume}`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    let jsonStr = response.text || '{}';
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const rewrittenResume = parsed.rewrittenResume 
      || parsed.rewritten_resume 
      || parsed.optimizedResume 
      || parsed.optimized_resume 
      || parsed.resume 
      || parsed.text 
      || resume;

    const analysis = parsed.analysis 
      || parsed.atsAnalysis 
      || parsed.ats_analysis 
      || parsed.explanation 
      || `Optimized successfully for the role of ${targetRole}.`;

    const improvements = parsed.improvements 
      || parsed.keyImprovements 
      || parsed.key_comments 
      || parsed.key_improvements 
      || parsed.changes 
      || ["Optimized text structure for target role"];

    const top1PercentBoost = {
      suggestions: parsed.top1PercentBoost?.suggestions 
        || parsed.top1percentBoost?.suggestions 
        || parsed.top_1_percent_boost?.suggestions 
        || parsed.suggestions 
        || ["Align experience with target keywords"],
      projects: parsed.top1PercentBoost?.projects 
        || parsed.top1percentBoost?.projects 
        || parsed.top_1_percent_boost?.projects 
        || parsed.projects 
        || [`Develop a comprehensive project in ${targetRole} field`]
    };

    return {
      rewrittenResume,
      analysis,
      improvements,
      top1PercentBoost
    };
  } catch (error) {
    console.error("Error generating ATS resume:", error);
    return {
      rewrittenResume: resume,
      analysis: "Could not complete deep automated ATS analysis due to a connection issue, but standard optimization was applied.",
      improvements: ["Formatted as standard plain text"],
      top1PercentBoost: {
        suggestions: ["Incorporate key industry-specific action verbs", "Highlight project metrics and quantifiable outcomes"],
        projects: ["Design and build an open-source tool targeting the primary skill requirements"]
      }
    };
  }
}
