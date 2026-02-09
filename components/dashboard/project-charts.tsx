'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface ProjectChartsProps {
    statusData: Array<{ status: string; count: number; percentage: number }>
}

const STATUS_COLORS: Record<string, string> = {
    'in_progress': '#10b981',
    'pending': '#f59e0b',
    'completed': '#6366f1',
    'on_hold': '#ef4444',
    'cancelled': '#6b7280'
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
                <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                        Nombre: <span className="font-bold text-gray-900">{payload[0].value}</span>
                    </p>
                    {payload[0].payload.percentage && (
                        <p className="text-xs text-gray-500 mt-0.5">
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
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                {payload.map((entry: any, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs font-medium text-gray-600">{entry.value}</span>
                    </div>
                ))}
            </div>
        )
    }

    if (!statusData || statusData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <p className="text-sm">Aucune donnée à afficher</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-4 text-center">Répartition des projets</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) => `${entry.percentage}%`}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend content={<CustomLegend />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-4 text-center">Nombre de projets par statut</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                        <Bar
                            dataKey="count"
                            radius={[8, 8, 0, 0]}
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {barData.map((entry, index) => (
                                <Cell key={`bar-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
