import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Zap, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { createCheckoutSession, verifyCheckout } from "@/lib/api";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "€0",
    period: "para sempre",
    description: "Para quem quer experimentar",
    highlight: false,
    badge: null,
    features: [
      { label: "5 previsões por dia", included: true },
      { label: "Acesso ao mercado", included: true },
      { label: "Portfólio básico (3 ações)", included: true },
      { label: "Dados históricos (30 dias)", included: true },
      { label: "Métricas avançadas (R², MAE)", included: false },
      { label: "Previsões ilimitadas", included: false },
      { label: "Análise técnica completa", included: false },
      { label: "Exportação de dados", included: false },
    ],
    cta: "Começar grátis",
    ctaVariant: "outline",
  },
  {
    key: "pro",
    name: "Pro",
    price: "€9.99",
    period: "/ mês",
    description: "Para investidores ativos",
    highlight: true,
    badge: "Mais popular",
    features: [
      { label: "Previsões ilimitadas", included: true },
      { label: "Acesso ao mercado", included: true },
      { label: "Portfólio ilimitado", included: true },
      { label: "Dados históricos (2 anos)", included: true },
      { label: "Métricas avançadas (R², MAE)", included: true },
      { label: "Análise técnica completa", included: true },
      { label: "Exportação de dados (CSV)", included: false },
      { label: "Suporte prioritário", included: false },
    ],
    cta: "Começar Pro",
    ctaVariant: "primary",
  },
  {
    key: "premium",
    name: "Premium",
    price: "€24.99",
    period: "/ mês",
    description: "Para profissionais",
    highlight: false,
    badge: null,
    features: [
      { label: "Previsões ilimitadas", included: true },
      { label: "Acesso ao mercado", included: true },
      { label: "Portfólio ilimitado", included: true },
      { label: "Dados históricos (10 anos)", included: true },
      { label: "Métricas avançadas (R², MAE)", included: true },
      { label: "Análise técnica completa", included: true },
      { label: "Exportação de dados (CSV/PDF)", included: true },
      { label: "Suporte prioritário", included: true },
    ],
    cta: "Começar Premium",
    ctaVariant: "outline",
  },
];

const Pricing = () => {
  usePageTitle("Preços");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPlan: string = user?.user_metadata?.plan ?? "free";
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<"success" | "error">("success");

  // Handle Stripe redirect back
  useEffect(() => {
    const success = searchParams.get("success");
    const cancelled = searchParams.get("cancelled");
    const sessionId = searchParams.get("session_id");

    if (cancelled) {
      setBannerType("error");
      setBannerMsg("Pagamento cancelado. Podes tentar novamente quando quiseres.");
      setSearchParams({}, { replace: true });
      return;
    }

    if (success && sessionId && user) {
      setBannerMsg("A verificar pagamento…");
      setBannerType("success");
      verifyCheckout(sessionId)
        .then(async ({ plan }) => {
          await supabase.auth.updateUser({ data: { plan } });
          setSuccessPlan(plan);
          setBannerMsg(`Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)} ativado com sucesso!`);
          setBannerType("success");
        })
        .catch(() => {
          setBannerType("error");
          setBannerMsg("Não foi possível verificar o pagamento. Contacta o suporte.");
        })
        .finally(() => {
          setSearchParams({}, { replace: true });
        });
    }
  }, [user]);

  const handleSelect = async (planKey: string) => {
    if (!user) {
      navigate("/register");
      return;
    }
    if (planKey === currentPlan || planKey === successPlan) return;

    // Downgrade to free: update directly
    if (planKey === "free") {
      setLoadingPlan("free");
      await supabase.auth.updateUser({ data: { plan: "free" } });
      setLoadingPlan(null);
      setSuccessPlan("free");
      setBannerType("success");
      setBannerMsg("Passou para o plano Free.");
      return;
    }

    // Paid plan: redirect to Stripe
    setLoadingPlan(planKey);
    try {
      const { url } = await createCheckoutSession(planKey, user.id);
      window.location.href = url;
    } catch {
      setLoadingPlan(null);
      setBannerType("error");
      setBannerMsg("Erro ao iniciar pagamento. Tenta novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Planos simples e <span className="text-primary text-glow">honestos</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Sem cobranças escondidas. Comece grátis hoje mesmo.
          </p>
        </motion.div>

        {bannerMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-xl mx-auto mb-8 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium ${
              bannerType === "success"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {bannerType === "success" ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 flex-shrink-0" />
            )}
            {bannerMsg}
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan, i) => {
            const activePlan = successPlan ?? currentPlan;
            const isCurrent = user && plan.key === activePlan;
            const isLoading = loadingPlan === plan.key;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative rounded-2xl p-8 flex flex-col gap-6 ${
                  plan.highlight
                    ? "glass box-glow border border-primary/40 mt-0 md:-mt-4"
                    : "glass"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground whitespace-nowrap">
                      <Zap className="h-3 w-3" />
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {plan.name}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Plano atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground mb-1">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="flex flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-3">
                      {f.included ? (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          f.included ? "text-foreground" : "text-muted-foreground/40"
                        }`}
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.key)}
                  disabled={!!isCurrent || !!isLoading || plan.key === "free"}
                  className={`mt-auto flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-default ${
                    isCurrent
                      ? "border border-primary/30 text-primary"
                      : plan.ctaVariant === "primary"
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A redirecionar…
                    </>
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : (
                    plan.cta
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Pagamento seguro via Stripe. Cancela a qualquer momento.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
