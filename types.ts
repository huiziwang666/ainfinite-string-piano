export type InstrumentName =
  | 'acoustic_grand_piano'
  | 'acoustic_guitar_nylon'
  | 'marimba'
  | 'violin'
  | 'orchestral_harp'
  | 'xylophone'
  | 'music_box'
  | 'celesta'
  | 'glockenspiel';

export interface StringConfig {
  id: number;
  note: string; // e.g., "C4"
  color: string;
  xPos: number; // 0 to 1 normalized position
}

export type ParticleShape = 'circle' | 'star' | 'heart' | 'note' | 'sparkle';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  shape: ParticleShape;
  rotation: number;
  rotationSpeed: number;
}

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

export interface VisionResult {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z: number;
  isVisible: boolean;
}

export enum PitchRange {
  LOW = 'Low',
  MID = 'Mid',
  HIGH = 'High'
}