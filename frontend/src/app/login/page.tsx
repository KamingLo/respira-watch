import LoginForm from "@/features/auth/components/LoginForm/LoginForm";
import BottomNavigation from "@/components/layout/BottomNavigation/BottomNavigation";
import Navbar from "@/components/layout/Navbar/Navbar";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <LoginForm />
      <BottomNavigation />
    </>
  );
}
