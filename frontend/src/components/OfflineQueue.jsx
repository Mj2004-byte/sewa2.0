import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

// Shared utilities for offline queuing that can be imported by other files
export const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem('sewa_offline_queue')) || [];
  } catch {
    return [];
  }
};

export const saveOfflineQueue = (queue) => {
  localStorage.setItem('sewa_offline_queue', JSON.stringify(queue));
};

export const enqueueReport = async (file, caption, latitude, longitude, mediaType) => {
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onloadend = () => {
      const base64Data = reader.result;
      const queue = getOfflineQueue();
      const newEntry = {
        id: Date.now().toString(),
        base64Data,
        fileName: file.name || 'upload.jpg',
        fileType: file.type || 'image/jpeg',
        caption,
        latitude,
        longitude,
        mediaType,
        timestamp: new Date().toISOString()
      };
      queue.push(newEntry);
      saveOfflineQueue(queue);
      console.log("[OfflineQueue] Enqueued report locally:", newEntry.id);
      
      // Trigger a custom event to notify React components that the queue changed
      window.dispatchEvent(new Event('sewa_queue_updated'));
      resolve(true);
    };
    reader.readAsDataURL(file);
  });
};

export default function OfflineQueue() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Read queue count on mount
  useEffect(() => {
    setQueueCount(getOfflineQueue().length);

    const handleConnectionChange = () => {
      setIsOnline(navigator.onLine);
    };

    const handleQueueChange = () => {
      setQueueCount(getOfflineQueue().length);
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    window.addEventListener('sewa_queue_updated', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
      window.removeEventListener('sewa_queue_updated', handleQueueChange);
    };
  }, []);

  // Watch connection and trigger sync when coming online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncing) {
      triggerSync();
    }
  }, [isOnline, queueCount]);

  const triggerSync = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const token = localStorage.getItem('sewa_token');
    if (!token) {
      console.log("[OfflineQueue] Sync postponed: No active user session.");
      return;
    }

    setSyncing(true);
    console.log(`[OfflineQueue] Starting background sync for ${queue.length} reports...`);

    let successCount = 0;

    for (const item of queue) {
      try {
        // Convert base64 back to a binary Blob
        const response = await fetch(item.base64Data);
        const blob = await response.blob();
        const file = new File([blob], item.fileName, { type: item.fileType });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('latitude', item.latitude);
        formData.append('longitude', item.longitude);
        formData.append('caption', item.caption);

        const uploadRes = await fetch('/api/reports/submit', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (uploadRes.ok) {
          successCount++;
          console.log(`[OfflineQueue] Sync success for report: ${item.id}`);
        } else {
          console.error(`[OfflineQueue] Server error during sync for report: ${item.id}`);
        }
      } catch (err) {
        console.error(`[OfflineQueue] Sync failure for report: ${item.id}`, err);
        break; // Stop sync list on network/server error to prevent message loss
      }
    }

    // Remove successful items from queue
    const remainingQueue = getOfflineQueue().slice(successCount);
    saveOfflineQueue(remainingQueue);
    setQueueCount(remainingQueue.length);
    setSyncing(false);
    
    if (successCount > 0) {
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
      window.dispatchEvent(new Event('sewa_sync_completed'));
    }
  };

  // Do not render anything if online and queue is empty
  if (isOnline && queueCount === 0 && !syncSuccess) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-sm">
      {/* Offline Alert */}
      {!isOnline && (
        <div className="flex items-center justify-between p-3 bg-red-950/90 border border-red-800 text-red-200 rounded-xl shadow-lg backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff size={18} />
            <span className="text-xs font-semibold">You are offline. Reporting in queue.</span>
          </div>
          <span className="bg-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
            {queueCount} Pending
          </span>
        </div>
      )}

      {/* Syncing Progress Toast */}
      {isOnline && syncing && (
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl shadow-lg">
          <div className="flex items-center gap-2">
            <RefreshCw className="animate-spin text-orange-500" size={18} />
            <span className="text-xs font-semibold">Uploading queued reports to authorities...</span>
          </div>
          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400">
            {queueCount} left
          </span>
        </div>
      )}

      {/* Sync Success Notification */}
      {isOnline && syncSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 rounded-xl shadow-lg">
          <CheckCircle2 className="text-emerald-500" size={18} />
          <span className="text-xs font-semibold">Offline reports synced successfully!</span>
        </div>
      )}
    </div>
  );
}
