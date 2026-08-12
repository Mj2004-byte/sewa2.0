import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { BarChart3, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Layers } from 'lucide-react';

export default function PublicTransparency() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = () => {
    setLoading(true);
    fetch('/api/transparency/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading transparency stats:", err);
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin text-orange-500 mb-2" size={28} />
        <span className="text-xs text-slate-400 font-sans">Loading public ward analytics...</span>
      </div>
    );
  }

  const categoryLabels = {
    pothole: t('pothole'),
    garbage: t('garbage'),
    animal: t('animal'),
    emergency: t('emergency'),
    other: t('other')
  };

  const categoryColors = {
    pothole: 'bg-orange-500',
    garbage: 'bg-lime-500',
    animal: 'bg-yellow-500',
    emergency: 'bg-red-500',
    other: 'bg-slate-500'
  };

  const total = stats?.total_filings || 1;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-12 flex flex-col gap-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
            <ShieldCheck size={16} />
            <span>Public Governance Portal</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 font-sans mt-1">
            {t('transparency_title')}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {t('trans_desc')}
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 border border-slate-800/80 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('stat_total')}</span>
          <span className="text-3xl font-extrabold text-slate-100 font-sans">{stats?.total_filings || 0}</span>
          <span className="text-[10px] text-slate-500 mt-1">Verified citizen entries</span>
        </div>

        <div className="glass-card p-5 border border-slate-800/80 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{t('stat_resolved')}</span>
          <span className="text-3xl font-extrabold text-emerald-400 font-sans">{stats?.resolved_filings || 0}</span>
          <span className="text-[10px] text-emerald-500/80 mt-1">Actioned by departments</span>
        </div>

        <div className="glass-card p-5 border border-slate-800/80 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">{t('stat_active')}</span>
          <span className="text-3xl font-extrabold text-orange-400 font-sans">{stats?.active_filings || 0}</span>
          <span className="text-[10px] text-orange-500/80 mt-1">Under SLA countdown</span>
        </div>

        <div className="glass-card p-5 border border-slate-800/80 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{t('stat_rate')}</span>
          <span className="text-3xl font-extrabold text-indigo-400 font-sans">{stats?.resolution_rate || 0}%</span>
          <span className="text-[10px] text-indigo-500/80 mt-1">SLA closure ratio</span>
        </div>
      </div>

      {/* Incident Category Distribution Bar Chart */}
      <div className="glass-panel p-6 border border-slate-800/80 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-orange-500" size={20} />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            {t('category_breakdown')}
          </h3>
        </div>

        <div className="flex flex-col gap-4">
          {stats?.category_breakdown && Object.entries(stats.category_breakdown).map(([cat, count]) => {
            const percentage = Math.round((count / total) * 100) || 0;
            const barColor = categoryColors[cat] || 'bg-slate-500';
            return (
              <div key={cat} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">
                    {categoryLabels[cat] || cat}
                  </span>
                  <span className="font-mono text-slate-400">
                    {count} filings ({percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                  <div
                    className={`h-full ${barColor} transition-all duration-700 rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Autonomous Escalation System Overview */}
      <div className="glass-panel p-6 border border-slate-800/80 flex flex-col gap-3 text-xs text-slate-400">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Layers size={16} className="text-red-500" />
          Autonomous Multi-Tier Escalation Guarantee
        </h4>
        <p className="leading-relaxed">
          Sewa continuously monitors all open grievance clusters against official Municipal Service Level Agreements (SLAs). If an issue breaches its SLA window (e.g. 5+ pothole filings left unaddressed for 48 hours), the system automatically compiles a digital evidence packet ( photos, GPS logs, timestamps) and escalates the case directly to the Ministry of Road Transport & Highways without human administrative intervention.
        </p>
      </div>

    </div>
  );
}
