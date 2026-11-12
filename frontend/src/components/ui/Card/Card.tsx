interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export default function Card({
  children,
  title,
  className = "",
}: CardProps) {
  return (
    <section
      className={`w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-base font-bold text-gray-800">
          {title}
        </h3>
      )}

      <div className="w-full">{children}</div>
    </section>
  );
}
