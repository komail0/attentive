import { LOGO_A } from "./logoPath";

/** The Attentive logo: a slide with a pin, and a thin A with a slight raised edge. Colours come from the theme. */
export function Logo({ size = 34, className = "logo", title, animated = false }: { size?: number; className?: string; title?: string; animated?: boolean }) {
  const layers = [1.0, 0.75, 0.5, 0.25];
  return (
    <svg className={`${className}${animated ? " logo-slam" : ""}`} viewBox="0 0 64 64" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <g className="lg-sway">
      <g className="lg-frame">
        <rect x="6" y="14" width="46" height="42" rx="8" fill="none" stroke="var(--logo-frame)" strokeWidth="4.5" />
        <path d="M16 32h26M16 43h16" stroke="var(--logo-frame)" strokeWidth="4.5" strokeLinecap="round" />
      </g>
      <g className="lg-pin">
        <circle cx="51" cy="14" r="11" fill="var(--logo-pin)" />
        <circle cx="51" cy="14" r="3.8" fill="var(--bg)" />
      </g>
      <g className="lg-a">
      <path d={LOGO_A} fill="var(--bg)" stroke="var(--bg)" strokeWidth="2.6" strokeLinejoin="round" transform="translate(0.5 0.5)" />
      {layers.map((o) => (
        <path key={o} d={LOGO_A} fill="var(--logo-deep)" stroke="var(--logo-deep)" strokeWidth="0.4" strokeLinejoin="round" transform={`translate(${o} ${o})`} />
      ))}
      <path d={LOGO_A} fill="var(--logo-face)" />
      <path d={LOGO_A} fill="none" stroke="var(--logo-rim)" strokeOpacity=".45" strokeWidth="0.6" strokeLinejoin="round" transform="translate(-0.3 -0.3)" />
      </g>
      </g>
    </svg>
  );
}
