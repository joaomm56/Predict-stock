import { motion } from "framer-motion";
import { Brain, BarChart3, Shield, Cpu, ArrowRight, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { getStockInfo } from "@/lib/api";
import heroBg from "@/assets/hero-bg.jpg";
import { usePageTitle } from "@/hooks/usePageTitle";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import PredictionCard from "@/components/PredictionCard";
import FeatureCard from "@/components/FeatureCard";

const FEATURED = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com" },
];

interface StockCard {
  symbol: string;
  name: string;
  price: string | null;
  change: number | null;
  loading: boolean;
}

const Index = () => {
  usePageTitle();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const features = [
    { icon: Brain,    title: t.index.features.f1t, description: t.index.features.f1d },
    { icon: BarChart3,title: t.index.features.f2t, description: t.index.features.f2d },
    { icon: Shield,   title: t.index.features.f3t, description: t.index.features.f3d },
    { icon: Cpu,      title: t.index.features.f4t, description: t.index.features.f4d },
  ];

  const stats = [
    { value: t.index.stats.s1v, label: t.index.stats.s1l },
    { value: t.index.stats.s2v, label: t.index.stats.s2l },
    { value: t.index.stats.s3v, label: t.index.stats.s3l },
    { value: t.index.stats.s4v, label: t.index.stats.s4l },
  ];

  const [cards, setCards] = useState<StockCard[]>(
    FEATURED.map((s) => ({ ...s, price: null, change: null, loading: true }))
  );

  useEffect(() => {
    const CACHE_KEY = "index_cards_cache";
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setCards(data);
          return;
        }
      } catch { /* ignore */ }
    }

    Promise.all(
      FEATURED.map(async ({ symbol, name }) => {
        try {
          const info = await getStockInfo(symbol);
          return { symbol, name: info.name ?? name, price: info.price.toFixed(2), change: info.change, loading: false };
        } catch {
          return { symbol, name, price: null, change: null, loading: false };
        }
      })
    ).then((results) => {
      setCards(results);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: results, ts: Date.now() }));
    });
  }, []);

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
                <span className="font-mono text-xs text-primary">{t.index.badge}</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-foreground">
                {t.index.hero_title1}{" "}
                <span className="text-primary text-glow">{t.index.hero_title2}</span>
                <br />{t.index.hero_title3}
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                {t.index.hero_desc}
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate(user ? "/forecast" : "/register")}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t.index.cta_explore}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/pricing")}
                  className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  {t.index.cta_pricing}
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
                <span className="font-mono text-xs text-chart-up">{t.index.chart_active}</span>
              </div>
              <StockChart />
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{t.index.chart_real}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent border border-dashed border-accent" />
                  <span className="text-xs text-muted-foreground">{t.index.chart_pred}</span>
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
              {t.index.section_pred_title} <span className="text-primary">{t.index.section_pred_hl}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t.index.section_pred_desc}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c, i) => (
              <PredictionCard key={c.symbol} {...c} delay={i * 0.1} />
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
              {t.index.section_feat_title} <span className="text-primary">{t.index.section_feat_hl}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t.index.section_feat_desc}
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
              {t.index.cta_section_title} <span className="text-primary text-glow">{t.index.cta_section_hl}</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              {t.index.cta_section_desc}
            </p>
            <Link to="/register" className="flex items-center gap-2 mx-auto w-fit rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              {t.index.cta_register}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>}

      {/* SEO Content */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {t.index.seo_what_title} <span className="text-primary">{t.index.seo_what_hl}</span>?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.index.seo_what_body}
            </p>

            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {t.index.seo_how_title} <span className="text-primary">{t.index.seo_how_hl}</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.index.seo_how_body1}</p>
            <p className="text-muted-foreground leading-relaxed mb-8">{t.index.seo_how_body2}</p>

            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
              {t.index.seo_faq_title} <span className="text-primary">{t.index.seo_faq_hl}</span>
            </h2>

            <div className="space-y-6">
              {t.index.seo_faq.map(({ q, a }) => (
                <div key={q} className="border border-border rounded-lg p-5">
                  <h3 className="font-semibold text-foreground mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">Apex<span className="text-primary">Predict</span></span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.index.footer_copy}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
