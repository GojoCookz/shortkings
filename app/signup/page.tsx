import "../auth.css";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign up — $SHORT" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
