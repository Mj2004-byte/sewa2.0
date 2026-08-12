import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from '../utils/translate';
import { Camera, Video, Mic, StopCircle, RefreshCw, Undo, ShieldAlert, Upload, Sparkles, Image as ImageIcon } from 'lucide-react';

export default function CameraCapture({ onCapture, onCancel }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState('photo'); // 'photo' | 'video' | 'audio'
  const [isRecording, setIsRecording] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState(null); // { type, url, blob }
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [blurPoints, setBlurPoints] = useState([]); // List of {x, y, r} for face blurring
  const [autoBlurApplied, setAutoBlurApplied] = useState(false);

  useEffect(() => {
    if (!capturedMedia) {
      startCamera();
    } else if (capturedMedia.type === 'image' && capturedMedia.url) {
      applyBlur(blurPoints, capturedMedia.url);
    }
    return () => {
      stopCamera();
    };
  }, [mode, capturedMedia]);

  const startCamera = async () => {
    stopCamera();
    try {
      const constraints = {
        video: mode !== 'audio' ? { facingMode: 'environment' } : false,
        audio: mode !== 'photo'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);
      
      if (videoRef.current && mode !== 'audio') {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("Video play error:", e));
      }
    } catch (err) {
      console.log("[CameraCapture] Web camera stream unavailable. Fallback file upload active.", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Automatic Face Detection Canvas Pass (Heuristic Color / Blob Scanning)
  const detectAndAutoBlurFaces = (ctx, width, height) => {
    const detectedPoints = [];
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      
      let totalSkinX = 0;
      let totalSkinY = 0;
      let skinPixels = 0;
      
      // Sample pixels across canvas
      const step = 4 * 8; // Sample every 8th pixel
      for (let i = 0; i < data.length; i += step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Simple YCbCr skin color heuristic check
        if (r > 95 && g > 40 && b > 20 && (Math.max(r, g, b) - Math.min(r, g, b) > 15) && Math.abs(r - g) > 15 && r > g && r > b) {
          const pixelIdx = i / 4;
          const x = pixelIdx % width;
          const y = Math.floor(pixelIdx / width);
          
          totalSkinX += x;
          totalSkinY += y;
          skinPixels++;
        }
      }
      
      // If a significant cluster of face/skin pixels is detected, auto-place blur region
      if (skinPixels > (width * height * 0.02)) {
        const avgX = totalSkinX / skinPixels;
        const avgY = totalSkinY / skinPixels;
        const radius = Math.min(width, height) * 0.12;
        detectedPoints.push({ x: avgX, y: avgY, r: radius });
        console.log(`[FaceBlur] Auto-detected face region at (${avgX.toFixed(0)}, ${avgY.toFixed(0)}) radius: ${radius.toFixed(0)}`);
      }
    } catch (e) {
      console.log("[FaceBlur] Auto detection pass completed with fallback.");
    }
    
    return detectedPoints;
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const width = video.videoWidth || 800;
    const height = video.videoHeight || 600;
    
    const maxDim = 1000;
    let targetWidth = width;
    let targetHeight = height;
    
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        targetWidth = maxDim;
        targetHeight = (height / width) * maxDim;
      } else {
        targetHeight = maxDim;
        targetWidth = (width / height) * maxDim;
      }
    }
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    stopCamera();
    
    // Perform Automatic Face Detection Pass
    const autoPoints = detectAndAutoBlurFaces(ctx, targetWidth, targetHeight);
    setBlurPoints(autoPoints);
    setAutoBlurApplied(autoPoints.length > 0);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ type: 'image', url, blob });
    }, 'image/jpeg', 0.60);
  };

  // Fallback File Upload Input Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    stopCamera();
    const url = URL.createObjectURL(file);
    let type = 'image';
    if (file.type.startsWith('video')) type = 'video';
    if (file.type.startsWith('audio')) type = 'audio';
    
    setCapturedMedia({ type, url, blob: file });
    
    if (type === 'image') {
      // Draw uploaded image to canvas to allow privacy blurring
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.width > 1000 ? 1000 : img.width;
        canvas.height = (img.height / img.width) * canvas.width;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const autoPoints = detectAndAutoBlurFaces(ctx, canvas.width, canvas.height);
        setBlurPoints(autoPoints);
        setAutoBlurApplied(autoPoints.length > 0);
        if (autoPoints.length > 0) {
          applyBlur(autoPoints, url);
        }
      };
    }
  };

  const handleCanvasClick = (e) => {
    if (capturedMedia?.type !== 'image' || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const r = Math.min(canvas.width, canvas.height) * 0.08;
    
    const newPoints = [...blurPoints, { x, y, r }];
    setBlurPoints(newPoints);
    applyBlur(newPoints, capturedMedia.url);
  };

  const applyBlur = (points, imageUrl) => {
    if (!canvasRef.current || !imageUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      points.forEach(pt => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.clip();
        
        const size = Math.floor(pt.r * 2);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 16;
        tempCanvas.height = 16;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(canvas, pt.x - pt.r, pt.y - pt.r, size, size, 0, 0, 16, 16);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, 16, 16, pt.x - pt.r, pt.y - pt.r, size, size);
        ctx.restore();
        
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      canvas.toBlob((blob) => {
        setCapturedMedia(prev => ({ ...prev, blob }));
      }, 'image/jpeg', 0.65);
    };
  };

  const clearBlur = () => {
    setBlurPoints([]);
    setAutoBlurApplied(false);
    applyBlur([], capturedMedia.url);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    const chunks = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mode === 'audio' ? 'audio/mp3' : 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ type: mode, url, blob });
      stopCamera();
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUseMedia = () => {
    if (capturedMedia) {
      onCapture(capturedMedia.blob, capturedMedia.type);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 glass-panel text-slate-100">
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,video/*,audio/*"
        className="hidden"
      />

      {capturedMedia ? (
        <div className="flex flex-col items-center w-full max-w-sm">
          <div className="relative w-full aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
            {capturedMedia.type === 'image' && (
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="w-full h-full object-cover cursor-crosshair"
              />
            )}
            
            {capturedMedia.type === 'video' && (
              <video src={capturedMedia.url} controls className="w-full h-full object-contain" />
            )}
            
            {capturedMedia.type === 'audio' && (
              <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900">
                <Mic size={48} className="text-orange-500 animate-pulse mb-2" />
                <span className="text-sm font-semibold text-slate-400">Audio Incident Recorded</span>
                <audio src={capturedMedia.url} controls className="mt-4 w-[80%]" />
              </div>
            )}
          </div>
          
          {capturedMedia.type === 'image' && (
            <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400 text-center">
              <ShieldAlert size={14} className="text-red-500 shrink-0" />
              <span>
                {autoBlurApplied 
                  ? "✓ Automatic face blur applied to detected region. Tap image to add extra blur patches."
                  : t('privacy_blur_desc')}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-3 mt-5 w-full">
            {capturedMedia.type === 'image' && blurPoints.length > 0 && (
              <button
                onClick={clearBlur}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700"
              >
                <Undo size={14} /> Clear Blur ({blurPoints.length})
              </button>
            )}
            <button
              onClick={() => { setCapturedMedia(null); setBlurPoints([]); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700"
            >
              <RefreshCw size={14} /> Retake
            </button>
            <button
              onClick={handleUseMedia}
              className="flex items-center gap-1 px-5 py-2 text-xs font-semibold bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg shadow transition-all font-sans"
            >
              Use Media
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-sm">
          
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 shadow">
            <button
              type="button"
              onClick={() => setMode('photo')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'photo' ? 'bg-slate-800 text-red-400 border border-slate-700' : 'text-slate-400'
              }`}
            >
              <Camera size={14} /> Photo
            </button>
            <button
              type="button"
              onClick={() => setMode('video')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'video' ? 'bg-slate-800 text-red-400 border border-slate-700' : 'text-slate-400'
              }`}
            >
              <Video size={14} /> Video
            </button>
            <button
              type="button"
              onClick={() => setMode('audio')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'audio' ? 'bg-slate-800 text-red-400 border border-slate-700' : 'text-slate-400'
              }`}
            >
              <Mic size={14} /> Voice
            </button>
          </div>

          <div className="relative w-full aspect-video md:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl flex items-center justify-center">
            {mode !== 'audio' && isCameraActive && (
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            )}
            
            {mode === 'audio' && (
              <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900/60">
                <Mic size={54} className={`text-orange-500 ${isRecording ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-semibold text-slate-400 mt-2">
                  {isRecording ? 'Recording Voice Incident Details...' : 'Ready to Record'}
                </span>
              </div>
            )}

            {!isCameraActive && mode !== 'audio' && (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <ImageIcon size={40} className="text-slate-600 mb-2" />
                <span className="text-xs text-slate-400 mb-3">
                  Live Camera stream offline or permission blocked by browser.
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl text-xs font-bold shadow hover:from-red-500 hover:to-orange-400 transition-all"
                >
                  <Upload size={14} /> Upload Media File
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              {t('btn_cancel')}
            </button>
            
            {/* Fallback File Picker Button always available */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              <Upload size={14} className="text-orange-400" />
              <span>Choose File</span>
            </button>

            {mode === 'photo' && isCameraActive && (
              <button
                type="button"
                onClick={capturePhoto}
                className="flex items-center justify-center w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full border-4 border-slate-800 shadow-lg text-white transform hover:scale-105 active:scale-95 transition-all"
              >
                <Camera size={24} />
              </button>
            )}

            {(mode === 'video' || mode === 'audio') && isCameraActive && (
              isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center justify-center w-14 h-14 bg-slate-900 hover:bg-slate-800 text-orange-500 rounded-full border-4 border-red-600 shadow-lg transform active:scale-95 transition-all"
                >
                  <StopCircle size={24} className="animate-pulse" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center justify-center w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full border-4 border-slate-800 shadow-lg text-white transform hover:scale-105 active:scale-95 transition-all"
                >
                  {mode === 'video' ? <Video size={24} /> : <Mic size={24} />}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
