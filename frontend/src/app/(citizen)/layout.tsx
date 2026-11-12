import BottomNavigation from "@/components/layout/BottomNavigation/BottomNavigation";

export default function CitizenLayout({children,}: { children: React.ReactNode;}) {
  return (
    <div className="min-h-screen bg-gray-50">

      <main className="mx-auto min-h-[calc(100vh-64px)] max-w-[1440px] pb-20 md:pb-6">
        {children}
      </main>

      <BottomNavigation />
    </div>
  );
}
