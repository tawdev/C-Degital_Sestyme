'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { motion } from 'framer-motion'

interface ProjectChartsProps {
    statusData: Array<{ status: string; count: number; percentage: number }>
}

const STATUS_COLORS: Record<string, string> = {
    'in_progress': '#10b981', // emerald-500
    'pending': '#f59e0b',    // amber-500
    'completed': '#6366f1',  // indigo-500
    'on_hold': '#ef4444',    // red-500
    'cancelled': '#6b7280'   // gray-500
}

const STATUS_LABELS: Record<string, string> = {
    'in_progress': 'En cours',
    'pending': 'En attente',
    'completed': 'Terminé',
    'on_hold': 'En pause',
    'cancelled': 'Annulé'
}

export default function ProjectCharts({ statusData }: ProjectChartsProps) {
    const pieData = statusData.map(item => ({
        name: STATUS_LABELS[item.status] || item.status,
        value: item.count,
        percentage: item.percentage,
        color: STATUS_COLORS[item.status] || '#6b7280'
    }))

    const barData = statusData.map(item => ({
        name: STATUS_LABELS[item.status] || item.status,
        count: item.count,
        fill: STATUS_COLORS[item.status] || '#6b7280'
    }))

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1a1625]/80 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl border border-white/10 ring-1 ring-black/5">
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{payload[0].name}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-2xl font-black text-white">{payload[0].value}</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Unités</span>
                    </div>
                    {payload[0].payload.percentage && (
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                            {payload[0].payload.percentage}% du total
                        </p>
                    )}
                </div>
            )
        }
        return null
    }

    const CustomLegend = ({ payload }: any) => {
        return (
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
                {payload.map((entry: any, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center gap-2 group cursor-default">
                        <div
                            className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)] group-hover:scale-125 transition-transform"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        )
    }

    if (!statusData || statusData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 bg-white/5 rounded-3xl border border-white/10">
                <p className="text-xs font-black uppercase tracking-widest">Aucune donnée opérationnelle</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {/* Pie Chart */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 backdrop-blur-sm rounded-[2rem] p-8 border border-white/10 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-8 text-center italic">Distribution Relative</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend content={<CustomLegend />} />
                    </PieChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Bar Chart */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 backdrop-blur-sm rounded-[2rem] p-8 border border-white/10 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-8 text-center italic">Volume Quantitatif</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 'bold' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 'bold' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 10 }} />
                        <Bar
                            dataKey="count"
                            radius={[6, 6, 0, 0]}
                            barSize={30}
                        >
                            {barData.map((entry, index) => (
                                <Cell key={`bar-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>
        </div>
    )
}
