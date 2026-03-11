import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ChartPoint {
  name: string;
  price: number | null;
  predicted: number | null;
  /** Bottom of the confidence band (for future forecast only). */
  conf_low?: number | null;
  /** Height of the confidence band = conf_high − conf_low (for recharts stacking). */
  conf_band?: number | null;
}

const generateData = () => {
  const data = [];
  let price = 185;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 24; i++) {
    price += (Math.random() - 0.4) * 8;
    data.push({
      name: months[i % 12],
      price: Math.round(price * 100) / 100,
      predicted: Math.round((price + (Math.random() - 0.3) * 12) * 100) / 100,
    });
  }
  return data;
};

interface StockChartProps {
  chartData?: ChartPoint[];
}

const StockChart = ({ chartData }: StockChartProps) => {
  const { t } = useLanguage();
  const [randomData, setRandomData] = useState(generateData);

  useEffect(() => {
    if (chartData) return;
    const interval = setInterval(() => setRandomData(generateData()), 5000);
    return () => clearInterval(interval);
  }, [chartData]);

  const data = chartData ?? randomData;
  const hasConfBand = data.some((d) => d.conf_band != null);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="name"
            stroke="hsl(220, 10%, 30%)"
            tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="hsl(220, 10%, 30%)"
            tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const visible = payload.filter(
                (p) => p.dataKey !== "conf_band" && p.dataKey !== "conf_low"
              );
              if (!visible.length) return null;
              return (
                <div style={{
                  background: "hsl(220, 18%, 7%)",
                  border: "1px solid hsl(220, 15%, 14%)",
                  borderRadius: "8px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "12px",
                  color: "hsl(200, 20%, 90%)",
                  padding: "8px 12px",
                }}>
                  <p style={{ marginBottom: 4, opacity: 0.6 }}>{label}</p>
                  {visible.map((p) => (
                    <p key={String(p.dataKey)} style={{ color: p.color, margin: "2px 0" }}>
                      {p.name} : {p.value}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(175, 80%, 50%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPrice)"
            name={t.common.real_price}
          />
          {/* Confidence band — only rendered when real forecast data is present */}
          {hasConfBand && (
            <>
              <Area
                type="monotone"
                dataKey="conf_low"
                stroke="none"
                fill="transparent"
                fillOpacity={1}
                stackId="conf"
                legendType="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="conf_band"
                stroke="none"
                fill="hsl(160, 70%, 45%)"
                fillOpacity={0.12}
                stackId="conf"
                legendType="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </>
          )}
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="hsl(160, 70%, 45%)"
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorPredicted)"
            name={t.common.ai_forecast}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
