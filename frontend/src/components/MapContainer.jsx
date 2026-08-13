import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Trash, ShieldAlert, Sparkles, HeartPulse } from 'lucide-react';

export default function MapContainer({ clusters, center = [28.6139, 77.2090], zoom = 12 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Initialize map if it doesn't exist
    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(center, zoom);

      // Dark Theme Tiles (CartoDB Dark Matter tile server looks extremely modern and premium!)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);

      // Add zoom control at bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(map);

      mapRef.current = map;
    }

    // Update map view when center coordinates change
    if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  }, [center]);

  // Handle marker updates
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Category styling configurations
    const markerStyles = {
      pothole: {
        color: '#f97316', // Orange
        bgClass: 'bg-orange-500/20 border-orange-500 text-orange-400',
        icon: '⚠️'
      },
      garbage: {
        color: '#84cc16', // Lime
        bgClass: 'bg-lime-600/20 border-lime-500 text-lime-400',
        icon: '♻️'
      },
      animal: {
        color: '#eab308', // Yellow
        bgClass: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
        icon: '🐾'
      },
      emergency: {
        color: '#ef4444', // Red
        bgClass: 'bg-red-500/30 border-red-500 text-red-400 animate-ping-slow',
        icon: '🚨',
        pulse: true
      },
      other: {
        color: '#64748b', // Gray
        bgClass: 'bg-slate-600/20 border-slate-500 text-slate-400',
        icon: '📌'
      }
    };

    // Draw new markers
    clusters.forEach((cluster) => {
      const { id, latitude, longitude, category, report_count, status, escalation_level } = cluster;
      const style = markerStyles[category] || markerStyles.other;

      // Custom HTML Marker using L.divIcon
      const pulseHtml = style.pulse 
        ? `<div class="absolute -inset-2 rounded-full bg-red-500/30 animate-ping"></div>`
        : '';
        
      const markerHtml = `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 ${style.bgClass} shadow-lg shadow-slate-950/50 bg-slate-900">
          ${pulseHtml}
          <span class="text-sm font-semibold">${style.icon}</span>
          ${report_count > 1 ? `<span class="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-slate-100 border border-slate-950 text-slate-950 text-[9px] font-extrabold w-4.5 h-4.5 rounded-full">${report_count}</span>` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div class="p-1 font-sans text-slate-100">
          <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide" style="color: ${style.color}">
            <span>${style.icon}</span>
            <span>${category === 'animal' ? 'Stray / Injured Animal' : category === 'pothole' ? 'Pothole Damage' : category.capitalize()}</span>
          </div>
          <div class="mt-1 text-[11px] text-slate-300">
            <strong>Active reports:</strong> ${report_count} citizen filings
          </div>
          <div class="flex gap-2 mt-2 text-[10px]">
            <span class="px-1.5 py-0.5 rounded font-bold ${
              status === 'resolved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
              status === 'escalated' ? 'bg-red-950 text-red-300 border border-red-800' :
              'bg-slate-800 text-slate-300 border border-slate-700'
            }">
              ${status.toUpperCase()}
            </span>
            ${escalation_level > 0 ? `<span class="bg-red-900/60 border border-red-700 px-1.5 py-0.5 rounded font-bold text-red-200">LEVEL ${escalation_level} ESCALATED</span>` : ''}
          </div>
          <button onclick="window.triggerSaarthiFromMap(${id})" style="margin-top:8px; width:100%; padding:6px; background:linear-gradient(to right, #ea580c, #d97706); color:white; font-weight:bold; border-radius:6px; font-size:10px; border:none; cursor:pointer;">
            🤝 Trigger Saarthi (सारथी) Alliance
          </button>
        </div>
      `;

      const marker = L.marker([latitude, longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml, {
          closeButton: false,
          minWidth: 170
        });

      markersRef.current.push(marker);
    });

    // Attach global window handler for Leaflet popup clicks
    window.triggerSaarthiFromMap = async (clusterId) => {
      const getValidToken = async () => {
        let t = localStorage.getItem('sewa_token');
        if (!t) {
          try {
            await fetch('/api/auth/otp/send', { method: 'POST', body: new URLSearchParams({ phone: '9999999999' }) });
            const vRes = await fetch('/api/auth/otp/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ phone: '9999999999', code: '123456' })
            });
            const vData = await vRes.json();
            if (vData.access_token) {
              t = vData.access_token;
              localStorage.setItem('sewa_token', t);
            }
          } catch (e) {
            console.error(e);
          }
        }
        return t;
      };

      let token = await getValidToken();

      try {
        let res = await fetch(`/api/saarthi/trigger/${clusterId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        // If expired session, auto-refresh token and retry once
        if (res.status === 401) {
          localStorage.removeItem('sewa_token');
          token = await getValidToken();
          res = await fetch(`/api/saarthi/trigger/${clusterId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }

        const data = await res.json();
        if (res.ok) {
          alert(`🤝 SAARTHI COMMUNITY ALLIANCE ACTIVATED!\n\n• Citizens United: ${data.distinct_citizens_united}\n• Contractor Notified: ${data.contractor_notified} (${data.contractor_email})\n• NGO Notified: ${data.ngo_notified}\n\nPublic contractor performance demand notice issued.`);
        } else {
          alert(data.detail || "Saarthi trigger failed.");
        }
      } catch {
        alert("Error contacting Saarthi Agent.");
      }
    };
  }, [clusters]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/80 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Visual map legend overlay */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 p-2.5 bg-slate-950/80 backdrop-blur border border-slate-800/80 rounded-xl shadow-lg pointer-events-none">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <span>🚨 Fire / Emergency</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          <span>⚠️ Potholes</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-500"></span>
          <span>♻️ Garbage</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
          <span>🐾 Injured Animal</span>
        </div>
      </div>
    </div>
  );
}

// Capitalize polyfill
if (!String.prototype.capitalize) {
  String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  }
}
