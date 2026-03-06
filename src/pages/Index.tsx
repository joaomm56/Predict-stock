import { motion } from "framer-motion";
import { Brain, BarChart3, Shield, Cpu, ArrowRight, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import heroBg from "@/assets/hero-bg.jpg";
import { usePageTitle } from "@/hooks/usePageTitle";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import PredictionCard from "@/components/PredictionCard";
import FeatureCard from "@/components/FeatureCard";

const predictions = [
  { symbol: "AAPL", name: "Apple Inc.", price: "198.45", change: "+2.34%", prediction: "205.80", confidence: 87, isUp: true },
  { symbol: "TSLA", name: "Tesla Inc.", price: "241.12", change: "-1.08%", prediction: "228.50", confidence: 72, isUp: false },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: "875.30", change: "+4.12%", prediction: "920.00", confidence: 91, isUp: true },
  { symbol: "AMZN", name: "Amazon.com", price: "185.60", change: "+1.56%", prediction: "192.40", confidence: 83, isUp: true },
];

const features = [
  { icon: Brain, title: "IA Preditiva Avançada", description: "Modelos de deep learning treinados com bilhões de pontos de dados para previsões de alta precisão." },
  { icon: BarChart3, title: "Análise em Tempo Real", description: "Dados de mercado atualizados em tempo real com análise técnica e fundamental integrada." },
  { icon: Shield, title: "Gestão de Risco", description: "Avaliação automatizada de risco com recomendações de stop-loss e take-profit." },
  { icon: Cpu, title: "Backtesting Robusto", description: "Teste suas estratégias com dados históricos de mais de 20 anos de mercado." },
];

const stats = [
  { value: "94.2%", label: "Precisão Média" },
  { value: "2.4M+", label: "Previsões Feitas" },
  { value: "150+", label: "Mercados Cobertos" },
  { value: "12K+", label: "Investidores Ativos" },
];

const Index = () => {
  usePageTitle();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="container relative mx-auto px-6 pt-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-6">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs text-primary">Alimentado por IA</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-foreground">
                Preveja o{" "}
                <span className="text-primary text-glow">Futuro</span>
                <br />do Mercado
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                Algoritmos de inteligência artificial analisam padrões complexos para prever 
                movimentos do mercado com precisão sem precedentes.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate(user ? "/forecast" : "/register")}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Explorar Previsões
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/pricing")}
                  className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  Ver Planos
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="font-mono text-sm text-primary font-medium">AAPL</span>
                  <span className="ml-2 text-xs text-muted-foreground">Apple Inc.</span>
                </div>
                <span className="font-mono text-xs text-chart-up">Previsão Ativa</span>
              </div>
              <StockChart />
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Preço Real</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent border border-dashed border-accent" />
                  <span className="text-xs text-muted-foreground">Previsão IA</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-mono text-3xl font-bold text-primary text-glow mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Predictions */}
      <section className="py-20 gradient-mesh">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Previsões em <span className="text-primary">Destaque</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Acompanhe as previsões mais recentes geradas pelos nossos modelos de IA.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {predictions.map((p, i) => (
              <PredictionCard key={p.symbol} {...p} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tecnologia de <span className="text-primary">Ponta</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ferramentas poderosas para tomar decisões de investimento mais inteligentes.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-12 text-center box-glow"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Comece a Prever <span className="text-primary text-glow">Agora</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Junte-se a milhares de investidores que já usam IA para maximizar seus retornos.
            </p>
            <Link to="/register" className="flex items-center gap-2 mx-auto w-fit rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              Criar Conta Gratuita
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>}

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">Apex<span className="text-primary">Predict</span></span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 ApexPredict. Previsões não constituem aconselhamento financeiro.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
