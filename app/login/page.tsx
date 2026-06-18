import "../auth.css";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Log in — $SHORT" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
