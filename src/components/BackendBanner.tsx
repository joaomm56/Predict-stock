import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ServerCrash, X } from "lucide-react";
import { getHealth } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

type Status = "checking" | "slow" | "ok" | "error";

const BackendBanner = () => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("checking");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const timeout = setTimeout(() => setStatus("slow"), 3000);

    getHealth()
      .then(() => {
        clearTimeout(timeout);
        setStatus("ok");
      })
      .catch(() => {
        clearTimeout(timeout);
        setStatus("error");
      });

    return () => clearTimeout(timeout);
  }, []);

  const visible = !dismissed && (status === "slow" || status === "error");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium ${
            status === "error"
              ? "bg-destructive/90 text-destructive-foreground"
              : "bg-yellow-500/90 text-yellow-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {status === "slow" ? (
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            ) : (
              <ServerCrash className="h-4 w-4 flex-shrink-0" />
            )}
            {status === "slow" ? t.backend.slow : t.backend.error}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackendBanner;
