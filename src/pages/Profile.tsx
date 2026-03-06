import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Shield, ArrowRight, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";

const Profile = () => {
  usePageTitle("Perfil");
  const { user } = useAuth();

  const [name, setName] = useState(user?.user_metadata?.full_name ?? "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);
    setNameLoading(true);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    if (error) {
      setNameError(error.message);
    } else {
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    }
    setNameLoading(false);
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setPwLoading(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    }
    setPwLoading(false);
  };

  const isGoogleUser = user?.app_metadata?.provider === "google";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-4">
            <User className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">Conta</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">O Meu <span className="text-primary">Perfil</span></h1>
          <p className="text-muted-foreground mt-1">Gere as informações da tua conta.</p>
        </motion.div>

        <div className="space-y-6">
          {/* Info da conta */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Informações da conta</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm text-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3">
                <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="font-mono text-sm text-foreground">Free</p>
                </div>
              </div>
              {isGoogleUser && (
                <div className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3">
                  <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Método de login</p>
                    <p className="font-mono text-sm text-foreground">Google</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Editar nome */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Nome de exibição</h2>
            </div>
            <form onSubmit={handleNameSave} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="O teu nome"
                  className="w-full rounded-lg bg-secondary border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              {nameError && <p className="text-sm text-destructive font-mono">{nameError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={nameLoading}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {nameLoading ? "A guardar…" : "Guardar nome"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {nameSuccess && (
                  <div className="flex items-center gap-1.5 text-sm text-chart-up">
                    <CheckCircle className="h-4 w-4" />
                    Guardado!
                  </div>
                )}
              </div>
            </form>
          </motion.div>

          {/* Alterar senha */}
          {!isGoogleUser && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <Lock className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">Alterar senha</h2>
              </div>
              <form onSubmit={handlePasswordSave} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha"
                    required
                    minLength={6}
                    className="w-full rounded-lg bg-secondary border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPwError(null); }}
                    placeholder="Confirmar nova senha"
                    required
                    className="w-full rounded-lg bg-secondary border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                {pwError && <p className="text-sm text-destructive font-mono">{pwError}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {pwLoading ? "A guardar…" : "Alterar senha"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {pwSuccess && (
                    <div className="flex items-center gap-1.5 text-sm text-chart-up">
                      <CheckCircle className="h-4 w-4" />
                      Senha alterada!
                    </div>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
