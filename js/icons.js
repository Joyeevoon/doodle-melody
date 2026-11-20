// Two-tone rounded icons (brown line + warm fill), sized by CSS.
const w = (inner, fill = '') => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${fill}${inner}</svg>`;
const F = 'var(--ic-fill,#FFD966)';

export const IC = {
  pen: w(`<path d="M20 5l7 7-12.5 12.5-8.5 2 2-8.5z"/><path d="M17.5 7.5l7 7"/><circle cx="13" cy="19" r="1.6"/>`, `<path d="M20 5l7 7-12.5 12.5-8.5 2 2-8.5z" fill="${F}" stroke="none"/>`),
  pencil: w(`<path d="M22 4l6 6L11 27H5v-6z"/><path d="M18 8l6 6"/><path d="M5 21l6 6"/>`, `<path d="M22 4l6 6L11 27H5v-6z" fill="${F}" stroke="none"/>`),
  ink: w(`<path d="M24 4c2 1 4 3 4 5l-9 9-4-4z"/><path d="M15 14l4 4c-1 5-5 9-13 10 1-8 5-12 9-14z"/>`, `<path d="M15 14l4 4c-1 5-5 9-13 10 1-8 5-12 9-14z" fill="#5A4632" stroke="none" opacity=".85"/><path d="M24 4c2 1 4 3 4 5l-9 9-4-4z" fill="${F}" stroke="none"/>`),
  marker: w(`<path d="M9 19l11-11 5 5-11 11z"/><path d="M9 19l-3 7 7-3"/><path d="M20 8l3-3 5 5-3 3"/>`, `<path d="M9 19l11-11 5 5-11 11z" fill="${F}" stroke="none"/><path d="M4 28h12" stroke="#F49AB5" stroke-width="3.5"/>`),
  water: w(`<path d="M16 4c5 7 9 11 9 16a9 9 0 0 1-18 0c0-5 4-9 9-16z"/><path d="M11.5 20a4.5 4.5 0 0 0 4.5 4.5"/>`, `<path d="M16 4c5 7 9 11 9 16a9 9 0 0 1-18 0c0-5 4-9 9-16z" fill="#9DD3F5" stroke="none"/>`),
  crayon: w(`<path d="M7 25l4-12 12-8 4 4-8 12z"/><path d="M11 13l8 8"/><path d="M15 10l7 7"/>`, `<path d="M7 25l4-12 12-8 4 4-8 12z" fill="#F7A86B" stroke="none"/>`),
  spray: w(`<rect x="8" y="12" width="12" height="16" rx="3"/><path d="M11 12V8h6v4"/><path d="M17 8h3"/><circle cx="25" cy="6" r=".6"/><circle cx="27" cy="10" r=".6"/><circle cx="24" cy="11" r=".6"/><circle cx="28" cy="5" r=".6"/>`, `<rect x="8" y="12" width="12" height="16" rx="3" fill="${F}" stroke="none"/>`),
  neon: w(`<path d="M5 22c4-10 8 4 12-6s6-8 10-4"/>`, `<path d="M5 22c4-10 8 4 12-6s6-8 10-4" stroke="#FF8FD0" stroke-width="7" opacity=".45"/>`),
  star: w(`<path d="M16 4l3.6 7.4 8 1.2-5.8 5.6 1.4 8L16 22.4 8.8 26.2l1.4-8L4.4 12.6l8-1.2z"/>`, `<path d="M16 4l3.6 7.4 8 1.2-5.8 5.6 1.4 8L16 22.4 8.8 26.2l1.4-8L4.4 12.6l8-1.2z" fill="${F}" stroke="none"/>`),
  eraser: w(`<path d="M18 5l9 9-12 12H9l-5-5z"/><path d="M11 12l9 9"/><path d="M15 26h12"/>`, `<path d="M18 5l9 9-7 7-9-9z" fill="#F7A1B9" stroke="none"/>`),
  undo: w(`<path d="M11 8L5 14l6 6"/><path d="M5 14h14a7 7 0 0 1 0 14h-5"/>`),
  redo: w(`<path d="M21 8l6 6-6 6"/><path d="M27 14H13a7 7 0 0 0 0 14h5"/>`),
  trash: w(`<path d="M6 9h20"/><path d="M12 9V6h8v3"/><path d="M8 9l1.5 17a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2L24 9"/><path d="M13.5 14v9M18.5 14v9"/>`),
  image: w(`<rect x="4" y="6" width="24" height="20" rx="4"/><circle cx="11.5" cy="12.5" r="2.5"/><path d="M4 22l7-6 5 4 4-3 8 6"/>`, `<rect x="4" y="6" width="24" height="20" rx="4" fill="${F}" stroke="none"/>`),
  grid: w(`<rect x="4" y="4" width="24" height="24" rx="4"/><path d="M4 12.5h24M4 20h24"/><circle cx="11" cy="12.5" r="1.8" fill="currentColor"/><circle cx="19" cy="20" r="1.8" fill="currentColor"/><circle cx="23" cy="8.5" r="1.8" fill="currentColor"/>`),
  play: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17a1.5 1.5 0 0 0 2.3 1.3l13-8.5a1.5 1.5 0 0 0 0-2.6l-13-8.5A1.5 1.5 0 0 0 11 7.5z" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="7" width="5.5" height="18" rx="2" fill="currentColor"/><rect x="18.5" y="7" width="5.5" height="18" rx="2" fill="currentColor"/></svg>`,
  save: w(`<path d="M16 5v14"/><path d="M10 13l6 6 6-6"/><path d="M6 21v3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-3"/>`),
  sliders: w(`<path d="M6 9h20M6 16h20M6 23h20"/><circle cx="12" cy="9" r="2.6" fill="${F}"/><circle cx="21" cy="16" r="2.6" fill="${F}"/><circle cx="10" cy="23" r="2.6" fill="${F}"/>`),
  help: w(`<circle cx="16" cy="16" r="12"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3v.5"/><circle cx="16" cy="22.5" r=".8" fill="currentColor"/>`),
  close: w(`<path d="M9 9l14 14M23 9L9 23"/>`),
  note: w(`<path d="M12 24V8l14-3v15"/><circle cx="9" cy="24" r="3.5"/><circle cx="23" cy="21" r="3.5"/>`, `<circle cx="9" cy="24" r="3.5" fill="${F}" stroke="none"/><circle cx="23" cy="21" r="3.5" fill="${F}" stroke="none"/>`),
  palette: w(`<path d="M16 4C9 4 4 9 4 15.5S9 28 15 28c2 0 2.5-1.4 2-2.6-.7-1.6.3-3.4 2.2-3.4H22a6 6 0 0 0 6-6C28 9 22.6 4 16 4z"/><circle cx="10" cy="14" r="1.8"/><circle cx="14" cy="9" r="1.8"/><circle cx="20" cy="9.5" r="1.8"/>`, `<path d="M16 4C9 4 4 9 4 15.5S9 28 15 28c2 0 2.5-1.4 2-2.6-.7-1.6.3-3.4 2.2-3.4H22a6 6 0 0 0 6-6C28 9 22.6 4 16 4z" fill="${F}" stroke="none"/>`),
  plus: w(`<path d="M16 8v16M8 16h16"/>`),
};
