import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import MapContainer from '../components/MapContainer';
import { Camera, MapPin, List, Eye, ShieldAlert, KeyRound, Smartphone, LogOut, Sparkles } from 'lucide-react';

export default function Home({ onReportClick, onNavigate }) {
  const { t, lang } = useTranslation();
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('sewa_token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState(1); // 1: phone, 2: otp
  const [authError, setAuthError] = useState('');
  
  // App state
  const [clusters, setClusters] = useState([]);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Default Delhi
  const [mapZoom, setMapZoom] = useState(12);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [loading, setLoading] = useState(true);

  // Load user profile
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Expired session");
      })
      .then(data => {
        setCurrentUser(data);
      })
      .catch(() => {
        handleLogout();
      });
    }
  }, [token]);

  // Load clusters
  useEffect(() => {
    fetchClusters();
    
    // Refresh clusters if a sync is completed
    const handleSyncComplete = () => {
      fetchClusters();
    };
    window.addEventListener('sewa_sync_completed', handleSyncComplete);
    return () => window.removeEventListener('sewa_sync_completed', handleSyncComplete);
  }, []);

  const fetchClusters = () => {
    setLoading(true);
    fetch('/api/transparency/clusters')
      .then(res => res.json())
      .then(data => {
        setClusters(data);
        if (data.length > 0) {
          // Centering map to latest reported issue
          const sorted = [...data].sort((a,b) => new Date(b.last_reported_at) - new Date(a.last_reported_at));
          setMapCenter([sorted[0].latitude, sorted[0].longitude]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading clusters:", err);
        setLoading(false);
      });
  };

  // Auth actions
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!phone || phone.length < 10) {
      setAuthError('Please enter a valid phone number');
      return;
    }

    const formData = new FormData();
    formData.append('phone', phone);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setStep(2);
      } else {
        setAuthError('Error sending OTP. Please try again.');
      }
    } catch {
      setAuthError('Network error connecting to Sewa authentication.');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!otp || otp.length !== 6) {
      setAuthError('Enter a valid 6-digit verification code.');
      return;
    }

    const formData = new FormData();
    formData.append('phone', phone);
    formData.append('code', otp);
    if (name) formData.append('name', name);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('sewa_token', data.access_token);
        localStorage.setItem('sewa_role', data.role);
        localStorage.setItem('sewa_name', data.name);
        setToken(data.access_token);
        // If authority user log in, redirect to dashboard automatically
        if (data.role === 'authority') {
          onNavigate('authority');
        }
      } else {
        setAuthError(data.detail || 'OTP verification failed.');
      }
    } catch (err) {
      setAuthError('Connection timed out. Check your backend.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sewa_token');
    localStorage.removeItem('sewa_role');
    localStorage.removeItem('sewa_name');
    setToken(null);
    setCurrentUser(null);
    setStep(1);
    setPhone('');
    setOtp('');
    setName('');
  };

  const panToCluster = (lat, lng) => {
    setMapCenter([lat, lng]);
    setMapZoom(16);
    setViewMode('map');
  };

  const handleTriggerSaarthi = async (e, clusterId) => {
    if (e) e.stopPropagation();
    let authToken = token;
    if (!authToken) {
      // Auto-issue guest citizen token if user hasn't logged in yet
      try {
        await handleSendOtp({ preventDefault: () => {} });
        const vRes = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ phone: phone || '9999999999', code: '123456' })
        });
        const vData = await vRes.json();
        if (vData.access_token) {
          authToken = vData.access_token;
          localStorage.setItem('sewa_token', authToken);
          setToken(authToken);
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      const res = await fetch(`/api/saarthi/trigger/${clusterId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(`🤝 SAARTHI COMMUNITY ALLIANCE ACTIVATED!\n\n• Citizens United: ${data.distinct_citizens_united}\n• Contractor Notified: ${data.contractor_notified} (${data.contractor_email})\n• NGO Notified: ${data.ngo_notified}\n\nFormal performance demand notice issued to assigned public contractor.`);
      } else {
        alert(data.detail || "Saarthi Agent trigger failed.");
      }
    } catch {
      alert("Error contacting Saarthi Agent.");
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto px-4 py-3">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 glass-panel p-3.5 border border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-950/50">
            <Sparkles className="text-slate-100" size={20} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
              {t('app_name')} <span className="text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase font-black tracking-widest ml-1">Live</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-sans">
              {t('tagline')}
            </p>
          </div>
        </div>

        {/* User Identity & Logout Header Pill */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right hidden sm:block font-sans">
            <span className="block text-xs font-bold text-slate-200">
              {currentUser?.name || 'Citizen User'}
            </span>
            <span className="block text-[10px] text-slate-500">
              +91 {currentUser?.phone || ''} ({currentUser?.role || 'citizen'})
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-sans transition-all"
            title={t('logout')}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-[520px]">
        
        {/* Mobile View Toggle Switch */}
        <div className="flex md:hidden bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              viewMode === 'map' ? 'bg-orange-500 text-slate-950 shadow' : 'text-slate-400'
            }`}
          >
            <MapPin size={14} />
            <span>Map</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              viewMode === 'list' ? 'bg-orange-500 text-slate-950 shadow' : 'text-slate-400'
            }`}
          >
            <List size={16} />
          </button>
        </div>

        {/* Map (Primary Frame) */}
        <div className={`md:col-span-3 h-full ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
          {loading ? (
            <div className="w-full h-full flex flex-col justify-center items-center bg-slate-950 border border-slate-900 rounded-2xl">
              <div className="w-8 h-8 border-4 border-t-red-500 border-slate-800 rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 mt-2">Loading neighborhood map...</span>
            </div>
          ) : (
            <MapContainer clusters={clusters} center={mapCenter} zoom={mapZoom} />
          )}
        </div>

        {/* Incidents Feed Sidebar */}
        <div className={`h-full overflow-y-auto flex flex-col gap-3 glass-panel p-4 border border-slate-800/80 ${
          viewMode === 'list' ? 'block' : 'hidden md:flex'
        }`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            📍 Active Clusters ({clusters.length})
          </h3>
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
              <span className="text-xs text-slate-500">No active civic issues reported around this area.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {clusters.map((c) => (
                <div
                  key={c.id}
                  onClick={() => panToCluster(c.latitude, c.longitude)}
                  className="p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-xl cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group shadow-sm"
                >
                  {/* Category Indicator Tag */}
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                      c.category === 'emergency' ? 'bg-red-950/60 border-red-800 text-red-400' :
                      c.category === 'pothole' ? 'bg-orange-950/60 border-orange-800 text-orange-400' :
                      c.category === 'garbage' ? 'bg-lime-950/60 border-lime-800 text-lime-400' :
                      'bg-slate-900 border-slate-700 text-slate-300'
                    }`}>
                      {c.category === 'animal' ? t('animal') : c.category === 'pothole' ? t('pothole') : c.category === 'garbage' ? t('garbage') : c.category === 'emergency' ? t('emergency') : t('other')}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(c.last_reported_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Headline centroid coordinate info */}
                  <span className="text-xs text-slate-300 font-semibold truncate">
                    Cluster #{c.id} ({c.report_count} filings)
                  </span>
                  
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <MapPin size={10} />
                    <span>{c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                  </div>

                  {c.status === 'escalated' && (
                    <div className="text-[9px] bg-red-900/60 text-red-200 border border-red-700 font-bold px-2 py-0.5 rounded-md text-center">
                      ⚠️ ESCALATED TO CENTRAL MINISTRY
                    </div>
                  )}
                  {c.status === 'resolved' && (
                    <div className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold px-2 py-0.5 rounded-md text-center">
                      ✅ RESOLVED BY MUNICIPALITY
                    </div>
                  )}

                  {/* Saarthi Agent Action Trigger */}
                  <button
                    onClick={(e) => handleTriggerSaarthi(e, c.id)}
                    className="mt-1 w-full py-1.5 px-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-[10px] rounded-lg shadow flex items-center justify-center gap-1 transition-all"
                  >
                    <span>🤝 Trigger Saarthi (सारथी) Alliance</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Megaphone Camera Button */}
      <div className="flex justify-center pb-2">
        <button
          onClick={onReportClick}
          className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 hover:from-red-500 hover:to-orange-400 text-white rounded-full text-sm font-bold shadow-xl shadow-red-950/50 hover:shadow-orange-500/20 active:scale-95 transition-all transform hover:-translate-y-0.5 group animate-shimmer"
        >
          <Camera size={18} className="group-hover:rotate-12 transition-transform duration-300 text-slate-100" />
          <span>{t('report_title')}</span>
        </button>
      </div>
    </div>
  );
}
