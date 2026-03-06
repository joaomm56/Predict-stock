import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";

const ForgotPassword = () => {
  usePageTitle("Recuperar Senha");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center gradient-mesh px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Apex<span className="text-primary">Predict</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Envia-mos um link para redefinir a tua senha
          </p>
        </div>

        <div className="glass rounded-2xl p-8 box-glow">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-foreground font-medium">Email enviado!</p>
              <p className="text-sm text-muted-foreground">
                Verifica a tua caixa de entrada em <span className="text-primary">{email}</span> e clica no link para redefinir a senha.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg bg-secondary border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive font-mono">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? "A enviar…" : "Enviar link de recuperação"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar ao login
                </Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
