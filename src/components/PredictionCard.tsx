import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";

interface PredictionCardProps {
  symbol: string;
  name: string;
  price: string;
  change: string;
  prediction: string;
  confidence: number;
  isUp: boolean;
  delay?: number;
}

const PredictionCard = ({ symbol, name, price, change, prediction, confidence, isUp, delay = 0 }: PredictionCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="glass rounded-xl p-5 hover:box-glow transition-shadow duration-500"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{symbol}</span>
          <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
        </div>
        <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono font-medium ${isUp ? "bg-chart-up/10 text-chart-up" : "bg-chart-down/10 text-chart-down"}`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change}
        </div>
      </div>

      <div className="mb-4">
        <span className="font-mono text-2xl font-bold text-foreground">${price}</span>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Previsão IA (7 dias)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-sm font-semibold ${isUp ? "text-chart-up" : "text-chart-down"}`}>
            ${prediction}
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{confidence}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PredictionCard;
