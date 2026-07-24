interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  size?: number;
  stroke?: number;
  /** texto central (ex.: "70%"); se omitido, mostra o número inteiro do percent */
  label?: string;
  /** cor do arco (CSS) — por omissão o branco-projetor da v2 */
  color?: string;
}

// Anel de progresso em SVG — o arco a fechar-se à volta da série.
export default function ProgressRing({
  percent,
  size = 56,
  stroke = 5,
  label,
  color = "var(--color-ink)",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 400ms ease" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="ep-code fill-ink"
        style={{ fontSize: size * 0.26, fontWeight: 700 }}
      >
        {label ?? `${Math.round(clamped)}%`}
      </text>
    </svg>
  );
}
