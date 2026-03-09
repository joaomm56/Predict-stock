import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PredictionCardProps {
  symbol: string;
  name: string;
  price: string | null;
  change: number | null;
  delay?: number;
  loading?: boolean;
}

const PredictionCard = ({ symbol, name, price, change, delay = 0, loading = false }: PredictionCardProps) => {
  const isUp = (change ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="glass rounded-xl p-5 hover:box-glow transition-shadow duration-500 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{symbol}</span>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{name}</p>
        </div>
        {loading ? (
          <div className="h-6 w-16 rounded-md bg-secondary animate-pulse" />
        ) : (
          <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium ${isUp ? "bg-chart-up/10 text-chart-up" : "bg-chart-down/10 text-chart-down"}`}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change != null ? `${isUp ? "+" : ""}${change.toFixed(2)}%` : "—"}
          </div>
        )}
      </div>

      <div className="mb-4">
        {loading ? (
          <div className="h-8 w-28 rounded bg-secondary animate-pulse" />
        ) : (
          <span className="font-mono text-2xl font-bold text-foreground">
            {price != null ? `$${price}` : "—"}
          </span>
        )}
      </div>

      <div className="border-t border-border pt-3 mt-auto">
        <Link
          to={`/forecast?ticker=${symbol}`}
          className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-primary transition-colors group"
        >
          <span>Gerar Previsão com IA</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
};

export default PredictionCard;
