import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as pdf from "pdf-parse";
import { createObjectCsvWriter } from "csv-writer";
import { askRecruiter } from "./src/lib/gemini.js";

// Note: In a real app, we'd use a database. For this "dataset pipeline" task, 
// we'll use a local JSON file to store the "processed dataset".
const DATASET_PATH = path.join(process.cwd(), "processed_dataset.json");
const CSV_EXPORT_PATH = path.join(process.cwd(), "processed_dataset.csv");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/dataset", (req, res) => {
    if (fs.existsSync(DATASET_PATH)) {
      const data = fs.readFileSync(DATASET_PATH, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  });

  app.post("/api/dataset/save", (req, res) => {
    const data = req.body;
    fs.writeFileSync(DATASET_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true });
  });

  app.post("/api/dataset/generate-samples", (req, res) => {
    const samples = [
      {
        id: "s1",
        name: "John Doe",
        email: "john.doe@example.com",
        skills: ["React", "Node.js", "TypeScript", "AWS"],
        experience: [{ title: "Senior Engineer", company: "Tech Corp", duration: "3 years", description: "Led frontend team." }],
        education: [{ degree: "B.S. Computer Science", institution: "Stanford University", year: "2018" }],
        rawText: "John Doe resume content...",
        biasLabels: {
          inferredGender: "Male",
          collegeTier: "Tier 1",
          fairnessScore: 65,
          debiasedScore: 88,
          contributions: [
            { feature: "Skills Alignment", impact: 40, reason: "Strong React/Node matching." },
            { feature: "College Tier Bias", impact: -15, reason: "Ivy League preference detected." },
            { feature: "Gendered Language", impact: -10, reason: "Masculine-coded verbs used." }
          ]
        }
      },
      {
        id: "s2",
        name: "Jane Smith",
        email: "jane.smith@example.com",
        skills: ["Python", "Data Science", "Machine Learning", "SQL"],
        experience: [{ title: "Data Scientist", company: "Data Inc", duration: "2 years", description: "Built ML models." }],
        education: [{ degree: "M.S. Statistics", institution: "State University", year: "2019" }],
        rawText: "Jane Smith resume content...",
        biasLabels: {
          inferredGender: "Female",
          collegeTier: "Tier 2",
          fairnessScore: 82,
          debiasedScore: 94,
          contributions: [
            { feature: "Experience Depth", impact: 35, reason: "Relevant ML projects." },
            { feature: "Neutral Tone", impact: 15, reason: "Gender-neutral descriptions." },
            { feature: "College Tier", impact: -5, reason: "Minor state school penalty." }
          ]
        }
      },
      {
        id: "s3",
        name: "Alex Johnson",
        email: "alex.j@example.com",
        skills: ["Java", "Spring Boot", "Docker", "Kubernetes"],
        experience: [{ title: "Backend Developer", company: "Cloud Systems", duration: "4 years", description: "Maintained microservices." }],
        education: [{ degree: "B.Tech", institution: "Local College", year: "2017" }],
        rawText: "Alex Johnson resume content...",
        biasLabels: {
          inferredGender: "Male",
          collegeTier: "Tier 3",
          fairnessScore: 55,
          debiasedScore: 82,
          securityAlert: "⚠️ Suspicious keyword stuffing detected in hidden sections.",
          contributions: [
            { feature: "Backend Proficiency", impact: 30, reason: "Solid Java/K8s stack." },
            { feature: "Adversarial Content", impact: -25, reason: "Detected hidden keywords." },
            { feature: "College Tier", impact: -10, reason: "Tier 3 institution penalty." }
          ]
        }
      }
    ];
    fs.writeFileSync(DATASET_PATH, JSON.stringify(samples, null, 2));
    res.json(samples);
  });

  app.post("/api/dataset/export-csv", async (req, res) => {
    const data = req.body;
    const csvWriter = createObjectCsvWriter({
      path: CSV_EXPORT_PATH,
      header: [
        { id: 'name', title: 'NAME' },
        { id: 'email', title: 'EMAIL' },
        { id: 'gender', title: 'INFERRED_GENDER' },
        { id: 'tier', title: 'COLLEGE_TIER' },
        { id: 'score', title: 'FAIRNESS_SCORE' },
        { id: 'skills', title: 'SKILLS' }
      ]
    });

    const records = data.map((item: any) => ({
      name: item.name,
      email: item.email,
      gender: item.biasLabels?.inferredGender,
      tier: item.biasLabels?.collegeTier,
      score: item.biasLabels?.fairnessScore,
      skills: item.skills?.join(", ")
    }));

    await csvWriter.writeRecords(records);
    res.json({ success: true, path: CSV_EXPORT_PATH });
  });

  app.post("/api/chat", async (req, res) => {
    const { resume, question } = req.body;
    try {
      const answer = await askRecruiter(resume, question);
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: "Failed to chat" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
