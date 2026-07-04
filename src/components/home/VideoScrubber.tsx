'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FluidHorseAnimation from '../FluidHorseAnimation';
import { useDictionary } from '@/i18n/DictionaryContext';
import { useScrollLock } from '@/hooks/useScrollLock';

interface VideoScrubberProps {
  roomId: string;
  poster?: string;
  children?: React.ReactNode;
}

export const VideoScrubber: React.FC<VideoScrubberProps> = ({ roomId, poster, children }) => {
  const dict = useDictionary();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);

  const [metadataMap, setMetadataMap] = useState<any>(null);
  const [environment, setEnvironment] = useState<'desktop' | 'mobile'>('desktop');
  const [totalFrames, setTotalFrames] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  
  const framesRef = useRef<HTMLImageElement[]>([]);
  const inactivityTimerRef = useRef<any>(null);

  const [shouldLoadFrames, setShouldLoadFrames] = useState(false);

  const resetInactivityTimer = () => {
    setShowHint(false);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      setShowHint(true);
    }, 2800);
  };
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  // Intersection Observer for Lazy Loading Frames
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // Start loading shortly after coming into view to prioritize scrolling performance
        setTimeout(() => setShouldLoadFrames(true), 300);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch metadata once
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/frames_metadata.json`)
      .then(res => res.json())
      .then(data => setMetadataMap(data))
      .catch(err => console.error("Could not load frames metadata", err));
  }, []);

  // Determine environment
  useEffect(() => {
    const onResize = () => {
      setEnvironment(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fullscreen event listener to sync state if exited natively
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch (err) {}
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Lock body scroll when in faux-fullscreen
  useScrollLock(isFullscreen);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    if (!isFullscreen) {
      if (wrapperRef.current.requestFullscreen) {
        try {
          await wrapperRef.current.requestFullscreen();
        } catch (err) {
          console.error("Native requestFullscreen failed, using CSS fallback", err);
        }
      }
      setIsFullscreen(true);
      
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock('landscape');
        } catch (err) {}
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch (err) {}
      }
      setIsFullscreen(false);
      
      if (screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch (err) {}
      }
    }
  };

  // Move drawFrame above the useEffect to fix ESLint "accessed before declared"
  const drawFrame = (frameNumber: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = framesRef.current[frameNumber - 1];
    if (img && img.complete) {
      if (canvas.width !== img.width) {
         canvas.width = img.width;
         canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  };

  const [loadedFrames, setLoadedFrames] = useState(0);

  // Load frames when roomId, environment, or metadataMap changes
  useEffect(() => {
    if (!metadataMap || !metadataMap[roomId]) return;
    
    const count = metadataMap[roomId][environment];
    
    // Instead of setting state in effect causing cascading renders, we can compute totalFrames
    // But since totalFrames is used in other effects, we can safely set it here as long as it's not repeatedly triggering
    setTotalFrames(count);
    
    // Always load the very first frame immediately to have a poster
    const firstImg = new Image();
    const paddedFirst = '0001';
    firstImg.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/frames/${roomId}/${environment}/frame_${paddedFirst}.jpg`;
    firstImg.onload = () => {
      framesRef.current[0] = firstImg;
      drawFrame(1);
    };

    if (!shouldLoadFrames) return; // Wait until in viewport to load the heavy sequence

    setIsLoaded(false);
    setShowHint(false); // Hide hint while loading
    
    let loadedCount = 1; // already loaded the first one
    setLoadedFrames(1);
    
    for (let i = 2; i <= count; i++) {
      const img = new Image();
      const paddedIndex = i.toString().padStart(4, '0');
      img.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/frames/${roomId}/${environment}/frame_${paddedIndex}.jpg`;
      img.onload = () => {
        framesRef.current[i - 1] = img;
        loadedCount++;
        setLoadedFrames(loadedCount);
        if (loadedCount === count) {
          setIsLoaded(true);
          setShowHint(true); // Show hint when loaded
        }
      };
    }
  }, [roomId, environment, metadataMap, shouldLoadFrames]);

  // Slider Native Logic decoupled from React state for 60fps manipulation
  useEffect(() => {
    const input = inputRef.current;
    const fill = trackFillRef.current;

    if (!input || !fill) return;

    let rafId: number;
    let pendingFrame: number | null = null;

    const loop = () => {
      if (pendingFrame !== null) {
        drawFrame(pendingFrame);
        pendingFrame = null;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const handleInput = (e: Event) => {
      resetInactivityTimer();
      const val = parseFloat((e.target as HTMLInputElement).value);
      const progress = val / 100;
      
      const percent = progress * 100;
      fill.style.width = `${percent}%`;
      
      if (totalFrames > 0) {
        let frameToDraw = Math.floor(progress * totalFrames) + 1;
        if (frameToDraw > totalFrames) frameToDraw = totalFrames;
        
        // Queue frame draw for the RAF loop
        pendingFrame = frameToDraw;
      }
    };

    // Also trigger timer on touch start/mouse down to be highly responsive
    const handleDown = () => resetInactivityTimer();
    
    input.addEventListener('input', handleInput, { passive: true });
    input.addEventListener('pointerdown', handleDown, { passive: true });
    
    return () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('pointerdown', handleDown);
      cancelAnimationFrame(rafId);
    };
  }, [totalFrames]);

  // Reset slider visually when room changes
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = '0';
    if (trackFillRef.current) trackFillRef.current.style.width = '0%';
    if (totalFrames > 0) drawFrame(1);
  }, [roomId, totalFrames]);

  // Determine wrapper classes based on fullscreen state
  const wrapperClasses = isFullscreen 
    ? "fixed inset-0 z-[9999] bg-black flex flex-col justify-center items-center" 
    : "relative w-full h-full bg-black flex flex-col justify-end overflow-hidden md:rounded-2xl";

  return (
    <div ref={wrapperRef} className={wrapperClasses}>
      
      {/* Canvas Replaces Video */}
      <canvas 
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full pointer-events-none ${isFullscreen ? 'object-contain' : 'object-cover'}`}
      />
      
      {/* Content overlay */}
      {!isFullscreen && children}

      {/* Cover Overlay while Loading */}
      <AnimatePresence>
        {!isLoaded && totalFrames > 0 && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-50 bg-[#0A0908]/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center -mt-16">
              <FluidHorseAnimation className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 text-[#F9F7F4] drop-shadow-2xl" />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="mt-8 text-[#9B7E67] font-sans text-[10px] tracking-[0.4em] uppercase font-bold flex flex-col items-center"
              >
                {dict.modal.preparingTour}
                {totalFrames > 0 && (
                  <div className="w-48 mt-4 flex flex-col items-center">
                    <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#9B7E67] transition-all duration-300 ease-out" 
                        style={{ width: `${Math.round((loadedFrames / totalFrames) * 100)}%` }} 
                      />
                    </div>
                    <span className="text-[9px] text-white/40 mt-3 font-serif tracking-[0.2em]">
                      {Math.round((loadedFrames / totalFrames) * 100)}%
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Toggle Buttons (Faded in when loaded) */}
      <button 
        onClick={toggleFullscreen}
        className={`absolute top-4 left-4 md:top-6 md:left-6 z-50 w-10 h-10 bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white transition-all duration-700 ${isLoaded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-label={isFullscreen ? "Cerrar pantalla completa" : "Pantalla completa"}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        )}
      </button>
      
      {/* Slider Overlay */}
      <div className={`relative z-10 w-full px-6 pb-6 md:pb-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex justify-center pointer-events-none ${isFullscreen ? 'mt-auto pt-48' : 'pt-24'}`}>
        
        <div className={`w-full max-w-4xl relative flex flex-col transition-opacity duration-700 ${isLoaded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          
          {/* Hint positioned at top-left of the progress bar group */}
          <AnimatePresence>
            {showHint && isLoaded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                transition={{ duration: 0.6 }}
                className="mb-3 self-start text-white/70 font-serif italic text-[11px] tracking-[0.2em] uppercase whitespace-nowrap pointer-events-none origin-left"
                style={{
                  animation: 'fadeHint 2.4s ease-in-out infinite',
                }}
              >
                {dict.suites.explore}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Fade keyframes + shimmer keyframes injected via style tag */}
          <style jsx global>{`
            @keyframes fadeHint {
              0%, 100% { opacity: 0; }
              50% { opacity: 1; }
            }
            @keyframes barShimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>

          <motion.div 
            className="relative flex items-center h-16 md:h-12 w-full cursor-pointer"
            whileHover="hover"
            whileTap="tap"
            initial="rest"
          >
            <input
              ref={inputRef}
              type="range"
              min="0"
              max="100"
              step="0.01"
              defaultValue="0"
              disabled={!isLoaded}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0 touch-none"
            />
            
            <motion.div 
              className="w-full bg-white/20 rounded-full relative pointer-events-none overflow-hidden"
              variants={{
                rest: { height: 4, backgroundColor: "rgba(255,255,255,0.2)" },
                hover: { height: 10, backgroundColor: "rgba(255,255,255,0.3)" },
                tap: { height: 8, backgroundColor: "rgba(255,255,255,0.4)" }
              }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {/* Filled portion */}
              <div 
                ref={trackFillRef}
                className="absolute top-0 bottom-0 left-0 bg-white rounded-r-full will-change-[width]"
                style={{ width: '0%' }}
              />
              {/* Shimmer sweep on the bar as interaction hint */}
              {showHint && isLoaded && (
                <div
                  className="absolute top-0 bottom-0 left-0 w-[25%] pointer-events-none rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    animation: 'barShimmer 2.4s ease-in-out infinite',
                  }}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
