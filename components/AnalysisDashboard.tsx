import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ComprehensiveAnalysis, TopicAnalysis, ChatMessage } from '../types';
import { chatWithCoach } from '../services/geminiService';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie,
  ComposedChart, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, Target, AlertTriangle, CheckCircle2, 
  BrainCircuit, ListTodo, BarChart2, GraduationCap, ArrowRight, User, Search,
  BookOpen, Calculator, FlaskConical, Globe, ScrollText, HeartHandshake,
  Lightbulb, ClipboardCheck, Stethoscope, Pill, Timer, BookMarked,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, History, Filter, Layers,
  LayoutGrid, Activity, Users, Star, Footprints, Clock, Rocket,
  CheckCircle, AlertCircle, HelpCircle, Trophy, ThumbsUp, Flame, Siren, Quote,
  Download, Loader2, MessageCircle, Send, Bot, Zap
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  data: ComprehensiveAnalysis;
  history: ComprehensiveAnalysis[];
  onReset: () => void;
  onSelectHistory: (data: ComprehensiveAnalysis) => void;
}

// Standardized Lesson Names & Colors
const LESSON_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  'Türkçe': { color: '#ef4444', icon: BookOpen, label: 'Türkçe' },
  'Matematik': { color: '#3b82f6', icon: Calculator, label: 'Matematik' },
  'Fen Bilimleri': { color: '#10b981', icon: FlaskConical, label: 'Fen Bilimleri' },
  'T.C. İnkılap Tarihi': { color: '#f59e0b', icon: ScrollText, label: 'T.C. İnkılap Tarihi' },
  'Din Kültürü': { color: '#8b5cf6', icon: HeartHandshake, label: 'Din Kültürü' },
  'İngilizce': { color: '#ec4899', icon: Globe, label: 'İngilizce' },
};

// LGS Question Limits (Hard Rules)
const LGS_LIMITS: Record<string, number> = {
  'Türkçe': 20,
  'Matematik': 20,
  'Fen Bilimleri': 20,
  'T.C. İnkılap Tarihi': 10,
  'Din Kültürü': 10,
  'İngilizce': 10
};

// Fallback for non-standard names with improved matching for new subjects
const getLessonConfig = (lessonName: string) => {
  const lower = (lessonName || "").toLocaleLowerCase('tr-TR');
  
  // Science
  if (lower.includes('fen')) return LESSON_CONFIG['Fen Bilimleri'];
  
  // Math
  if (lower.includes('mat')) return LESSON_CONFIG['Matematik'];
  
  // Turkish
  if (lower.includes('türk') || lower.includes('turk') || lower.includes('edebiyat')) return LESSON_CONFIG['Türkçe'];
  
  // History / Revolution
  if (lower.includes('inkılap') || lower.includes('inkilap') || lower.includes('atatürk') || lower.includes('sosyal') || lower.includes('tarih')) {
      return LESSON_CONFIG['T.C. İnkılap Tarihi'];
  }
  
  // Religion
  if (lower.includes('din') || lower.includes('kültür') || lower.includes('ahlak') || lower.includes('dkab')) {
      return LESSON_CONFIG['Din Kültürü'];
  }
  
  // English / Language
  if (lower.includes('ingilizce') || lower.includes('yabancı') || lower.includes('dil') || lower.includes('english')) {
      return LESSON_CONFIG['İngilizce'];
  }

  return LESSON_CONFIG[lessonName] || { color: '#64748b', icon: BookOpen, label: lessonName || 'Ders' };
};

// Helper to get limit based on lesson name
const getLessonLimit = (lessonName: string) => {
    const config = getLessonConfig(lessonName);
    return LGS_LIMITS[config.label] || 20; // Default to 20 if unknown
};

// Helper to determine icon for simulation step based on title
const getSimulationStepConfig = (title: string) => {
    // Try to find a lesson name within the title (e.g. "Matematik Net Artışı")
    const lessonConfig = getLessonConfig(title);
    
    // Check if the returned config is one of our known standard configs
    const isKnownConfig = Object.values(LESSON_CONFIG).some(conf => conf.label === lessonConfig.label);
    
    if (isKnownConfig) {
        return lessonConfig;
    }
    
    return { color: '#f59e0b', icon: Rocket, label: 'Genel Strateji' };
};

// Helper to determine status based on percentage logic (Fail-safe for frontend)
const getStatusByPercentage = (percentage: number): 'Mükemmel' | 'İyi' | 'Geliştirilmeli' | 'Kritik' => {
    if (percentage >= 80) return 'Mükemmel';
    if (percentage >= 70) return 'İyi';
    if (percentage >= 50) return 'Geliştirilmeli';
    return 'Kritik';
};

// --- STRICT SCORE FORMATTER ---
// 1. Noktadan önceki tam sayı kısmını al.
// 2. Noktadan sonraki kısmı matematiksel olarak yuvarlayarak tam 3 bas
