// web/components/sparkline.tsx
// Tiny grade-history sparkline. Input is the uint8 grade series (oldest→newest);
// lower uint8 = better grade, so we plot inverted (up = improving). A single
// point renders as a centered dot.

export function Sparkline({
  series,
  width = 64,
  height = 20,
}: {
  series: number[];
  width?: number;
  height?: number;
}) {
  if (!series.length) {
    return <div style={{ width, height }} aria-hidden />;
  }
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  // map uint8 0..9 (0 best) → y (0 best = top)
  const y = (v: number) => pad + (v / 9) * h;
  const x = (i: number) =>
    pad + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);

  if (series.length === 1) {
    return (
      <svg width={width} height={height} aria-label="single rating">
        <circle cx={x(0)} cy={y(series[0])} r={2.5} fill="rgb(var(--ts-accent))" />
      </svg>
    );
  }
  const d = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={width} height={height} aria-label="grade history">
      <path d={d} fill="none" stroke="rgb(var(--ts-accent))" strokeWidth={1.25} />
      <circle
        cx={x(series.length - 1)}
        cy={y(series[series.length - 1])}
        r={2}
        fill="rgb(var(--ts-accent))"
      />
    </svg>
  );
}
