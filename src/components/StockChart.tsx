import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface ChartPoint {
  name: string;
  price: number | null;
  predicted: number | null;
}

const generateData = () => {
  const data = [];
  let price = 185;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
  const [randomData, setRandomData] = useState(generateData);

  useEffect(() => {
    if (chartData) return;
    const interval = setInterval(() => setRandomData(generateData()), 5000);
    return () => clearInterval(interval);
  }, [chartData]);

  const data = chartData ?? randomData;

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
            contentStyle={{
              background: "hsl(220, 18%, 7%)",
              border: "1px solid hsl(220, 15%, 14%)",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono",
              fontSize: "12px",
              color: "hsl(200, 20%, 90%)",
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(175, 80%, 50%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPrice)"
            name="Preço Real"
          />
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="hsl(160, 70%, 45%)"
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorPredicted)"
            name="Previsão IA"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
