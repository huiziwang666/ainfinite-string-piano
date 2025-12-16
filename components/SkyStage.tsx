import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Camera, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { audioService } from '../services/audioService';
import { visionService } from '../services/visionService';
import { CONFIG, generateStringConfigs, INSTRUMENTS, CONFETTI_COLORS, PARTICLE_SHAPES } from '../constants';
import { PitchRange, StringConfig, Particle, InstrumentName, ConfettiParticle, ParticleShape } from '../types';

// Helper: Draw different particle shapes
const drawParticleShape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: ParticleShape,
  rotation: number,
  color: string
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;

  switch (shape) {
    case 'star':
      drawStar(ctx, 0, 0, 5, size, size / 2);
      break;
    case 'heart':
      drawHeart(ctx, 0, 0, size);
      break;
    case 'note':
      drawMusicNote(ctx, 0, 0, size);
      break;
    case 'sparkle':
      drawSparkle(ctx, 0, 0, size);
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
};

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
};

const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y + size / 4);
  ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
  ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.7, x, y + size);
  ctx.bezierCurveTo(x, y + size * 0.7, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
  ctx.fill();
};

const drawMusicNote = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.beginPath();
  ctx.ellipse(x - size / 3, y + size / 2, size / 2, size / 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x, y - size, size / 4, size * 1.5);
  ctx.beginPath();
  ctx.moveTo(x + size / 4, y - size);
  ctx.quadraticCurveTo(x + size, y - size / 2, x + size / 4, y);
  ctx.lineTo(x + size / 4, y - size / 4);
  ctx.quadraticCurveTo(x + size / 2, y - size / 2, x + size / 4, y - size);
  ctx.fill();
};

const drawSparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.beginPath();
  const points = 4;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? size : size / 3;
    const angle = (i * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

// Mascot component
const Mascot: React.FC<{ excitement: number; notesPlayed: number }> = ({ excitement, notesPlayed }) => {
  const bounce = excitement > 0.3 ? 'animate-bounce' : '';
  const scale = 1 + excitement * 0.3;

  // Different expressions based on excitement
  const getExpression = () => {
    if (notesPlayed === 0) return { eyes: '◕ ◕', mouth: '‿' }; // Calm
    if (excitement > 0.7) return { eyes: '★ ★', mouth: 'D' }; // Super excited
    if (excitement > 0.4) return { eyes: '◕ ◕', mouth: 'D' }; // Happy
    return { eyes: '◕ ◕', mouth: '◡' }; // Content
  };

  const expr = getExpression();

  return (
    <div
      className={`fixed bottom-24 right-6 z-30 transition-transform duration-200 ${bounce}`}
      style={{ transform: `scale(${scale})` }}
    >
      <div className="relative">
        {/* Mascot body - cute blob character */}
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg flex items-center justify-center flex-col border-4 border-white">
          <div className="text-lg font-bold tracking-wider" style={{ marginTop: -4 }}>
            {expr.eyes}
          </div>
          <div className="text-xl font-bold" style={{ marginTop: -8 }}>
            {expr.mouth}
          </div>
        </div>
        {/* Blush */}
        <div className="absolute left-1 top-10 w-3 h-2 bg-pink-300 rounded-full opacity-60" />
        <div className="absolute right-1 top-10 w-3 h-2 bg-pink-300 rounded-full opacity-60" />
        {/* Musical notes floating when excited */}
        {excitement > 0.5 && (
          <>
            <div className="absolute -top-2 -right-2 text-2xl animate-ping">🎵</div>
            <div className="absolute -top-4 left-0 text-xl animate-pulse">✨</div>
          </>
        )}
      </div>
      {notesPlayed >= CONFIG.CONFETTI_TRIGGER_COUNT && (
        <div className="text-center mt-1 text-xs font-bold text-orange-600 animate-pulse">
          Amazing! 🎉
        </div>
      )}
    </div>
  );
};

export default function SkyStage() {
  // -- State --
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Warming up the orchestra...');
  const [cameraActive, setCameraActive] = useState(false);
  const [showCameraFeed, setShowCameraFeed] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [instrument, setInstrument] = useState<InstrumentName>('music_box');
  const [pitchRange, setPitchRange] = useState<PitchRange>(PitchRange.MID);
  const [stringCount, setStringCount] = useState(12);
  const [showGuide, setShowGuide] = useState(true);

  // Kid-friendly features
  const [rainbowMode, setRainbowMode] = useState(true);
  const [notesPlayedRecently, setNotesPlayedRecently] = useState(0);
  const [mascotExcitement, setMascotExcitement] = useState(0);


  // -- Refs for Logic Loop --
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const stringsRef = useRef<StringConfig[]>([]);

  // Physics & Logic Refs
  const lastLandmarksRef = useRef<any>(null);
  // Track previous positions for multiple fingertips (index=0, middle=1)
  const prevFingerX = useRef<(number | null)[]>([null, null]);
  const prevFingerVisible = useRef<boolean[]>([false, false]);
  const lastTriggerTimes = useRef<Record<number, number>>({});
  const particles = useRef<Particle[]>([]);
  const confetti = useRef<ConfettiParticle[]>([]);
  const stringPhysics = useRef<Record<number, { vibration: number, bend: number }>>({});
  const tickRef = useRef<() => void>();
  const cameraActiveRef = useRef(false);
  const rainbowHue = useRef(0);
  const noteCountRef = useRef(0);
  const lastNoteTime = useRef(0);

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
      prevFingerX.current = [null, null];
      prevFingerVisible.current = [false, false];
    }
  }, [cameraActive]);

  // Instrument switching
  useEffect(() => {
    audioService.loadInstrument(instrument);
  }, [instrument]);

  // Decay excitement over time
  useEffect(() => {
    const interval = setInterval(() => {
      setMascotExcitement(prev => Math.max(0, prev - 0.05));
      setNotesPlayedRecently(prev => Math.max(0, prev - 1));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const triggerConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (let i = 0; i < CONFIG.CONFETTI_PARTICLE_COUNT; i++) {
      confetti.current.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 15 - 5,
        life: 1.0,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 10 + 5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  };

  // -- Core Game Loop --
  const tick = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Update rainbow hue
    rainbowHue.current = (rainbowHue.current + 0.5) % 360;

    // 2. Vision Detection
    let handX = -1;
    let handY = -1;
    let isVisible = false;

    // Use ref to avoid stale closure issue
    if (cameraActiveRef.current && videoRef.current.readyState >= 2) {
      const results = visionService.detect(videoRef.current);
      if (results && results.landmarks.length > 0) {
        // Store all detected hands (up to 2)
        lastLandmarksRef.current = results.landmarks;
      }

      if (lastLandmarksRef.current && lastLandmarksRef.current.length > 0) {
        const allHands = lastLandmarksRef.current;
        const handColors = ['#FFD700', '#FF69B4']; // Gold for first hand, Pink for second

        // Draw cursors for each hand's index finger
        allHands.forEach((landmarks: any, handIndex: number) => {
          const tip = landmarks[8]; // Index finger tip
          if (!tip) return;

          const fingerX = 1.0 - tip.x; // Mirror X
          const fingerY = tip.y;

          // Draw skeleton for each hand
          ctx.strokeStyle = handIndex === 0 ? "rgba(255, 215, 0, 0.5)" : "rgba(255, 105, 180, 0.5)";
          ctx.lineWidth = 3;
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

          // Draw Magic Wand Cursor for each hand
          const cursorX = fingerX * width;
          const cursorY = fingerY * height;
          const color = handColors[handIndex] || handColors[0];

          ctx.shadowColor = color;
          ctx.shadowBlur = 25;
          ctx.fillStyle = color;
          drawStar(ctx, cursorX, cursorY, 5, 16, 8);

          ctx.shadowBlur = 0;
          ctx.fillStyle = "#FFF";
          drawStar(ctx, cursorX, cursorY, 5, 10, 5);

          // Sparkle trail for each hand
          if (Math.random() > 0.8) {
            const shapes: ParticleShape[] = ['sparkle', 'star'];
            particles.current.push({
              x: cursorX + (Math.random() - 0.5) * 20,
              y: cursorY + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 2,
              vy: Math.random() * 2 + 1,
              life: 0.8,
              color: color,
              size: Math.random() * 6 + 3,
              shape: shapes[Math.floor(Math.random() * shapes.length)],
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 0.2,
            });
          }
        });

        // Use first hand's index finger for general visibility/position (for rendering effects)
        const indexTip = allHands[0][8];
        handX = 1.0 - indexTip.x;
        handY = indexTip.y;
        isVisible = true;
      }
    }

    // 3. Physics & Interaction Logic
    const now = performance.now();
    const reachThreshold = 0.08;

    // Get current finger positions from all detected hands (index finger only)
    const fingerPositions: { x: number; y: number; visible: boolean }[] = [];
    if (lastLandmarksRef.current && lastLandmarksRef.current.length > 0) {
      const allHands = lastLandmarksRef.current;
      // Get index finger from each hand (up to 2 hands)
      for (let i = 0; i < 2; i++) {
        if (allHands[i]) {
          const tip = allHands[i][8]; // Index finger tip
          if (tip) {
            fingerPositions.push({
              x: 1.0 - tip.x,
              y: tip.y,
              visible: true
            });
          } else {
            fingerPositions.push({ x: -1, y: -1, visible: false });
          }
        } else {
          fingerPositions.push({ x: -1, y: -1, visible: false });
        }
      }
    }

    stringsRef.current.forEach((str) => {
      // Initialize physics state if needed
      if (!stringPhysics.current[str.id]) {
        stringPhysics.current[str.id] = { vibration: 0, bend: 0 };
      }

      const physics = stringPhysics.current[str.id];

      // Check bending for closest finger
      let closestBend = 0;
      fingerPositions.forEach((finger) => {
        if (!finger.visible) return;
        const distToFingerX = finger.x - str.xPos;
        const isWithinReach = Math.abs(distToFingerX) < reachThreshold;

        if (isWithinReach && physics.vibration < 0.1) {
          const pullFactor = 1.0 - (Math.abs(distToFingerX) / reachThreshold);
          const bend = (distToFingerX * width) * pullFactor * 0.8;
          if (Math.abs(bend) > Math.abs(closestBend)) {
            closestBend = bend;
          }
        }
      });

      if (closestBend !== 0) {
        physics.bend = closestBend;
      } else {
        physics.bend *= 0.8;
      }

      // -- Trigger Logic (Crossing) for each finger --
      fingerPositions.forEach((finger, fingerIndex) => {
        if (!finger.visible) return;

        const isInStringArea = finger.y <= 0.67;
        const prevX = prevFingerX.current[fingerIndex];
        const wasVisible = prevFingerVisible.current[fingerIndex];

        if (wasVisible && prevX !== null && isInStringArea) {
          const xPos = str.xPos;
          const crossedRight = prevX < xPos && finger.x >= xPos;
          const crossedLeft = prevX > xPos && finger.x <= xPos;

          if (crossedRight || crossedLeft) {
            const lastTime = lastTriggerTimes.current[str.id] || 0;
            if (now - lastTime > CONFIG.DEBOUNCE_MS) {
              triggerString(str, now, finger.y);
              physics.bend = 0;
            }
          }
        }
      });
    });

    // Update previous finger positions
    fingerPositions.forEach((finger, idx) => {
      if (finger.visible) {
        prevFingerX.current[idx] = finger.x;
        prevFingerVisible.current[idx] = true;
      } else {
        prevFingerVisible.current[idx] = false;
      }
    });

    // 4. Render Strings & Effects
    renderStringsAndEffects(ctx, width, height, now, handY, isVisible);

    // Use tickRef to avoid stale closure
    requestRef.current = requestAnimationFrame(() => tickRef.current?.());
  }, []);

  // Keep tickRef in sync
  tickRef.current = tick;

  const triggerString = (str: StringConfig, time: number, yPosNormalized: number) => {
    // Audio
    audioService.playNote(str.note);
    setActiveNote(str.note);

    // Track notes for mascot excitement
    noteCountRef.current++;
    const timeSinceLastNote = time - lastNoteTime.current;
    lastNoteTime.current = time;

    // If playing fast, increase excitement more
    if (timeSinceLastNote < 500) {
      setMascotExcitement(prev => Math.min(1, prev + 0.2));
    } else {
      setMascotExcitement(prev => Math.min(1, prev + 0.1));
    }
    setNotesPlayedRecently(prev => prev + 1);

    // Trigger confetti when reaching milestone
    if (noteCountRef.current % 20 === 0) {
      triggerConfetti();
    }

    // Physics
    lastTriggerTimes.current[str.id] = time;
    if (stringPhysics.current[str.id]) {
      stringPhysics.current[str.id].vibration = 1.0;
    }

    // Visuals: Fun shaped particles!
    const canvas = canvasRef.current;
    if (canvas) {
      const x = str.xPos * canvas.width;
      const y = yPosNormalized * canvas.height;

      for (let i = 0; i < CONFIG.PARTICLE_COUNT_PER_HIT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        const shapeIndex = Math.floor(Math.random() * PARTICLE_SHAPES.length);
        particles.current.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: str.color,
          size: Math.random() * 8 + 4,
          shape: PARTICLE_SHAPES[shapeIndex],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
        });
      }
    }
  };

  const renderStringsAndEffects = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, handY: number, handVisible: boolean) => {
    // Strings only occupy top 2/3 of screen, leaving bottom 1/3 for hand visibility
    const stringHeight = height * 0.67;

    // Render Strings
    stringsRef.current.forEach((str, index) => {
      const phys = stringPhysics.current[str.id] || { vibration: 0, bend: 0 };
      const xBase = str.xPos * width;

      // Calculate color
      let strokeColor = str.color;
      if (rainbowMode && (phys.vibration > 0.01 || Math.abs(phys.bend) > 5)) {
        // Rainbow animated color when active
        const hue = (rainbowHue.current + index * 30) % 360;
        strokeColor = `hsl(${hue}, 100%, 60%)`;
      } else if (phys.vibration < 0.01 && Math.abs(phys.bend) <= 5) {
        strokeColor = rainbowMode
          ? `hsl(${(index * 30) % 360}, 70%, 70%)`
          : 'rgba(255,255,255,0.6)';
      }

      ctx.beginPath();
      ctx.moveTo(xBase, 0);

      // Determine string shape
      if (phys.vibration > 0.01) {
        // -- VIBRATION MODE --
        const freq = 0.2;
        const amp = phys.vibration * 25; // Slightly bigger vibration

        for (let y = 0; y <= stringHeight; y += 20) {
           const env = Math.sin((y / stringHeight) * Math.PI);
           const wave = Math.sin(y * freq + time * 0.1) * amp * env;
           ctx.lineTo(xBase + wave, y);
        }

        phys.vibration *= 0.92;

        ctx.lineWidth = CONFIG.STRING_THICKNESS_ACTIVE;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 20;
      } else if (Math.abs(phys.bend) > 1 && handVisible) {
        // -- BEND MODE (Elastic) --
        const yPx = Math.min(handY * height, stringHeight);
        ctx.quadraticCurveTo(xBase + phys.bend * 1.5, yPx, xBase, stringHeight);

        ctx.lineWidth = CONFIG.STRING_THICKNESS_BASE + 2;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 10;
      } else {
        // -- REST MODE --
        ctx.lineTo(xBase, stringHeight);
        ctx.lineWidth = CONFIG.STRING_THICKNESS_BASE;
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bottom Anchor Beads (bigger and cuter)
      const beadGradient = ctx.createRadialGradient(xBase, stringHeight - 10, 0, xBase, stringHeight - 10, 10);
      beadGradient.addColorStop(0, '#FFF');
      beadGradient.addColorStop(0.5, str.color);
      beadGradient.addColorStop(1, str.color);
      ctx.fillStyle = beadGradient;
      ctx.beginPath();
      ctx.arc(xBase, stringHeight - 10, 8, 0, Math.PI * 2);
      ctx.fill();

      // Note label on beads
      if (phys.vibration > 0.3) {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(str.note.replace(/\d/, ''), xBase, stringHeight - 7);
      }
    });

    // Render Fun Particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      p.vy += 0.15; // Lighter gravity
      p.rotation += p.rotationSpeed;

      if (p.life <= 0) {
        particles.current.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life;
      drawParticleShape(ctx, p.x, p.y, p.size, p.shape, p.rotation, p.color);
      ctx.globalAlpha = 1.0;
    }

    // Render Confetti
    for (let i = confetti.current.length - 1; i >= 0; i--) {
      const c = confetti.current[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.3; // Gravity
      c.vx *= 0.99; // Air resistance
      c.life -= 0.01;
      c.rotation += c.rotationSpeed;

      if (c.life <= 0 || c.y > height) {
        confetti.current.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.globalAlpha = c.life;
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }
  };

  const startCamera = async () => {
    try {
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
        requestRef.current = requestAnimationFrame(() => tickRef.current?.());
      }
      setShowGuide(false);
    } catch (err) {
      console.error(err);
      alert("Could not access camera. Please allow permissions and try again.");
    }
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-purple-400 via-pink-300 to-yellow-200 overflow-hidden select-none font-sans">

      {/* Animated Background with floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-6xl animate-bounce opacity-30">⭐</div>
        <div className="absolute top-20 right-20 text-5xl animate-pulse opacity-30">🌈</div>
        <div className="absolute bottom-40 left-20 text-4xl animate-bounce opacity-30" style={{ animationDelay: '0.5s' }}>🎵</div>
        <div className="absolute top-40 left-1/3 text-3xl animate-pulse opacity-30" style={{ animationDelay: '1s' }}>✨</div>
        <div className="absolute bottom-60 right-1/4 text-5xl animate-bounce opacity-30" style={{ animationDelay: '0.3s' }}>🎶</div>
      </div>

      {/* Camera Video Layer */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${showCameraFeed ? 'opacity-40' : 'opacity-0'}`}
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

      {/* Mascot */}
      {cameraActive && (
        <Mascot excitement={mascotExcitement} notesPlayed={notesPlayedRecently} />
      )}

      {/* UI Overlay */}
      <div className="relative z-20 flex flex-col h-full pointer-events-none">

        {/* Top Controls */}
        <div className="flex justify-between items-start p-4 pointer-events-auto">

          {/* Left Group */}
          <div className="flex flex-col gap-2">
            {/* View Toggle */}
            <button
              onClick={() => setShowCameraFeed(!showCameraFeed)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${showCameraFeed ? 'bg-green-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
            >
              {showCameraFeed ? <Eye size={18} /> : <EyeOff size={18} />}
              {showCameraFeed ? 'Hide Cam' : 'Show Cam'}
            </button>

            {/* Rainbow Mode Toggle */}
            <button
              onClick={() => setRainbowMode(!rainbowMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${rainbowMode ? 'bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
            >
              <Sparkles size={18} />
              Rainbow
            </button>

            {/* String Count */}
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-lg">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Strings</div>
              <div className="flex gap-1">
                {[8, 12, 16, 24, 32].map(c => (
                  <button
                    key={c}
                    onClick={() => setStringCount(c)}
                    className={`flex-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${stringCount === c ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Group: Instrument & Pitch */}
          <div className="flex flex-col gap-2 items-end max-h-[60vh] overflow-y-auto">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-lg min-w-[140px]">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Instrument</div>
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {INSTRUMENTS.map(inst => (
                  <button
                    key={inst.value}
                    onClick={() => setInstrument(inst.value)}
                    className={`px-3 py-1.5 rounded-lg text-left text-xs font-bold transition-all ${instrument === inst.value ? 'bg-purple-500 text-white' : 'text-gray-600 hover:bg-purple-50'}`}
                  >
                    {inst.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-lg">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Pitch</div>
              <div className="flex gap-1">
                {Object.values(PitchRange).map(r => (
                  <button
                    key={r}
                    onClick={() => setPitchRange(r)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${pitchRange === r ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
            <div className="bg-white/95 p-8 rounded-3xl shadow-2xl text-center max-w-sm mx-4 border-4 border-pink-200">
              <img
                src="/new-logo.png"
                alt="AInfinite Air Piano"
                className="w-24 h-24 mx-auto mb-6 animate-bounce"
              />
              <h1 className="text-3xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent mb-2">
                AInfinite Air Piano
              </h1>
              <p className="text-gray-500 mb-8 text-base leading-relaxed">
                Wave your finger to make music! ✨🎵
              </p>
              <button
                onClick={startCamera}
                className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 hover:from-pink-600 hover:via-purple-600 hover:to-yellow-600 text-white text-xl font-bold py-4 rounded-2xl shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-3"
              >
                <Camera size={24} />
                Let's Play! 🎉
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-purple-400 via-pink-300 to-yellow-200 z-50">
            <div className="flex flex-col items-center">
              <div className="text-6xl animate-bounce mb-4">🎹</div>
              <Loader2 className="animate-spin h-8 w-8 text-purple-600 mb-2" />
              <p className="text-lg font-bold text-purple-700">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Note Feedback Bubble */}
        {activeNote && cameraActive && (
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 pointer-events-none">
            <div key={activeNote + Date.now()} className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-50"></div>
            <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-300 via-pink-400 to-purple-500 rounded-full shadow-lg text-white font-black text-2xl rotate-12 border-4 border-white">
              {activeNote.replace(/\d/, '')}
            </div>
          </div>
        )}

        {/* Hint */}
        <div className="mt-auto p-6 text-center pointer-events-auto">
          {showGuide && cameraActive && (
            <div className="inline-flex items-center gap-2 bg-purple-600/80 text-white px-6 py-3 rounded-full text-base font-bold backdrop-blur-md animate-bounce shadow-lg">
              <span className="text-2xl">👆</span> Point your finger and swipe across the strings!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
