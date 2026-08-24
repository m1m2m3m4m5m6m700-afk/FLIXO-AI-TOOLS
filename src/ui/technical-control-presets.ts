export type TechnicalControlPreset = {
  id: string;
  label: string;
  icon: string;
  group: string;
};

export const TECHNICAL_CONTROL_PRESETS: TechnicalControlPreset[] = [
  { id: 'quality', label: 'Quality', icon: 'gauge', group: 'Output' },
  { id: 'strength', label: 'Strength', icon: 'sparkles', group: 'Adjust' },
  { id: 'intensity', label: 'Intensity', icon: 'activity', group: 'Adjust' },
  { id: 'format', label: 'Format', icon: 'layers', group: 'Output' },
  { id: 'preview', label: 'Preview', icon: 'scan', group: 'Workspace' },
  { id: 'export', label: 'Export', icon: 'download', group: 'Output' },
];

export const TECHNICAL_UI_TOKENS = {
  radius: 12,
  panelRadius: 18,
  controlHeight: 44,
  accent: '#67e8f9',
  accentSecondary: '#6366f1',
};
