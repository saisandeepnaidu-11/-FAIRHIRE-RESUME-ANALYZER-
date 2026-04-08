import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Database, 
  BarChart3, 
  ShieldAlert, 
  Download, 
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  User,
  GraduationCap,
  Briefcase,
  Wrench,
  EyeOff,
  Eye,
  Zap,
  MessageSquare,
  Send,
  Info,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Sparkles,
  LogOut,
  LogIn,
  Star,
  MessageCircle,
  Globe,
  Target,
  FileDown,
  Copy,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeResume, StructuredResume, generateExpertATSResume, ExpertATSResult } from './lib/gemini';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { useFirebase } from './lib/FirebaseContext';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import { cn, sanitizeData } from './lib/utils';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export default function App() {
  const { user, profile, loading: authLoading, signIn, logout } = useFirebase();
  const [dataset, setDataset] = useState<StructuredResume[]>([]);
  const [stagedFiles, setStagedFiles] = useState<{ name: string, content: string | { data: string, mimeType: string } }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'dataset' | 'analytics' | 'chat' | 'ats-writer'>('upload');
  const [selectedResume, setSelectedResume] = useState<StructuredResume | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isDebiasMode, setIsDebiasMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Expert ATS Writer State
  const [atsTargetRole, setAtsTargetRole] = useState('');
  const [atsResumeInput, setAtsResumeInput] = useState('');
  const [atsResult, setAtsResult] = useState<ExpertATSResult | null>(null);
  const [isAtsGenerating, setIsAtsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Comments and Feedback
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [feedback, setFeedback] = useState<any[]>([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    if (!user || !profile) return;
    
    const q = query(collection(db, 'candidates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StructuredResume));
      setDataset(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'candidates'));

    return () => unsubscribe();
  }, [user, profile]);

  useEffect(() => {
    if (!selectedResume) {
      setComments([]);
      setFeedback([]);
      return;
    }

    const commentsQ = query(collection(db, 'candidates', selectedResume.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribeComments = onSnapshot(commentsQ, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `candidates/${selectedResume.id}/comments`));

    const feedbackQ = query(collection(db, 'candidates', selectedResume.id, 'feedback'), orderBy('createdAt', 'desc'));
    const unsubscribeFeedback = onSnapshot(feedbackQ, (snapshot) => {
      setFeedback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `candidates/${selectedResume.id}/feedback`));

    return () => {
      unsubscribeComments();
      unsubscribeFeedback();
    };
  }, [selectedResume]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleGenerateExpertATS = async () => {
    if (!atsResumeInput || !atsTargetRole) return;
    setIsAtsGenerating(true);
    try {
      const result = await generateExpertATSResume(atsResumeInput, atsTargetRole);
      setAtsResult(result);
    } catch (err) {
      console.error("Error generating Expert ATS resume", err);
    } finally {
      setIsAtsGenerating(false);
    }
  };

  const downloadDocx = async () => {
    if (!atsResult) return;
    const doc = new Document({
      sections: [{
        properties: {},
        children: atsResult.rewrittenResume.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun(line)],
          })
        ),
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_Resume_${atsTargetRole.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!atsResult) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(atsResult.rewrittenResume, 180);
    doc.text(lines, 10, 10);
    doc.save(`ATS_Resume_${atsTargetRole.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadCandidateResume = async (resume: StructuredResume, format: 'txt' | 'docx' | 'pdf') => {
    const text = resume.biasLabels?.atsFriendlyText || resume.rawText;
    const filename = `${resume.name.replace(/\s+/g, '_')}_ATS_Friendly`;

    if (format === 'txt') {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'docx') {
      const doc = new Document({
        sections: [{
          properties: {},
          children: text.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun(line)],
            })
          ),
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 10, 10);
      doc.save(`${filename}.pdf`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleImportExternal = async () => {
    setIsImporting(true);
    try {
      // Simulate fetching from an external source
      const externalData = [
        {
          id: 'ext-1',
          name: 'Sarah Jenkins',
          email: 'sarah.j@external-hr.com',
          skills: ['React', 'Node.js', 'AWS', 'Docker'],
          experience: [{ title: 'Senior Dev', company: 'TechCorp', duration: '5 years', description: 'Led cloud migration' }],
          education: [{ degree: 'B.S. Computer Science', institution: 'MIT', year: '2018' }],
          rawText: 'External Import: Sarah Jenkins...',
          biasLabels: {
            inferredGender: 'Female',
            collegeTier: 'Tier 1',
            fairnessScore: 92,
            debiasedScore: 94,
            contributions: [{ feature: 'Skills', impact: 45, reason: 'Strong cloud background' }],
            skillsGap: ['Kubernetes', 'Terraform'],
            careerPath: ['Engineering Manager', 'Solutions Architect'],
            sentimentTone: 'Highly Professional & Confident',
            completenessScore: 95,
            atsScore: 98,
            atsFriendlyText: 'Sarah Jenkins\nSenior Developer\nSkills: React, Node.js, AWS, Docker...'
          },
          status: 'pending',
          source: 'external',
          createdAt: serverTimestamp()
        },
        {
          id: 'ext-2',
          name: 'Michael Chen',
          email: 'm.chen@global-talent.net',
          skills: ['Python', 'PyTorch', 'SQL', 'Tableau'],
          experience: [{ title: 'Data Scientist', company: 'DataFlow', duration: '3 years', description: 'ML model optimization' }],
          education: [{ degree: 'M.S. Data Science', institution: 'Stanford', year: '2020' }],
          rawText: 'External Import: Michael Chen...',
          biasLabels: {
            inferredGender: 'Male',
            collegeTier: 'Tier 1',
            fairnessScore: 88,
            debiasedScore: 89,
            contributions: [{ feature: 'Education', impact: 30, reason: 'Top-tier graduate degree' }],
            skillsGap: ['Spark', 'NoSQL'],
            careerPath: ['Senior Data Scientist', 'ML Engineer'],
            sentimentTone: 'Technical & Analytical',
            completenessScore: 90,
            atsScore: 94,
            atsFriendlyText: 'Michael Chen\nData Scientist\nSkills: Python, PyTorch, SQL, Tableau...'
          },
          status: 'pending',
          source: 'external',
          createdAt: serverTimestamp()
        }
      ];

      for (const item of externalData) {
        await setDoc(doc(db, 'candidates', item.id), sanitizeData(item));
      }
      setActiveTab('dataset');
    } catch (err) {
      console.error("Error importing external data", err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReanalyze = async () => {
    if (!selectedResume) return;
    setIsProcessing(true);
    try {
      const structured = await analyzeResume(selectedResume.rawText);
      const updated = {
        ...selectedResume,
        ...structured,
        name: structured.name || selectedResume.name, // Keep existing if new one is empty
        biasLabels: {
          ...(selectedResume.biasLabels || {}),
          ...(structured.biasLabels || {})
        }
      };
      await updateDoc(doc(db, 'candidates', selectedResume.id), sanitizeData(updated));
      setSelectedResume(updated as any);
    } catch (err) {
      console.error("Error re-analyzing resume", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const processFiles = async (filesToProcess: { name: string, content: string | { data: string, mimeType: string } }[]) => {
    if (filesToProcess.length === 0) return;

    setIsProcessing(true);
    for (const staged of filesToProcess) {
      try {
        const structured = await analyzeResume(staged.content);
        const candidateId = Math.random().toString(36).substr(2, 9);
        const resume: any = {
          id: candidateId,
          name: structured.name || 'Unknown Candidate',
          email: structured.email || 'N/A',
          skills: structured.skills || [],
          experience: structured.experience || [],
          education: structured.education || [],
          rawText: typeof staged.content === 'string' ? staged.content : 'Binary Content',
          biasLabels: structured.biasLabels || {},
          status: 'pending',
          source: 'uploaded',
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'candidates', candidateId), sanitizeData(resume));
        
        // Audit Logging
        await addDoc(collection(db, 'audit_logs'), sanitizeData({
          candidateId,
          candidateName: resume.name,
          action: 'RESUME_UPLOAD',
          timestamp: serverTimestamp(),
          metadata: {
            fileName: staged.name,
            source: 'uploaded',
            atsScore: structured.biasLabels?.atsScore ?? null
          }
        }));
      } catch (err) {
        console.error("Error processing resume", err);
      }
    }

    setIsProcessing(false);
    setActiveTab('dataset');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newStaged: { name: string, content: string | { data: string, mimeType: string } }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const reader = new FileReader();
        const promise = new Promise<void>((resolve) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            newStaged.push({ 
              name: file.name, 
              content: { data: base64, mimeType: file.type } 
            });
            resolve();
          };
        });
        reader.readAsDataURL(file);
        await promise;
      } else {
        const text = await file.text();
        newStaged.push({ name: file.name, content: text });
      }
    }
    
    // Start processing immediately
    setStagedFiles(newStaged);
    processFiles(newStaged);
  };

  const handleStartPipeline = async () => {
    if (stagedFiles.length === 0) {
      handleGenerateSamples();
      return;
    }
    await processFiles(stagedFiles);
    setStagedFiles([]);
  };

  const handleGenerateSamples = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/dataset/generate-samples', { method: 'POST' });
      const samples = await res.json();
      for (const sample of samples) {
        await setDoc(doc(db, 'candidates', sample.id), sanitizeData({
          ...sample,
          status: 'pending',
          createdAt: serverTimestamp()
        }));
      }
      setActiveTab('dataset');
    } catch (err) {
      console.error("Failed to generate samples", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedResume || !user) return;
    try {
      await addDoc(collection(db, 'candidates', selectedResume.id, 'comments'), sanitizeData({
        candidateId: selectedResume.id,
        authorUid: user.uid,
        authorName: profile?.name || user.displayName || 'Anonymous',
        text: newComment,
        createdAt: serverTimestamp()
      }));
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `candidates/${selectedResume.id}/comments`);
    }
  };

  const handleAddFeedback = async (type: 'recruiter' | 'candidate') => {
    if (!selectedResume || !user) return;
    try {
      await addDoc(collection(db, 'candidates', selectedResume.id, 'feedback'), sanitizeData({
        candidateId: selectedResume.id,
        authorUid: user.uid,
        type,
        rating: feedbackRating,
        comments: feedbackText,
        createdAt: serverTimestamp()
      }));
      setFeedbackText('');
      setShowFeedbackForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `candidates/${selectedResume.id}/feedback`);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !selectedResume) return;
    
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: selectedResume, question: userMsg })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error: Failed to connect to Recruiter Assistant." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getGenderData = () => {
    const counts: Record<string, number> = { Male: 0, Female: 0, Unknown: 0 };
    dataset.forEach(r => {
      const g = r.biasLabels?.inferredGender || 'Unknown';
      counts[g]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const getTierData = () => {
    const counts: Record<string, number> = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };
    dataset.forEach(r => {
      const t = r.biasLabels?.collegeTier || 'Tier 3';
      counts[t]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const filteredDataset = dataset.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedDataset = [...filteredDataset].sort((a, b) => {
    const scoreA = isDebiasMode ? (a.biasLabels?.debiasedScore || 0) : (a.biasLabels?.fairnessScore || 0);
    const scoreB = isDebiasMode ? (b.biasLabels?.debiasedScore || 0) : (b.biasLabels?.fairnessScore || 0);
    return scoreB - scoreA;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-12">
        <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] shadow-2xl mb-8">
          <ShieldAlert className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-5xl font-black text-white tracking-tighter mb-4">FairHire AI</h1>
        <p className="text-slate-400 text-xl mb-12 max-w-md text-center leading-relaxed">
          The collaborative platform for unbiased hiring. Sign in to start analyzing talent.
        </p>
        <button 
          onClick={signIn}
          className="flex items-center gap-4 px-10 py-5 bg-indigo-500 text-white rounded-[2rem] font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-500/20"
        >
          <LogIn className="w-6 h-6" />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-72 bg-[#1e293b]/50 backdrop-blur-xl border-r border-white/5 p-8 z-20">
        <div className="flex items-center gap-4 mb-12">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter text-white">FairHire AI</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Hire talent, not bias.</p>
          </div>
        </div>

        <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
          <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} className="w-10 h-10 rounded-xl" alt="Avatar" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile?.name}</p>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{profile?.role}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-500 hover:text-rose-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <nav className="space-y-3">
          {[
            { id: 'upload', label: 'Ingest Data', icon: Upload },
            { id: 'dataset', label: 'Dataset Explorer', icon: Database },
            { id: 'analytics', label: 'Bias Analytics', icon: BarChart3 },
            { id: 'ats-writer', label: 'Expert ATS Writer', icon: Sparkles },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group",
                activeTab === item.id 
                  ? "bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 font-semibold" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", activeTab === item.id ? "text-white" : "text-slate-500")} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-12 pt-8 border-t border-white/5">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Pipeline Controls</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setIsBlindMode(!isBlindMode)}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-colors", isBlindMode ? "bg-amber-500/20 text-amber-500" : "bg-slate-800 text-slate-500")}>
                  {isBlindMode ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <span className={cn("text-sm font-medium transition-colors", isBlindMode ? "text-white" : "text-slate-400")}>Blind Mode</span>
              </div>
              <div className={cn("w-10 h-5 rounded-full relative transition-colors", isBlindMode ? "bg-amber-500" : "bg-slate-700")}>
                <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", isBlindMode ? "left-6" : "left-1")}></div>
              </div>
            </div>

            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setIsDebiasMode(!isDebiasMode)}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-colors", isDebiasMode ? "bg-indigo-500/20 text-indigo-500" : "bg-slate-800 text-slate-500")}>
                  <Zap className="w-4 h-4" />
                </div>
                <span className={cn("text-sm font-medium transition-colors", isDebiasMode ? "text-white" : "text-slate-400")}>Debias Engine</span>
              </div>
              <div className={cn("w-10 h-5 rounded-full relative transition-colors", isDebiasMode ? "bg-indigo-500" : "bg-slate-700")}>
                <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", isDebiasMode ? "left-6" : "left-1")}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-8 right-8">
          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] border border-white/5 shadow-2xl">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Fairness Index</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-3xl font-black text-white">
                {dataset.length > 0 ? Math.round(dataset.reduce((acc, r) => acc + (r.biasLabels?.fairnessScore || 0), 0) / dataset.length) : 0}%
              </span>
              <span className="text-xs text-emerald-400 font-bold mb-1">+4.2%</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-1000" 
                style={{ width: `${dataset.length > 0 ? dataset.reduce((acc, r) => acc + (r.biasLabels?.fairnessScore || 0), 0) / dataset.length : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-72 p-12">
        <AnimatePresence mode="wait">
          {activeTab === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-5xl mx-auto"
            >
              <div className="mb-16 text-center">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest mb-6"
                >
                  <Sparkles className="w-3 h-3" />
                  Next-Gen Explainable AI
                </motion.div>
                <h2 className="text-6xl font-black text-white tracking-tighter mb-6 leading-tight">
                  80% of resumes are <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">rejected in seconds.</span>
                </h2>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  Bias affects hiring decisions unknowingly. FairHire AI uses multi-agent systems to detect, explain, and eliminate bias in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <div className="group relative p-12 bg-white/5 border border-white/10 rounded-[3rem] flex flex-col items-center justify-center text-center hover:bg-white/[0.08] transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <input 
                    type="file" 
                    multiple 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="p-6 bg-indigo-500/20 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform duration-500">
                    <FileText className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h3 className="font-black text-2xl text-white mb-2">
                    {stagedFiles.length > 0 ? `${stagedFiles.length} Resumes Scanned` : 'Upload Resumes'}
                  </h3>
                  <p className="text-slate-400">
                    {stagedFiles.length > 0 ? 'Click the pipeline to start analysis' : 'PDF or TXT • Multi-file support'}
                  </p>
                  {stagedFiles.length > 0 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setStagedFiles([]); }}
                      className="mt-4 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors z-20"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="p-12 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] text-white flex flex-col items-center justify-center text-center shadow-2xl shadow-indigo-500/20">
                  <div className="p-6 bg-white/10 rounded-[2rem] mb-6">
                    <RefreshCw className={cn("w-10 h-10 text-white", isProcessing && "animate-spin")} />
                  </div>
                  <h3 className="font-black text-2xl mb-2">Automated Pipeline</h3>
                  <p className="text-indigo-100 mb-8 text-sm opacity-80">
                    {stagedFiles.length > 0 
                      ? `Ready to analyze ${stagedFiles.length} candidates.` 
                      : 'Multi-agent analysis: Analyzer, Auditor, Scorer, and Security Guard.'}
                  </p>
                  <div className="flex flex-col gap-4 w-full px-8">
                    <button 
                      onClick={handleStartPipeline}
                      disabled={isProcessing}
                      className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {stagedFiles.length > 0 ? 'Start Automated Pipeline' : 'Generate Sample Dataset'}
                    </button>
                    <button 
                      onClick={handleImportExternal}
                      disabled={isImporting}
                      className="w-full py-4 bg-indigo-500/20 border border-white/20 text-white rounded-2xl font-black text-sm hover:bg-indigo-500/40 transition-all flex items-center justify-center gap-2"
                    >
                      {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                      Access External Dataset
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { title: 'Team Collaboration', desc: 'Share datasets and comments with recruiters.', icon: MessageCircle, action: () => setActiveTab('dataset') },
                  { title: 'Blind Hiring', desc: 'Demographic marker masking.', icon: EyeOff, action: () => setIsBlindMode(!isBlindMode) },
                  { title: 'Security Audit', desc: 'Adversarial content detection.', icon: ShieldAlert, action: () => setActiveTab('dataset') },
                  { title: 'Feedback Module', desc: 'Collect recruiter and candidate feedback.', icon: Star, action: () => setActiveTab('dataset') },
                ].map((item, i) => (
                  <button 
                    key={i} 
                    onClick={item.action}
                    className={cn(
                      "p-6 bg-white/5 border border-white/5 rounded-3xl hover:border-indigo-500/50 hover:bg-white/[0.08] transition-all text-left group",
                      item.title === 'Blind Hiring' && isBlindMode && "border-amber-500/50 bg-amber-500/5"
                    )}
                  >
                    <item.icon className={cn("w-6 h-6 mb-4 transition-transform group-hover:scale-110", item.title === 'Blind Hiring' && isBlindMode ? "text-amber-500" : "text-indigo-400")} />
                    <h4 className="font-bold text-white text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'dataset' && (
            <motion.div 
              key="dataset"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight mb-2">Candidate Leaderboard</h2>
                  <p className="text-slate-400">Ranking talent based on merit and fairness scores.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Search talent..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 pr-6 py-3 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-4">
                  {sortedDataset.map((resume, idx) => (
                    <motion.div 
                      key={resume.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedResume(resume)}
                      className={cn(
                        "group p-6 bg-white/5 border rounded-[2rem] transition-all duration-500 cursor-pointer hover:bg-white/[0.08]",
                        selectedResume?.id === resume.id ? "border-indigo-500 bg-indigo-500/5 shadow-2xl shadow-indigo-500/10" : "border-white/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="relative">
                            <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-inner">
                              {isBlindMode ? <Lock className="w-6 h-6 text-slate-500" /> : resume.name.charAt(0)}
                            </div>
                            <div className="absolute -top-2 -left-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-[#0f172a]">
                              {idx + 1}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-white group-hover:text-indigo-400 transition-colors">
                              {isBlindMode ? "Candidate " + resume.id.toUpperCase() : resume.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500 font-medium">
                                {isBlindMode ? "Identity Masked" : resume.email}
                              </p>
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                (resume as any).source === 'external' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              )}>
                                {(resume as any).source || 'uploaded'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <div className="text-2xl font-black text-white mb-1">
                            {isDebiasMode ? (resume.biasLabels?.debiasedScore || 0) : (resume.biasLabels?.fairnessScore || 0)}%
                          </div>
                          <div className="flex items-center gap-3">
                            {resume.biasLabels?.atsFriendlyText && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadCandidateResume(resume, 'txt');
                                }}
                                className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                                title="Download ATS Resume (TXT)"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                              {isDebiasMode ? "Debiased Score" : "Fairness Score"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="lg:col-span-5">
                  {selectedResume ? (
                    <motion.div 
                      key={selectedResume.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#1e293b]/50 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/10 sticky top-12 shadow-2xl"
                    >
                      {selectedResume.biasLabels?.securityAlert && (
                        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400">
                          <ShieldAlert className="w-5 h-5 shrink-0" />
                          <p className="text-xs font-bold leading-relaxed">{selectedResume.biasLabels.securityAlert}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className="font-black text-2xl text-white mb-1">Explainability Report</h3>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Candidate Analysis</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleReanalyze}
                            disabled={isProcessing}
                            title="Re-analyze for better accuracy"
                            className="p-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl hover:text-white hover:bg-white/10 transition-all"
                          >
                            <RefreshCw className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                          </button>
                          <button 
                            onClick={() => setActiveTab('chat')}
                            className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20 hover:scale-110 transition-transform"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-10">
                        {/* ATS Optimization */}
                        <section className="p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <FileText className="w-4 h-4" />
                              </div>
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">ATS Optimization</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black text-white">
                                {selectedResume.biasLabels?.atsScore !== undefined ? `${selectedResume.biasLabels.atsScore}%` : 'N/A'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ATS Score</span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            {selectedResume.biasLabels?.atsFriendlyText 
                              ? "Generated a highly optimized, plain-text version of the resume for standard Applicant Tracking Systems."
                              : "ATS optimization data is missing for this candidate. Run analysis to generate an optimized version."}
                          </p>

                          {selectedResume.biasLabels?.atsFriendlyText ? (
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => downloadCandidateResume(selectedResume, 'txt')}
                                  className="flex-1 py-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  TXT
                                </button>
                                <button 
                                  onClick={() => downloadCandidateResume(selectedResume, 'docx')}
                                  className="flex-1 py-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  DOCX
                                </button>
                                <button 
                                  onClick={() => downloadCandidateResume(selectedResume, 'pdf')}
                                  className="flex-1 py-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  PDF
                                </button>
                              </div>
                              <button 
                                onClick={() => handleCopy(selectedResume.biasLabels?.atsFriendlyText || '', 'detail')}
                                className="w-full py-3 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-[10px] font-black hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                              >
                                {copySuccess === 'detail' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                Copy Optimized Text
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={handleReanalyze}
                              disabled={isProcessing}
                              className="w-full py-3 bg-slate-800 text-white rounded-xl text-xs font-black hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-white/5"
                            >
                              <RefreshCw className={cn("w-4 h-4", isProcessing && "animate-spin")} />
                              {isProcessing ? "Analyzing..." : "Generate ATS Optimization"}
                            </button>
                          )}
                        </section>

                        {/* Advanced Insights */}
                        <section className="grid grid-cols-2 gap-4">
                          <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Sentiment</h4>
                            <p className="text-sm font-bold text-white">{selectedResume.biasLabels?.sentimentTone || 'N/A'}</p>
                          </div>
                          <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Completeness</h4>
                            <div className="flex items-end gap-2">
                              <span className="text-xl font-black text-white">{selectedResume.biasLabels?.completenessScore || 0}%</span>
                              <div className="flex-1 bg-slate-800 h-1 rounded-full mb-1.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full" style={{ width: `${selectedResume.biasLabels?.completenessScore || 0}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* Skills Gap & Career Path */}
                        <section className="space-y-6">
                          <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <Target className="w-3 h-3" /> Skills Gap Analysis
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedResume.biasLabels?.skillsGap?.map((skill: string, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold">
                                  {skill}
                                </span>
                              )) || <p className="text-xs text-slate-600 italic">No gaps identified.</p>}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <TrendingUp className="w-3 h-3" /> Career Path Prediction
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedResume.biasLabels?.careerPath?.map((role: string, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-bold">
                                  {role}
                                </span>
                              )) || <p className="text-xs text-slate-600 italic">No predictions available.</p>}
                            </div>
                          </div>
                        </section>

                        {/* SHAP Contributions */}
                        <section>
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Feature Contributions</h4>
                            <Info className="w-3 h-3 text-slate-600" />
                          </div>
                          <div className="space-y-5">
                            {selectedResume.biasLabels?.contributions.map((c: any, i: number) => (
                              <div key={i} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-slate-300">{c.feature}</span>
                                  <span className={cn(c.impact > 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {c.impact > 0 ? "+" : ""}{c.impact}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.abs(c.impact)}%` }}
                                    className={cn("h-full", c.impact > 0 ? "bg-emerald-500" : "bg-rose-500")}
                                  ></motion.div>
                                </div>
                                <p className="text-[10px] text-slate-500 italic">{c.reason}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Team Collaboration: Comments */}
                        <section className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Team Comments</h4>
                          <div className="space-y-4 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {comments.length === 0 && <p className="text-xs text-slate-600 italic">No comments yet.</p>}
                            {comments.map((comment) => (
                              <div key={comment.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between mb-1">
                                  <span className="text-[10px] font-bold text-indigo-400">{comment.authorName}</span>
                                  <span className="text-[10px] text-slate-600">
                                    {comment.createdAt?.toDate().toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300">{comment.text}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="Add a note..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <button 
                              onClick={handleAddComment}
                              className="p-2 bg-indigo-500 text-white rounded-xl hover:scale-105 transition-all"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </section>

                        {/* Feedback Module */}
                        <section className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Feedback</h4>
                            <button 
                              onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                            >
                              {showFeedbackForm ? 'Cancel' : '+ Add Feedback'}
                            </button>
                          </div>
                          
                          {showFeedbackForm ? (
                            <div className="space-y-4">
                              <div className="flex gap-2 justify-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button 
                                    key={star}
                                    onClick={() => setFeedbackRating(star)}
                                    className={cn("transition-transform hover:scale-110", feedbackRating >= star ? "text-amber-400" : "text-slate-700")}
                                  >
                                    <Star className="w-6 h-6 fill-current" />
                                  </button>
                                ))}
                              </div>
                              <textarea 
                                placeholder="Detailed feedback..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 h-20 resize-none"
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleAddFeedback('recruiter')}
                                  className="flex-1 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600"
                                >
                                  Submit as Recruiter
                                </button>
                                <button 
                                  onClick={() => handleAddFeedback('candidate')}
                                  className="flex-1 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10"
                                >
                                  Submit as Candidate
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {feedback.length === 0 && <p className="text-xs text-slate-600 italic">No feedback collected.</p>}
                              {feedback.map((f) => (
                                <div key={f.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{f.type}</span>
                                    <div className="flex gap-0.5">
                                      {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={cn("w-2.5 h-2.5", i < f.rating ? "text-amber-400 fill-current" : "text-slate-700")} />
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-300">{f.comments}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 bg-white/5 rounded-[3rem] border border-white/5 border-dashed text-center">
                      <div className="p-6 bg-white/5 rounded-full mb-6">
                        <Zap className="w-12 h-12 text-slate-700" />
                      </div>
                      <h3 className="font-black text-xl text-slate-500 mb-2">No Talent Selected</h3>
                      <p className="text-sm text-slate-600 max-w-xs">Select a candidate from the leaderboard to view their explainability report and team collaboration tools.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ats-writer' && (
            <motion.div 
              key="ats-writer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto space-y-12"
            >
              <div className="text-center mb-16">
                <h2 className="text-5xl font-black text-white tracking-tighter mb-4">Expert ATS Writer</h2>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                  Transform your resume into a 100% ATS-friendly masterpiece. Optimized for recruiters and hiring managers.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="p-8 bg-white/5 border border-white/10 rounded-[3rem] space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">Target Job Role</label>
                      <input 
                        type="text"
                        placeholder="e.g. Senior Software Engineer"
                        value={atsTargetRole}
                        onChange={(e) => setAtsTargetRole(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block">Your Current Resume (Text)</label>
                      <textarea 
                        placeholder="Paste your resume content here..."
                        value={atsResumeInput}
                        onChange={(e) => setAtsResumeInput(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-white h-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleGenerateExpertATS}
                      disabled={isAtsGenerating || !atsResumeInput || !atsTargetRole}
                      className="w-full py-5 bg-indigo-500 text-white rounded-3xl font-black text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 disabled:opacity-50"
                    >
                      {isAtsGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                      {isAtsGenerating ? "Optimizing..." : "Generate ATS Resume"}
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  {atsResult ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem]">
                        <h3 className="text-emerald-400 font-black text-xl mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-6 h-6" /> Analysis Complete
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">{atsResult.analysis}</p>
                        <div className="flex flex-wrap gap-2">
                          {atsResult.improvements.map((imp, i) => (
                            <span key={i} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold">
                              {imp}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-8 bg-white/5 border border-white/10 rounded-[3rem] relative group">
                        <div className="absolute top-6 right-6 flex gap-2">
                          <button 
                            onClick={() => handleCopy(atsResult.rewrittenResume, 'writer')}
                            className="p-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl hover:text-white hover:bg-white/10 transition-all"
                            title="Copy to Clipboard"
                          >
                            {copySuccess === 'writer' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                          </button>
                          <button onClick={downloadDocx} className="p-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl hover:text-white hover:bg-white/10 transition-all" title="Download DOCX">
                            <FileDown className="w-5 h-5" />
                          </button>
                          <button onClick={downloadPdf} className="p-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl hover:text-white hover:bg-white/10 transition-all" title="Download PDF">
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Optimized Resume Preview</h3>
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 max-h-96 overflow-y-auto custom-scrollbar">
                          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                            {atsResult.rewrittenResume}
                          </pre>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-[2rem]">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" /> Top 1% Boost
                          </h4>
                          <ul className="space-y-3">
                            {atsResult.top1PercentBoost.suggestions.map((s, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-indigo-500 mt-1">•</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem]">
                          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Target className="w-3 h-3" /> High-Impact Projects
                          </h4>
                          <ul className="space-y-3">
                            {atsResult.top1PercentBoost.projects.map((p, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-amber-500 mt-1">•</span> {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
                      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 text-slate-600">
                        <FileText className="w-10 h-10" />
                      </div>
                      <h3 className="text-white font-black text-xl mb-2">Ready to Optimize</h3>
                      <p className="text-slate-500 text-sm max-w-xs">
                        Enter your target role and resume text to start the expert transformation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight mb-2">Bias Analytics</h2>
                <p className="text-slate-400">Visualizing meritocracy and systemic bias across the dataset.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[#1e293b]/50 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Gender Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getGenderData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {getGenderData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">College Tier Merit</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getTierData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                        <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-500/20">
                  <h3 className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-8">Fairness Trend</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'Jan', val: 45 }, { name: 'Feb', val: 52 }, { name: 'Mar', val: 48 }, { name: 'Apr', val: 61 }, { name: 'May', val: 75 }
                      ]}>
                        <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="val" stroke="#fff" fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} />
                        <Tooltip contentStyle={{ backgroundColor: '#4338ca', border: 'none', borderRadius: '12px', color: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col"
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight mb-2">Recruiter Assistant</h2>
                  <p className="text-slate-400">Ask questions about {selectedResume?.name}'s fairness and merit.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('dataset')}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Back to Dataset
                </button>
              </div>

              <div className="flex-1 bg-[#1e293b]/50 backdrop-blur-xl border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 p-8 overflow-y-auto space-y-6">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                      <div className="p-6 bg-indigo-500/10 rounded-full mb-6">
                        <MessageSquare className="w-12 h-12 text-indigo-400" />
                      </div>
                      <h3 className="font-black text-xl text-white mb-2">Start a Conversation</h3>
                      <p className="text-sm text-slate-500 max-w-xs">Ask things like "Is this decision fair?" or "Why was this candidate ranked highly?"</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] p-5 rounded-[2rem]",
                        msg.role === 'user' ? "bg-indigo-500 text-white rounded-tr-none" : "bg-white/5 text-slate-200 border border-white/10 rounded-tl-none"
                      )}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 p-5 rounded-[2rem] rounded-tl-none border border-white/10">
                        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 bg-white/5 border-t border-white/10">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Ask the Recruiter AI..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                      className="w-full pl-6 pr-16 py-4 bg-slate-900 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                    />
                    <button 
                      onClick={handleChat}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute right-2 top-2 p-3 bg-indigo-500 text-white rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / WOW Ending */}
      <footer className="ml-72 p-12 text-center border-t border-white/5">
        <p className="text-slate-500 text-sm font-medium">
          Imagine this integrated into real hiring systems to ensure <span className="text-indigo-400 font-bold">fairness globally.</span>
        </p>
      </footer>
    </div>
  );
}
