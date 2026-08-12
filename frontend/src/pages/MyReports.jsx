import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { Calendar, MapPin, Eye, FileText, ChevronRight, CheckCircle2, AlertOctagon, RefreshCw, X, ShieldCheck } from 'lucide-react';

export default function MyReports() {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    fetchMyReports();
  }, []);

  const fetchMyReports = () => {
    setLoading(true);
    const token = localStorage.getItem('sewa_token');
    fetch('/api/reports/my', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setReports(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading my reports:", err);
        setLoading(false);
      });
  };

  const handleOpenTimeline = (id) => {
    setSelectedReportId(id);
    setLoadingTimeline(true);
    const token = localStorage.getItem('sewa_token');
    fetch(`/api/reports/${id}/timeline`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTimelineData(data);
        setLoadingTimeline(false);
      })
      .catch(err => {
        console.error("Error fetching timeline:", err);
        setLoadingTimeline(false);
      });
  };

  const handleTriggerSaarthi = async (clusterId) => {
    const token = localStorage.getItem('sewa_token');
    try {
      const res = await fetch(`/api/saarthi/trigger/${clusterId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(`🤝 Saarthi Alliance Activated! ${data.distinct_citizens_united} citizens united. Contractor demand notice sent to ${data.contractor_notified} (${data.contractor_email}).`);
      } else {
        alert(data.detail || "Saarthi trigger failed.");
      }
    } catch {
      alert("Error contacting Saarthi Agent.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Resolved</span>;
      case 'escalated':
        return <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase animate-pulse">Escalated</span>;
      case 'acknowledged':
        return <span className="bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Acknowledged</span>;
      default:
        return <span className="bg-slate-900 text-slate-400 border border-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Submitted</span>;
    }
  };

  const getTimelineIcon = (status) => {
    switch (status) {
      case 'submitted':
        return <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs">📥</div>;
      case 'analyzed':
        return <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-xs">🤖</div>;
      case 'notified':
        return <div className="w-8 h-8 rounded-full bg-orange-950 border border-orange-800 flex items-center justify-center text-xs">📢</div>;
      case 'escalated':
        return <div className="w-8 h-8 rounded-full bg-red-950 border border-red-800 flex items-center justify-center text-xs">🚨</div>;
      case 'resolved':
        return <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-xs text-emerald-400">✓</div>;
      default:
        return <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs">📌</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8 flex flex-col md:flex-row gap-6 relative">
      
      {/* Reports List Column */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
            {t('my_reports_title')} ({reports.length})
          </h2>
          <button
            onClick={fetchMyReports}
            className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-12 glass-panel border border-slate-800/80">
            <Loader2 className="animate-spin text-orange-500" size={24} />
            <span className="text-xs text-slate-400 mt-2">Loading your filed grievances...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="glass-panel p-8 text-center border border-slate-800/80">
            <span className="text-slate-500 text-sm">{t('no_reports')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div
                key={r.id}
                onClick={() => handleOpenTimeline(r.id)}
                className={`p-4 bg-slate-900/60 hover:bg-slate-900 border rounded-2xl cursor-pointer transition-all flex items-center justify-between group shadow-sm ${
                  selectedReportId === r.id ? 'border-orange-500/50 shadow-orange-950/20' : 'border-slate-800/80'
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <img
                    src={r.media_url}
                    className="w-14 h-14 rounded-lg object-cover bg-slate-950 border border-slate-800"
                    alt=""
                    onError={(e) => {
                      // Fallback if image isn't loaded/static serving failed
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        {r.category === 'animal' ? t('animal') : r.category === 'pothole' ? t('pothole') : r.category === 'garbage' ? t('garbage') : r.category === 'emergency' ? t('emergency') : t('other')}
                      </span>
                      {getStatusBadge(r.status)}
                    </div>
                    
                    <p className="text-xs text-slate-400 font-sans truncate pr-4">
                      {r.description || "Civic complaint logged."}
                    </p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <Calendar size={10} />
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Timeline Slideout Drawer / Panel (Right Column on Desktop, overlay on Mobile) */}
      {selectedReportId && (
        <div className="w-full md:w-[360px] glass-panel border border-slate-800 p-6 flex flex-col gap-4 sticky top-4 h-fit max-h-[85vh] overflow-y-auto animate-fade-in shrink-0 z-10 shadow-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-orange-500" />
              <span>{t('timeline_view')}</span>
            </h3>
            <button
              onClick={() => setSelectedReportId(null)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>

          {loadingTimeline ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-orange-500" size={24} />
              <span className="text-[10px] text-slate-500 mt-2">Compiling audit trails...</span>
            </div>
          ) : !timelineData ? (
            <span className="text-xs text-slate-500">Error rendering timeline.</span>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Media Thumbnail */}
              <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                <img
                  src={timelineData.report.media_url}
                  className="w-12 h-12 rounded-lg object-cover"
                  alt=""
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]" style={{ color: timelineData.report.severity > 7 ? '#ef4444' : '#eab308' }}>
                    Severity: {timelineData.report.severity.toFixed(1)}/10
                  </span>
                  <span className="text-slate-400 text-[10px] truncate max-w-[180px]">
                    {timelineData.report.description || "Civic filing."}
                  </span>
                </div>
              </div>

              {/* Vertical Timeline Steps */}
              <div className="relative border-l border-slate-800 ml-4 pl-6 flex flex-col gap-5">
                {timelineData.timeline.map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Floating circular icon marker */}
                    <div className="absolute -left-[40px] top-0.5">
                      {getTimelineIcon(step.status)}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">{step.title}</span>
                      <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                        {step.description}
                      </p>
                      <span className="text-[9px] text-slate-500 mt-1">
                        {new Date(step.date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Saarthi Community Alliance Action Button */}
              {timelineData.report.cluster_id && (
                <button
                  type="button"
                  onClick={() => handleTriggerSaarthi(timelineData.report.cluster_id)}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <span>🤝 Trigger Saarthi (सारथी) Community Alliance</span>
                </button>
              )}

              {/* Legal accountability disclaimer */}
              <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-slate-900 text-[10px] text-slate-500 font-sans leading-normal">
                🛡️ This log constitutes a legally accountable governance trail. System-generated emails are archived for municipal transparency audits.
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small loader wrapper
function Loader2({ className, size }) {
  return <RefreshCw className={`${className} animate-spin`} size={size} />;
}
