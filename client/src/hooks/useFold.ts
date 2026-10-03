import { useState } from 'react';

const KEY = 'mefiance-folded';

function readFolded(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function useFold(id: string): [boolean, () => void] {
  const [folded, setFolded] = useState(() => readFolded().includes(id));
  const toggle = () => {
    const next = !folded;
    setFolded(next);
    try {
      const ids = new Set(readFolded());
      if (next) ids.add(id);
      else ids.delete(id);
      localStorage.setItem(KEY, JSON.stringify([...ids]));
    } catch {
      return;
    }
  };
  return [folded, toggle];
}
