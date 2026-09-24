/** O aparelho usa toque como entrada principal (celular/tablet)? */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || (navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);
}

/** Mostrar os controles de toque? Segue a configuração (automático = detecta o aparelho). */
export function useTouchControls(mode: 'auto' | 'on' | 'off'): boolean {
  return mode === 'on' || (mode === 'auto' && isTouchDevice());
}
