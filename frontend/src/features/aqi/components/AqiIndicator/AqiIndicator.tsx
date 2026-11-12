interface AqiIndicatorProps {
  value: number;
}

const levels = [
  { label: "Baik", color: "#10B981", min: 0, max: 50 },
  { label: "Sedang", color: "#FACC15", min: 51, max: 100 },
  { label: "Tidak Sehat", color: "#F97316", min: 101, max: 150 },
  { label: "Sangat Tidak Sehat", color: "#E11D48", min: 151, max: 200 },
  { label: "Berbahaya", color: "#A855F7", min: 201, max: 500 },
];

export default function AqiIndicator({
  value,
}: AqiIndicatorProps) {
  const activeLevel = levels.find(
    (level) => value >= level.min && value <= level.max
  );

  return (
    <div className="flex gap-1.5 rounded-full bg-white p-1.5">
      {levels.map((level) => (
        <div
          key={level.label}
          title={level.label}
          className="h-2 flex-1 rounded-full transition-all"
          style={{
            backgroundColor: level.color,
            outline:
              activeLevel?.label === level.label
                ? "2px solid #0F172A"
                : "none",
            outlineOffset: "1px",
          }}
        />
      ))}
    </div>
  );
}
