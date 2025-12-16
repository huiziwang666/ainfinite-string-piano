import { PitchRange, InstrumentName } from './types';

// ================= TUNING GUIDE =================
// Adjust these values to change game feel

export const CONFIG = {
  // Minimum time (ms) between triggering the same string
  DEBOUNCE_MS: 120,

  // Visuals
  PARTICLE_COUNT_PER_HIT: 15,
  STRING_THICKNESS_BASE: 4,
  STRING_THICKNESS_ACTIVE: 8,

  // Physics (Visual only)
  STRING_TENSION: 0.2,
  STRING_DAMPING: 0.9,

  // Kid-friendly settings
  CONFETTI_TRIGGER_COUNT: 5, // Notes needed to trigger confetti
  CONFETTI_PARTICLE_COUNT: 50,
};

// Rainbow colors for strings
export const STRING_COLORS = [
  '#FF595E', // Red
  '#FF924C', // Orange
  '#FFCA3A', // Yellow
  '#C5CA30', // Lime
  '#8AC926', // Green
  '#52A675', // Teal
  '#1982C4', // Blue
  '#4267AC', // Indigo
  '#6A4C93', // Violet
  '#B5A6C9', // Lavender
];

export const INSTRUMENTS: { label: string; value: InstrumentName }[] = [
  { label: '🎹 Piano', value: 'acoustic_grand_piano' },
  { label: '🎸 Guitar', value: 'acoustic_guitar_nylon' },
  { label: '🎼 Harp', value: 'orchestral_harp' },
  { label: '🪵 Marimba', value: 'marimba' },
  { label: '🎻 Violin', value: 'violin' },
  { label: '🔔 Xylophone', value: 'xylophone' },
  { label: '🎁 Music Box', value: 'music_box' },
  { label: '✨ Celesta', value: 'celesta' },
  { label: '🔔 Bells', value: 'glockenspiel' },
];

// MIDI Note Definitions
// We use a Pentatonic or Major scale to ensure it always sounds good for kids
const C_MAJOR_SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const generateStringConfigs = (count: number, range: PitchRange) => {
  const configs = [];
  let octaveStart = 4;
  
  if (range === PitchRange.LOW) octaveStart = 3;
  if (range === PitchRange.HIGH) octaveStart = 5;

  for (let i = 0; i < count; i++) {
    const scaleIndex = i % C_MAJOR_SCALE.length;
    const octaveShift = Math.floor(i / C_MAJOR_SCALE.length);
    const note = `${C_MAJOR_SCALE[scaleIndex]}${octaveStart + octaveShift}`;
    
    configs.push({
      id: i,
      note,
      color: STRING_COLORS[i % STRING_COLORS.length],
      xPos: (i + 1) / (count + 1), // Distribute evenly
    });
  }
  return configs;
};

// Confetti colors
export const CONFETTI_COLORS = [
  '#FF595E', '#FF924C', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93',
  '#FF6B9D', '#C44DFF', '#00D4AA', '#FFD93D',
];

// Particle shape options
export const PARTICLE_SHAPES = ['star', 'heart', 'note', 'sparkle', 'circle'] as const;