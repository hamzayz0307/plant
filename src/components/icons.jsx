const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

const make = (paths, { size = 24, sw = 1.8, fill = false } = {}) =>
  function Icon({ size: s = size }) {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" {...base} strokeWidth={sw} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}>
        {paths}
      </svg>
    );
  };

export const Leaf = make(<><path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Z" /><path d="M5 19 13 11" /></>);
export const Scan = make(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 15c0-4 3-7 8-7-.5 5-3.5 7-8 7Z" /></>, { sw: 2 });
export const Garden = make(<><path d="M6 14h12l-1.5 6h-9L6 14Z" /><path d="M12 14V9" /><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z" /><path d="M12 11c0-2.4-1.6-4-4-4 0 2.4 1.6 4 4 4Z" /></>);
export const Home = make(<><path d="M4 10 12 4l8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" /><path d="M10 20v-6h4v6" /></>);
export const User = make(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>);
export const Drop = make(<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />, { size: 14, sw: 2 });
export const Sun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, { size: 14, sw: 2 });
export const Soil = make(<path d="M3 14h18M5 18h14M8 10c0-3 2-5 4-6 2 1 4 3 4 6" />, { size: 14, sw: 2 });
export const Temp = make(<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" />, { size: 14, sw: 2 });
export const Mist = make(<path d="M4 8h12M4 12h16M4 16h10" />, { size: 14, sw: 2 });
export const Gauge = make(<><path d="M4 18a8 8 0 1 1 16 0" /><path d="m12 18 4-6" /></>, { size: 14, sw: 2 });
export const Paw = make(<><circle cx="7" cy="9" r="2" /><circle cx="17" cy="9" r="2" /><circle cx="10" cy="5.5" r="2" /><circle cx="14" cy="5.5" r="2" /><path d="M12 11c-3 0-6 4-6 6.5 0 1.5 1.5 2 3 2 1.2 0 2-.5 3-.5s1.8.5 3 .5c1.5 0 3-.5 3-2 0-2.5-3-6.5-6-6.5Z" /></>, { size: 18, fill: true });
export const Child = make(<><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M8 11h8M10 21l2-6 2 6" /></>, { size: 18, sw: 2 });
export const Camera = make(<><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></>, { size: 40, sw: 1.6 });
export const Chev = make(<path d="m9 6 6 6-6 6" />, { size: 18, sw: 2 });
export const Back = make(<path d="m15 6-6 6 6 6" />, { size: 18, sw: 2.2 });
export const Info = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>, { size: 16, sw: 2 });
export const Plus = make(<path d="M12 5v14M5 12h14" />, { size: 18, sw: 2.2 });
export const Check = make(<path d="M5 12l4 4 10-10" />, { size: 18, sw: 2.2 });
export const Warn = make(<><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17h.01" /></>, { size: 16, sw: 2 });
export const X = make(<path d="M6 6l12 12M18 6 6 18" />, { size: 16, sw: 2.2 });
export const Cloud = make(<><path d="M7 17a4 4 0 1 1 .6-8A5 5 0 0 1 17 10a3.5 3.5 0 0 1 0 7H7Z" /><path d="M9 20l1-1.5M13 20l1-1.5" /></>, { size: 14, sw: 2 });
export const Window = make(<><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M12 4v16M4 12h16" /></>, { size: 20 });
export const Balcony = make(<><path d="M4 12h16M4 20h16M6 12v8M10 12v8M14 12v8M18 12v8" /><path d="M8 12V6a4 4 0 0 1 8 0v6" /></>, { size: 20 });
export const Pulse = make(<path d="M3 12h4l2-5 4 10 2-5h6" />, { size: 18, sw: 2 });
export const Link = make(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>, { size: 18, sw: 2 });
export const Bell = make(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, { size: 18, sw: 2 });
export const Search = make(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, { size: 22, sw: 2 });
