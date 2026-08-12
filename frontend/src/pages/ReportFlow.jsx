import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import CameraCapture from '../components/CameraCapture';
import { enqueueReport } from '../components/OfflineQueue';
import { MapPin, WifiOff, FileCheck2, Loader2, Sparkles, Send } from 'lucide-react';

export default function ReportFlow({ onReportComplete, onCancel }) {
  const { t } = useTranslation();

  // Media capture state
  const [mediaBlob, setMediaBlob] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video' | 'audio'
  const [caption, setCaption] = useState('');
  
  // GPS state
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('fetching'); // 'fetching' | 'ready' | 'failed'

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch coordinates on screen mount
  useEffect(() => {
    fetchGPS();
  }, []);

  const fetchGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('failed');
      return;
    }
    
    setGpsStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsStatus('ready');
      },
      (err) => {
        console.error("GPS Error:", err);
        setGpsStatus('failed');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleMediaCapture = (blob, type) => {
    setMediaBlob(blob);
    setMediaType(type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const isOnline = navigator.onLine;

    // Determine file extensions
    let extension = 'jpg';
    let mimeType = 'image/jpeg';
    if (mediaType === 'video') {
      extension = 'mp4';
      mimeType = 'video/mp4';
    } else if (mediaType === 'audio') {
      extension = 'mp3';
      mimeType = 'audio/mpeg';
    }

    const file = new File([mediaBlob], `incident_capture.${extension}`, { type: mimeType });

    if (!isOnline) {
      // offline fallback - queue locally
      try {
        await enqueueReport(file, caption, latitude || 28.6139, longitude || 77.2090, mediaType);
        setSubmitSuccess(true);
        setSubmitting(false);
        setTimeout(() => {
          onReportComplete();
        }, 3000);
      } catch (err) {
        setErrorMsg('Failed to queue report offline. Please try again.');
        setSubmitting(false);
      }
      return;
    }

    // Live submission
    const token = localStorage.getItem('sewa_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('latitude', latitude || 28.6139);
    formData.append('longitude', longitude || 77.2090);
    formData.append('caption', caption);

    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        setSubmitSuccess(true);
        setSubmitting(false);
        setTimeout(() => {
          onReportComplete();
        }, 2000);
      } else if (res.status === 401) {
        localStorage.removeItem('sewa_token');
        localStorage.removeItem('sewa_role');
        setErrorMsg('Your session has expired. Please log in again.');
        setSubmitting(false);
        setTimeout(() => {
          onCancel(); // Return to home/login screen
        }, 2000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || 'Filing failed. Server error.');
        setSubmitting(false);
      }
    } catch (err) {
      setErrorMsg('Connection error. Saving to local storage fallback instead.');
      
      // Fallback queue offline if upload request fails
      try {
        await enqueueReport(file, caption, latitude || 28.6139, longitude || 77.2090, mediaType);
        setSubmitSuccess(true);
        setSubmitting(false);
        setTimeout(() => {
          onReportComplete();
        }, 3000);
      } catch {
        setErrorMsg('Offline backup failed. Try again.');
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold font-sans tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
          {t('report_title')}
        </h2>
        <p className="text-xs text-slate-400 mt-1">{t('report_desc')}</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs mb-4">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Media Capture Phase */}
      {!mediaBlob && (
        <CameraCapture onCapture={handleMediaCapture} onCancel={onCancel} />
      )}

      {/* Review & Caption Submission Phase */}
      {mediaBlob && !submitSuccess && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 border border-slate-800/80 flex flex-col gap-5">
          
          {/* Geolocation Tag Banner */}
          <div className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-900 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <MapPin className={gpsStatus === 'ready' ? 'text-emerald-500' : 'text-orange-500 animate-pulse'} size={16} />
              <div className="flex flex-col">
                <span className="font-semibold text-slate-300">
                  {gpsStatus === 'ready' ? t('gps_ready') : t('gps_fetching')}
                </span>
                {gpsStatus === 'ready' && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Lat: {latitude?.toFixed(5)}, Lng: {longitude?.toFixed(5)}
                  </span>
                )}
              </div>
            </div>
            
            {gpsStatus !== 'ready' && (
              <button
                type="button"
                onClick={fetchGPS}
                className="px-2 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded text-[10px]"
              >
                Retry GPS
              </button>
            )}
          </div>

          {/* Captured Media Mini Preview */}
          <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
            {mediaType === 'image' && (
              <img
                src={URL.createObjectURL(mediaBlob)}
                className="w-full h-full object-cover"
                alt="Captured Issue"
              />
            )}
            {mediaType === 'video' && (
              <video
                src={URL.createObjectURL(mediaBlob)}
                controls
                className="w-full h-full object-contain"
              />
            )}
            {mediaType === 'audio' && (
              <div className="flex flex-col items-center justify-center w-full h-full text-xs text-orange-500 gap-1 bg-slate-900">
                <span>🔊 Voice Grievance Details Captured</span>
                <audio src={URL.createObjectURL(mediaBlob)} controls className="w-[80%] mt-2" />
              </div>
            )}
          </div>

          {/* User Caption Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description / Landmark</label>
            <textarea
              placeholder={t('caption_placeholder')}
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-orange-500 focus:outline-none text-slate-100 text-sm font-sans"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMediaBlob(null); setMediaType(null); }}
              className="w-1/3 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all"
              disabled={submitting}
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>{t('btn_submitting')}</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>{t('btn_submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Submission Success Screen */}
      {submitSuccess && (
        <div className="glass-panel p-8 border border-slate-800/80 flex flex-col items-center justify-center text-center animate-bounce-short">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-4">
            <FileCheck2 className="text-emerald-500 animate-pulse" size={32} />
          </div>
          
          <h3 className="text-lg font-bold text-slate-100 font-sans">
            {navigator.onLine ? "Filing Logged Successfully!" : "Saved to Offline Queue!"}
          </h3>
          <p className="text-xs text-slate-400 mt-2 max-w-xs">
            {navigator.onLine 
              ? "The Multi-Agent AI system is classifying the media and routing alerts to local municipal engineers."
              : "No connection detected. Your report has been saved locally. We will automatically submit it to the authorities when you go back online."
            }
          </p>
          <div className="flex gap-2 items-center text-[10px] text-orange-400 mt-4 bg-orange-950/20 border border-orange-900/60 px-3 py-1 rounded-full">
            <Sparkles size={12} />
            <span>AI Pipeline Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
