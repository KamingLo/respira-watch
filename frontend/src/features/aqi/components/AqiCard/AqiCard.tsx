import AqiIndicator from "../AqiIndicator/AqiIndicator";

interface AqiCardProps {
  value: number;
  location: string;
  subLocation?: string;
}

const getAqiStatus = (value: number) => {
  if (value <= 50) {
    return {
      label: "Baik",
      description: "Kualitas udara baik untuk aktivitas luar ruangan.",
      color: "text-green-100",
      bg: "bg-green-500",
    };
  }

  if (value <= 100) {
    return {
      label: "Sedang",
      description: "Kualitas udara cukup baik untuk sebagian besar orang.",
      color: "text-yellow-100",
      bg: "bg-yellow-500",
    };
  }

  if (value <= 150) {
    return {
      label: "Tidak Sehat",
      description: "Kelompok sensitif perlu membatasi aktivitas luar ruangan.",
      color: "text-orange-100",
      bg: "bg-orange-500",
    };
  }

  if (value <= 200) {
    return {
      label: "Sangat Tidak Sehat",
      description: "Kurangi aktivitas di luar ruangan.",
      color: "text-rose-100",
      bg: "bg-rose-600",
    };
  }

  return {
    label: "Berbahaya",
    description: "Hindari aktivitas luar ruangan.",
    color: "text-purple-100",
    bg: "bg-purple-600",
  };
};

export default function AqiCard({
  value,
  location,
  subLocation,
}: AqiCardProps) {
  const status = getAqiStatus(value);

  return (
    <section className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#047857] to-[#064E3B] p-5 text-white shadow-md">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-lg font-bold">
            {location}
          </h2>

          {subLocation && (
            <p className="mt-1 text-xs text-green-100">
              {subLocation}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white/15 p-2">
          <span className="text-2xl">🌿</span>
        </div>
      </div>

      {/* AQI Value */}
      <div className="mt-6 flex items-end gap-3">
        <div>
          <p className="text-xs font-medium text-green-100">
            Air Quality Index
          </p>

          <p className="mt-1 text-5xl font-bold tracking-tight">
            {value}
          </p>
        </div>

        <span className={`mb-1 rounded-full ${status.bg} px-3 py-1 text-xs font-bold text-white`}>
          {status.label}
        </span>
      </div>

      {/* AQI Indicator */}
      <div className="mt-5">
        <AqiIndicator value={value} />
      </div>

      {/* Description */}
      <p className={`mt-4 text-sm leading-relaxed ${status.color}`}>
        {status.description}
      </p>

    </section>
  );
}
