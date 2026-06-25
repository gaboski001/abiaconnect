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
  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8A951" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#8A7A3A" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="#707070" />
        <XAxis
          dataKey="label"
          fontSize={10}
          tick={{ fill: '#B0B0B0' }}
          axisLine={{ stroke: '#2A2A2A' }}
          tickLine={{ stroke: '#2A2A2A' }}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          fontSize={10}
          tick={{ fill: '#B0B0B0' }}
          axisLine={{ stroke: '#2A2A2A' }}
          tickLine={{ stroke: '#2A2A2A' }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#2A2A2A', color: '#FFFFFF' }}
          itemStyle={{ color: '#C8A951' }}
        />
        <Area
          type="monotone"
          dataKey="posts"
          stroke="#C8A951"
          fill="url(#dashFill)"
          strokeWidth={2}
          animationDuration={1500}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
