import Soundfont from 'soundfont-player';
import { InstrumentName } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
  private instrument: Soundfont.Player | null = null;
  private currentInstrumentName: InstrumentName = 'acoustic_grand_piano';

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  // Must be called on a user interaction (click/touch)
  public async resume() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      // Create a silent buffer to warm up the engine
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    }
  }

  public async loadInstrument(name: InstrumentName): Promise<void> {
    if (!this.ctx) return;

    // Avoid double loading if already loaded
    if (this.currentInstrumentName === name && this.instrument) return;

    // Track which instrument we're loading (handles rapid switching)
    const loadingName = name;
    this.currentInstrumentName = name;

    // Don't clear the old instrument - keep it playing until new one is ready
    try {
      const newPlayer = await Soundfont.instrument(this.ctx, name, {
        format: 'mp3',
        soundfont: 'MusyngKite',
      });

      // Only set if this is still the instrument we want (user didn't switch again)
      if (this.currentInstrumentName === loadingName) {
        this.instrument = newPlayer;
      }
    } catch (err) {
      console.warn('Soundfont failed to load, falling back to oscillator:', err);
    }
  }

  public playNote(note: string) {
    if (!this.ctx) return;

    // 1. Try Soundfont
    if (this.instrument) {
      try {
        this.instrument.play(note, 0, { 
          duration: 2.5, 
          gain: 0.8 + Math.random() * 0.2 
        });
        return;
      } catch (e) {
        console.warn("Soundfont play error", e);
      }
    }

    // 2. Fallback: Simple Oscillator (Synthesizer)
    // Plays immediately if soundfont is loading or failed
    this.playFallbackTone(note);
  }

  private playFallbackTone(note: string) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    const freq = this.getFrequencyFromNote(note);
    osc.frequency.value = freq;
    
    // Smooth plucked string envelope
    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0); // Decay
    
    osc.start(now);
    osc.stop(now + 1.0);
  }

  private getFrequencyFromNote(note: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = parseInt(note.slice(-1)) || 4;
    const noteName = note.slice(0, -1);
    const semitone = notes.indexOf(noteName);
    
    if (semitone === -1) return 440;

    // A4 is 440Hz (midi 69)
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  public stopAll() {
    if (this.instrument) {
      this.instrument.stop();
    }
  }
}

export const audioService = new AudioService();