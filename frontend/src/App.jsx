import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LanguageProvider, useTranslation } from './utils/translate';
import LanguageSelector from './components/LanguageSelector';
import OfflineQueue from './components/OfflineQueue';
import Chatbot from './components/Chatbot';

// Pages
import Home from './pages/Home';
import ReportFlow from './pages/ReportFlow';
import MyReports from './pages/MyReports';
import PublicTransparency from './pages/PublicTransparency';
import AuthorityDashboard from './pages/AuthorityDashboard';

// Icons
import { MapPin, Camera, Clock, BarChart2, Shield, Sparkles } from 'lucide-react';

function AppContent() {
  const { t } = useTranslation();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'report' | 'my' | 'transparency' | 'authority'

  // Auto-transition splash screen after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* 1. ANIMATED 3-SECOND SPLASH SCREEN WITH INSTANT DISMISS */}
      {showSplash && (
        <div
          onClick={() => setShowSplash(false)}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 cursor-pointer animate-fade-in"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 80%)'
          }}
        >
          <div className="flex flex-col items-center text-center px-4">
            {/* Animated Emblem */}
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-orange-500/40 absolute -inset-2 animate-spin-slow" />
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl shadow-red-950/80">
                <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                  S
                </span>
              </div>
            </div>

            {/* Logo / Wordmark */}
            <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-red-600 font-sans">
              Sewa
            </h1>

            <p className="text-xs text-slate-400 font-medium tracking-wide mt-2">
              Civic Issue Reporting & Escalation Platform
            </p>

            {/* Mandatory Credit */}
            <span className="text-xs text-orange-400/90 font-semibold tracking-widest uppercase mt-6 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
              Developed by Manish
            </span>
            <span className="text-[10px] text-slate-500 mt-3 animate-pulse">
              Tap anywhere to enter portal
            </span>
          </div>
        </div>
      )}

      {/* 2. MAIN APPLICATION CONTENT */}
      {!showSplash && (
        <div className="flex flex-col min-h-screen">
          
          {/* Navigation Bar */}
          <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              
              {/* Brand Logo */}
              <div
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md group-hover:scale-105 transition-transform">
                  S
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-extrabold text-slate-100 tracking-tight leading-none font-sans">
                    Sewa
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">
                    Civic Platform
                  </span>
                </div>
              </div>

              {/* Desktop Nav Items */}
              <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1 shadow-inner">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'home' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MapPin size={14} /> {t('nav_home')}
                </button>
                <button
                  onClick={() => setActiveTab('report')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'report' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera size={14} /> {t('nav_report')}
                </button>
                <button
                  onClick={() => setActiveTab('my')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'my' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock size={14} /> {t('nav_my_reports')}
                </button>
                <button
                  onClick={() => setActiveTab('transparency')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'transparency' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 size={14} /> {t('nav_transparency')}
                </button>
                <button
                  onClick={() => setActiveTab('authority')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'authority' ? 'bg-red-950 text-red-400 border border-red-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield size={14} /> {t('nav_authority')}
                </button>

                <button
                  onClick={async () => {
                    if (window.triggerSaarthiFromMap) {
                      await window.triggerSaarthiFromMap(1);
                    } else {
                      alert("Saarthi Agent is active. Select any cluster on the map or feed to trigger alliance notices.");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow hover:from-orange-500 hover:to-amber-500 transition-all"
                >
                  <span>🤝 Saarthi (सारथी)</span>
                </button>
              </nav>

              {/* Language Selector Toggle */}
              <LanguageSelector />
            </div>
          </header>

          {/* Main Body Screen Rendering */}
          <main className="flex-1 py-4">
            {activeTab === 'home' && (
              <Home
                onReportClick={() => setActiveTab('report')}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === 'report' && (
              <ReportFlow
                onReportComplete={() => setActiveTab('my')}
                onCancel={() => setActiveTab('home')}
              />
            )}
            {activeTab === 'my' && <MyReports />}
            {activeTab === 'transparency' && <PublicTransparency />}
            {activeTab === 'authority' && <AuthorityDashboard />}
          </main>

          {/* Mobile Bottom Sticky Navigation */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/80 px-2 py-2 backdrop-blur-md">
            <div className="flex items-center justify-around">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 p-1 text-[10px] font-semibold ${
                  activeTab === 'home' ? 'text-orange-400' : 'text-slate-500'
                }`}
              >
                <MapPin size={18} />
                <span>{t('nav_home')}</span>
              </button>

              <button
                onClick={() => setActiveTab('my')}
                className={`flex flex-col items-center gap-1 p-1 text-[10px] font-semibold ${
                  activeTab === 'my' ? 'text-orange-400' : 'text-slate-500'
                }`}
              >
                <Clock size={18} />
                <span>Timeline</span>
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full -mt-6 shadow-lg border-4 border-slate-950"
              >
                <Camera size={20} />
              </button>

              <button
                onClick={() => setActiveTab('transparency')}
                className={`flex flex-col items-center gap-1 p-1 text-[10px] font-semibold ${
                  activeTab === 'transparency' ? 'text-orange-400' : 'text-slate-500'
                }`}
              >
                <BarChart2 size={18} />
                <span>Stats</span>
              </button>

              <button
                onClick={() => setActiveTab('authority')}
                className={`flex flex-col items-center gap-1 p-1 text-[10px] font-semibold ${
                  activeTab === 'authority' ? 'text-red-400' : 'text-slate-500'
                }`}
              >
                <Shield size={18} />
                <span>Portal</span>
              </button>
            </div>
          </div>

          {/* Offline Sync Toast Component */}
          <OfflineQueue />

          {/* GenAI Chatbot Assistant */}
          <Chatbot />
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[React ErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-2">⚠️ Application Encountered an Issue</h2>
            <p className="text-xs text-slate-400 mb-4">{this.state.error?.toString() || "Unknown rendering exception."}</p>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow"
            >
              Reset Session & Reload Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
