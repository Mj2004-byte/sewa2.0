import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { ShieldCheck, CheckCircle2, AlertOctagon, FileJson, RefreshCw, MapPin, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

export default function AuthorityDashboard() {
  const { t } = useTranslation();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    fetchDashboardClusters();
  }, []);

  const fetchDashboardClusters = () => {
    setLoading(true);
    const token = localStorage.getItem('sewa_token');
    fetch('/api/authority/clusters', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then(data => {
        setClusters(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching authority dashboard clusters:", err);
        setClusters([]);
        setLoading(false);
      });
  };

  const handleResolve = async (clusterId) => {
    const token = localStorage.getItem('sewa_token');
    try {
      const res = await fetch(`/api/authority/clusters/${clusterId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMessage(`Cluster #${clusterId} marked RESOLVED.`);
        fetchDashboardClusters();
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  const handleAcknowledge = async (clusterId) => {
    const token = localStorage.getItem('sewa_token');
    try {
      const res = await fetch(`/api/authority/clusters/${clusterId}/acknowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMessage(`Cluster #${clusterId} ACKNOWLEDGED.`);
        fetchDashboardClusters();
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      console.error("Acknowledge error:", err);
    }
  };

  const toggleExpand = (id) => {
    setExpandedClusterId(expandedClusterId === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12 flex flex-col gap-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
            <ShieldCheck size={16} />
            <span>Administrative Officer Console</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 font-sans mt-1">
            {t('authority_title')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review active municipal issue clusters, respond to grievances, and resolve cases before autonomous SLA escalation fires.
          </p>
        </div>
        <button
          onClick={fetchDashboardClusters}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw size={14} /> Refresh Feed
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Cluster List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 glass-panel border border-slate-800/80">
          <RefreshCw className="animate-spin text-orange-500 mb-2" size={24} />
          <span className="text-xs text-slate-400">Loading jurisdiction dashboard...</span>
        </div>
      ) : clusters.length === 0 ? (
        <div className="glass-panel p-12 text-center border border-slate-800/80">
          <span className="text-slate-400 text-sm">{t('no_cases')}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clusters.map((c) => {
            const isExpanded = expandedClusterId === c.id;
            return (
              <div
                key={c.id}
                className={`glass-panel border transition-all ${
                  c.status === 'escalated' ? 'border-red-800/80 bg-red-950/10' :
                  c.status === 'resolved' ? 'border-emerald-800/60 bg-emerald-950/10' :
                  'border-slate-800/80'
                }`}
              >
                {/* Header Row */}
                <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        c.category === 'emergency' ? 'bg-red-950 border-red-800 text-red-400' :
                        c.category === 'pothole' ? 'bg-orange-950 border-orange-800 text-orange-400' :
                        c.category === 'garbage' ? 'bg-lime-950 border-lime-800 text-lime-400' :
                        'bg-slate-900 border-slate-700 text-slate-300'
                      }`}>
                        {c.category.toUpperCase()}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        c.status === 'resolved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        c.status === 'escalated' ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse' :
                        'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}>
                        {c.status}
                      </span>

                      {c.escalation_level > 0 && (
                        <span className="text-[10px] bg-red-900/60 text-red-200 border border-red-700 font-extrabold px-2 py-0.5 rounded">
                          ESCALATED LEVEL {c.escalation_level}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-100 font-sans mt-0.5">
                      Cluster #{c.id} — Centroid ({c.latitude.toFixed(5)}, {c.longitude.toFixed(5)})
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users size={13} className="text-orange-400" />
                        <strong>{c.report_count}</strong> {t('report_count')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-500" />
                        First Filing: {new Date(c.first_reported_at).toLocaleString()}
                      </span>
                    </div>

                    {c.escalation_reason && (
                      <div className="text-[11px] text-red-300 bg-red-950/60 border border-red-800/80 p-2 rounded-lg mt-1">
                        ⚠️ <strong>Escalation Reason:</strong> {c.escalation_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status !== 'resolved' && (
                      <>
                        {c.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(c.id)}
                            className="px-3 py-1.5 bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 text-xs font-semibold rounded-lg transition-all"
                          >
                            {t('btn_acknowledge')}
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(c.id)}
                          className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow transition-all"
                        >
                          {t('btn_resolve')}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-lg"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details & Child Filings */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800/80 bg-slate-950/60 flex flex-col gap-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Individual Citizen Filings in this Cluster ({c.reports.length})
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {c.reports.map((rep) => (
                        <div key={rep.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex gap-3">
                          <img
                            src={rep.media_url}
                            className="w-16 h-16 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                            alt=""
                          />
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-bold text-slate-200">Filing #{rep.id}</span>
                            <p className="text-slate-400 text-[11px] leading-tight">
                              {rep.description || "Media submitted."}
                            </p>
                            <span className="text-[10px] text-slate-500 mt-auto">
                              Severity: {rep.severity}/10 • {new Date(rep.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {c.status === 'escalated' && (
                      <div className="flex justify-end mt-2">
                        <a
                          href={`http://localhost:8000/static/evidence_cluster_${c.id}.json`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition-all"
                        >
                          <FileJson size={14} className="text-orange-400" />
                          <span>{t('view_packet')}</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
