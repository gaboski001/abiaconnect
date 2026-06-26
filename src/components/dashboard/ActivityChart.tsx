import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function ActivityChart({
  data,
}: {
  data: Array<{ label: string; posts: number }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145 60% 35%)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="hsl(45 90% 55%)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="posts"
          stroke="hsl(145 60% 35%)"
          fill="url(#dashFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
