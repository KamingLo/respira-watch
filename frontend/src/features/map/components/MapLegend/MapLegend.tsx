const legends = [
  {
    label: "ISPA",
    color: "#047857",
  },
  {
    label: "Diare",
    color: "#F59E0B",
  },
  {
    label: "Area Cluster",
    color: "#FBBF24",
  },
];

export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-3">
      {legends.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2"
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />

          <span className="text-xs text-gray-600">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
