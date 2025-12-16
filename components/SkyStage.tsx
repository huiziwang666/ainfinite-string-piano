import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Camera, Music, Eye, EyeOff, Loader2, Volume2 } from 'lucide-react';
import { audioService } from '../services/audioService';
import { visionService } from '../services/visionService';
import { CONFIG, generateStringConfigs, INSTRUMENTS } from '../constants';
import { PitchRange, StringConfig, Particle, InstrumentName } from '../types';

export default function SkyStage() {
  // -- State --
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Warming up the orchestra...');
  const [cameraActive, setCameraActive] = useState(false);
  const [showCameraFeed, setShowCameraFeed] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [instrument, setInstrument] = useState<InstrumentName>('acoustic_grand_piano');
  const [pitchRange, setPitchRange] = useState<PitchRange>(PitchRange.MID);
  const [stringCount, setStringCount] = useState(12);
  const [showGuide, setShowGuide] = useState(true);

  // -- Refs for Logic Loop --
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const stringsRef = useRef<StringConfig[]>([]);
  
  // Physics & Logic Refs
  const lastLandmarksRef = useRef<any>(null);
  const prevHandX = useRef<number | null>(null);
  const prevHandVisible = useRef<boolean>(false);
  const lastTriggerTimes = useRef<Record<number, number>>({});
  const particles = useRef<Particle[]>([]);
  const stringPhysics = useRef<Record<number, { vibration: number, bend: number }>>({});
  const tickRef = useRef<() => void>();
  const cameraActiveRef = useRef(false);

  // -- Initialization --
  const strings = useMemo(() => generateStringConfigs(stringCount, pitchRange), [stringCount, pitchRange]);
  stringsRef.current = strings;

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingMessage('Loading Vision AI...');
        await visionService.initialize();
        
        setLoadingMessage('Loading Sounds...');
        audioService.loadInstrument(instrument).catch(console.warn);
        
        setLoading(false);
      } catch (e) {
        setLoadingMessage('Error loading resources. Please refresh.');
        console.error(e);
      }
    };
    init();
  }, []);

  // Cleanup loop on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Keep ref in sync with state for use in animation loop
  useEffect(() => {
    cameraActiveRef.current = cameraActive;
    if (!cameraActive) {
      lastLandmarksRef.current = null;
      prevHandX.current = null;
    }
  }, [cameraActive]);

  // Instrument switching
  useEffect(() => {
    audioService.loadInstrument(instrument);
  }, [instrument]);

  // -- Core Game Loop --
  const tick = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 2. Vision Detection
    let handX = -1;
    let handY = -1;
    let isVisible = false;

    // Use ref to avoid stale closure issue
    if (cameraActiveRef.current && videoRef.current.readyState >= 2) {
      const results = visionService.detect(videoRef.current);
      if (results && results.landmarks.length > 0) {
        lastLandmarksRef.current = results.landmarks[0];
      }

      if (lastLandmarksRef.current) {
        const landmarks = lastLandmarksRef.current;
        const tip = landmarks[8]; // Index finger tip
        
        // Mirror X
        handX = 1.0 - tip.x; 
        handY = tip.y;
        isVisible = true;

        // Draw Skeleton Helper (Visible but subtle)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.beginPath();
        const points = [0, 5, 6, 7, 8];
        points.forEach((idx, i) => {
          const pt = landmarks[idx];
          const x = (1 - pt.x) * width;
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw Cursor (The "Pick")
        ctx.fillStyle = "#FBBF24"; 
        ctx.shadowColor = "#F59E0B";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(handX * width, handY * height, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 3. Physics & Interaction Logic
    const now = performance.now();
    const reachThreshold = 0.08; // How far the hand can "grab" a string (normalized width)

    stringsRef.current.forEach((str) => {
      // Initialize physics state if needed
      if (!stringPhysics.current[str.id]) {
        stringPhysics.current[str.id] = { vibration: 0, bend: 0 };
      }
      
      const physics = stringPhysics.current[str.id];
      const distToHandX = handX - str.xPos;
      const isWithinReach = Math.abs(distToHandX) < reachThreshold;
      
      // -- Bending Logic (Elasticity) --
      if (isVisible && isWithinReach && physics.vibration < 0.1) {
        // If hand is close and string isn't vibrating wildly, pull it towards hand
        // Bend is proportional to distance but clamped
        // We want the string to stick to the finger until it snaps
        const pullFactor = 1.0 - (Math.abs(distToHandX) / reachThreshold);
        // physics.bend will be an X offset in pixels relative to string pos
        physics.bend = (distToHandX * width) * pullFactor * 0.8; 
      } else {
        // Release bend quickly if hand moves away or during vibration
        physics.bend *= 0.8; // Spring back
      }

      // -- Trigger Logic (Crossing) --
      if (isVisible && prevHandVisible.current && prevHandX.current !== null) {
        const pX = prevHandX.current!;
        const cX = handX;
        const xPos = str.xPos;

        const crossedRight = pX < xPos && cX >= xPos;
        const crossedLeft = pX > xPos && cX <= xPos;

        if (crossedRight || crossedLeft) {
          const lastTime = lastTriggerTimes.current[str.id] || 0;
          if (now - lastTime > CONFIG.DEBOUNCE_MS) {
            triggerString(str, now, handY);
            // Snap effect: reset bend immediately to 0 on pluck to start vibration
            physics.bend = 0; 
          }
        }
      }
    });

    if (isVisible) {
      prevHandX.current = handX;
      prevHandVisible.current = true;
    } else {
      prevHandVisible.current = false;
    }

    // 4. Render Strings & Effects
    renderStringsAndEffects(ctx, width, height, now, handY, isVisible);

    // Use tickRef to avoid stale closure - ensures we always call the latest tick function
    requestRef.current = requestAnimationFrame(() => tickRef.current?.());
  }, []);

  // Keep tickRef in sync
  tickRef.current = tick;

  const triggerString = (str: StringConfig, time: number, yPosNormalized: number) => {
    // Audio
    audioService.playNote(str.note);
    setActiveNote(str.note);
    
    // Physics
    lastTriggerTimes.current[str.id] = time;
    if (stringPhysics.current[str.id]) {
      stringPhysics.current[str.id].vibration = 1.0;
    }

    // Visuals: Particles
    const canvas = canvasRef.current;
    if (canvas) {
      const x = str.xPos * canvas.width;
      const y = yPosNormalized * canvas.height;
      
      for (let i = 0; i < CONFIG.PARTICLE_COUNT_PER_HIT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        particles.current.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: str.color,
          size: Math.random() * 6 + 2
        });
      }
    }
  };

  const renderStringsAndEffects = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, handY: number, handVisible: boolean) => {
    // Render Strings
    stringsRef.current.forEach((str) => {
      const phys = stringPhysics.current[str.id] || { vibration: 0, bend: 0 };
      const xBase = str.xPos * width;
      
      ctx.beginPath();
      ctx.moveTo(xBase, 0);

      // Determine string shape
      if (phys.vibration > 0.01) {
        // -- VIBRATION MODE --
        // Sine wave dampened at top and bottom
        const freq = 0.2; // Wiggles
        const amp = phys.vibration * 20;
        
        for (let y = 0; y <= height; y += 20) {
           const env = Math.sin((y / height) * Math.PI); 
           // Complex wave: Main sine + fast flutter
           const wave = Math.sin(y * freq + time * 0.1) * amp * env;
           ctx.lineTo(xBase + wave, y);
        }
        
        // Damping
        phys.vibration *= 0.92;
        
        ctx.lineWidth = CONFIG.STRING_THICKNESS_ACTIVE;
        ctx.shadowColor = str.color;
        ctx.shadowBlur = 15;
      } else if (Math.abs(phys.bend) > 1 && handVisible) {
        // -- BEND MODE (Elastic) --
        // Draw a curve pulled towards the handY
        // Quadratic bezier: Start, Control Point (offset), End
        
        // We calculate a control point that creates a peak at handY
        // Bezier math: P(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        // We want the peak to be at handY * height. 
        // A simple approximation is putting the Control Point at handY.
        
        const yPx = handY * height;
        // Control point X needs to be further out to make the curve pass through the finger
        // But for visual simplicity, Control Point = xBase + bend * 2 usually looks okay
        ctx.quadraticCurveTo(xBase + phys.bend * 1.5, yPx, xBase, height);
        
        ctx.lineWidth = CONFIG.STRING_THICKNESS_BASE + 2;
        ctx.shadowColor = str.color;
        ctx.shadowBlur = 5;
      } else {
        // -- REST MODE --
        ctx.lineTo(xBase, height);
        ctx.lineWidth = CONFIG.STRING_THICKNESS_BASE;
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = (phys.vibration > 0.01 || Math.abs(phys.bend) > 5) ? str.color : 'rgba(255,255,255,0.6)';
      ctx.stroke();

      // Bottom Anchor Beads
      ctx.fillStyle = str.color;
      ctx.beginPath();
      ctx.arc(xBase, height - 30, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render Particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      p.vy += 0.2; // Gravity
      
      if (p.life <= 0) {
        particles.current.splice(i, 1);
        continue;
      }
      
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  };

  const startCamera = async () => {
    try {
      // Force audio resume immediately on interaction
      await audioService.resume();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user" 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        // Use tickRef to start the animation loop with the latest tick function
        requestRef.current = requestAnimationFrame(() => tickRef.current?.());
      }
      setShowGuide(false);
    } catch (err) {
      console.error(err);
      alert("Could not access camera. Please allow permissions and try again.");
    }
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-sky-400 via-sky-200 to-white overflow-hidden select-none font-sans">
      
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/clouds.png')] pointer-events-none" />

      {/* Camera Video Layer */}
      <video 
        ref={videoRef} 
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${showCameraFeed ? 'opacity-50' : 'opacity-0'}`} 
        playsInline 
        muted 
        style={{ transform: 'scaleX(-1)' }} 
      />
      
      {/* Interactive Canvas Layer */}
      <canvas 
        ref={canvasRef} 
        width={window.innerWidth} 
        height={window.innerHeight} 
        className="absolute inset-0 z-10 touch-none"
      />

      {/* UI Overlay */}
      <div className="relative z-20 flex flex-col h-full pointer-events-none">
        
        {/* Top Controls */}
        <div className="flex justify-between items-start p-4 pointer-events-auto">
          
          {/* Left Group */}
          <div className="flex flex-col gap-2">
             {/* View Toggle */}
            <button 
                onClick={() => setShowCameraFeed(!showCameraFeed)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${showCameraFeed ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
            >
                 {showCameraFeed ? <Eye size={18} /> : <EyeOff size={18} />}
                 {showCameraFeed ? 'Hide Cam' : 'Show Cam'}
            </button>
            
            {/* String Count */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Strings</div>
                <div className="flex gap-1">
                 {[12, 16, 24].map(c => (
                   <button 
                    key={c}
                    onClick={() => setStringCount(c)}
                    className={`flex-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${stringCount === c ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                   >
                     {c}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          {/* Right Group: Instrument & Pitch */}
          <div className="flex flex-col gap-2 items-end">
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-sm min-w-[140px]">
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Instrument</div>
                <div className="flex flex-col gap-1">
                {INSTRUMENTS.map(inst => (
                  <button
                    key={inst.value}
                    onClick={() => setInstrument(inst.value)}
                    className={`px-3 py-1.5 rounded-lg text-left text-xs font-bold transition-all ${instrument === inst.value ? 'bg-indigo-500 text-white' : 'text-gray-600 hover:bg-indigo-50'}`}
                  >
                    {inst.label}
                  </button>
                ))}
                </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-2 shadow-sm">
               <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Pitch</div>
               <div className="flex gap-1">
                 {Object.values(PitchRange).map(r => (
                   <button 
                    key={r}
                    onClick={() => setPitchRange(r)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${pitchRange === r ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                   >
                     {r}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>

        {/* Start Screen */}
        {!cameraActive && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-white/30 backdrop-blur-sm">
            <div className="bg-white/90 p-8 rounded-3xl shadow-2xl text-center max-w-sm mx-4 border border-sky-100">
               <div className="w-16 h-16 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg rotate-3">
                  <Music size={32} />
               </div>
               <h1 className="text-2xl font-black text-gray-800 mb-2">AInfinite AI Piano</h1>
               <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                 Turn your air gestures into music! <br/>
                 Swipe your finger across the strings.
               </p>
               <button 
                onClick={startCamera}
                className="w-full bg-black hover:bg-gray-800 text-white text-lg font-bold py-4 rounded-xl shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2"
               >
                 <Camera size={20} />
                 Enable Camera
               </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
             <div className="flex flex-col items-center">
                <Loader2 className="animate-spin h-8 w-8 text-sky-500 mb-2" />
                <p className="text-sm font-medium text-gray-500">{loadingMessage}</p>
             </div>
           </div>
        )}

        {/* Note Feedback Bubble */}
        {activeNote && cameraActive && (
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 pointer-events-none">
            <div key={activeNote} className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-50"></div>
            <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg text-white font-black text-xl rotate-12">
              {activeNote.replace(/\d/, '')}
            </div>
          </div>
        )}

        {/* Hint */}
        <div className="mt-auto p-6 text-center pointer-events-auto">
          {showGuide && cameraActive && (
             <div className="inline-flex items-center gap-2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md animate-bounce">
               <span className="text-xl">👆</span> Raise your index finger and swipe!
             </div>
          )}
        </div>
      </div>
    </div>
  );
}