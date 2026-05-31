
import React, { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  }, []);

  React.useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  const capture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const data = canvas.toDataURL('image/jpeg');
      onCapture(data);
      stream?.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] rounded-2xl overflow-hidden glass border-white/20">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
          <div className="w-full h-full border-2 border-white/30 rounded-lg"></div>
        </div>
      </div>
      
      <div className="flex gap-8 mt-12 items-center">
        <button 
          onClick={onCancel}
          className="w-16 h-16 rounded-full glass flex items-center justify-center text-white/70 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <button 
          onClick={capture}
          className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
        >
          <div className="w-16 h-16 rounded-full border-2 border-black"></div>
        </button>

        <div className="w-16 h-16"></div> {/* Spacer to center the capture button */}
      </div>
      <p className="mt-8 text-zinc-400 text-sm">Align item within the frame</p>
    </div>
  );
};
