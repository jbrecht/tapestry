const LABELS: Record<string, string> = {
  startTime: 'Start',
  endTime: 'End',
  locationType: 'Location type',
  extraInfo: 'Notes',
};

/** Returns a human-readable label for a node attribute key. */
export function attrLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  // Fallback: split camelCase → "Camel Case"
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
