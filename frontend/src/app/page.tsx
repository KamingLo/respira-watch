import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Card from "@/components/ui/Card/Card";
import Badge from "@/components/ui/Badge/Badge";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-xl">
        <Card title="Laporkan Gejala">
          <div className="flex flex-col gap-5">
            <Badge variant="success">
              Layanan tersedia
            </Badge>

            <Input
              label="Deskripsi Gejala"
              placeholder="Ceritakan gejala yang dialami..."
              name="symptom"
            />

            <Button variant="primary" fullWidth>
              Kirim Laporan
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
