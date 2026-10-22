"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BudgetChart({ data }: { data: { name: string; budget: number; estimated: number }[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center border border-dashed border-line px-6 text-center text-[12px] text-ink-mute">
        Add an event with a trained cost model to see the budget comparison.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#e3dccd" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#6d6a60", fontSize: 10 }}
            axisLine={{ stroke: "#d9d2c4" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#6d6a60", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: "rgba(23,23,21,0.04)" }}
            contentStyle={{
              background: "#17191b",
              border: "1px solid #33362f",
              borderRadius: 0,
              color: "#f7f4ed",
              fontSize: 11,
            }}
            formatter={(value, name) => [
              typeof value === "number"
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
                : "—",
              name === "budget" ? "Budget" : "ML estimate",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6d6a60" }}
            iconType="square"
            iconSize={8}
          />
          <Bar dataKey="budget" name="Budget" fill="#171715" radius={0} maxBarSize={26} />
          <Bar dataKey="estimated" name="ML estimate" fill="#C8B58A" radius={0} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
