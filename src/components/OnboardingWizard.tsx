import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3, Zap, Briefcase, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "onboarding_done";

export function useOnboarding() {
  const done = localStorage.getItem(STORAGE_KEY) === "true";
  const dismiss = () => localStorage.setItem(STORAGE_KEY, "true");
  return { done, dismiss };
}

const OnboardingWizard = ({ onDone }: { onDone: () => void }) => {
  const { t } = useLanguage();
  const STEPS = [
    { icon: BarChart3, title: t.onboarding.step1_title, description: t.onboarding.step1_desc, cta: t.onboarding.step1_cta },
    { icon: Zap,       title: t.onboarding.step2_title, description: t.onboarding.step2_desc, cta: t.onboarding.step2_cta, action: "/forecast" },
    { icon: Briefcase, title: t.onboarding.step3_title, description: t.onboarding.step3_desc, cta: t.onboarding.step3_cta, action: "/portfolio" },
  ];
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleCta = () => {
    if (current.action) {
      onDone();
      navigate(current.action);
    } else if (isLast) {
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="glass rounded-2xl p-8 max-w-md w-full relative"
      >
        <button
          onClick={onDone}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-border"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <button
            onClick={onDone}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.onboarding.skip}
          </button>
          <button
            onClick={handleCta}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {isLast && current.action ? (
              <><Check className="h-4 w-4" />{current.cta}</>
            ) : (
              <>{current.cta}<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
