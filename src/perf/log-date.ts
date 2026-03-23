export function parsePerformanceLogDate(fileName: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/u.exec(fileName);
  if (!match) {
    return null;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
