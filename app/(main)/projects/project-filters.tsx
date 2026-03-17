'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { User, X, ChevronDown } from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'
import { useState, useRef, useEffect } from 'react'

interface Employee {
    id: string
    full_name: string
    avatar_url: string | null
}

interface ProjectFiltersProps {
    employees: Employee[]
    currentEmployeeId?: string
}

export default function ProjectFilters({ employees, currentEmployeeId }: ProjectFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectedEmployee = employees.find(e => e.id === currentEmployeeId)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (id: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (id) {
            params.set('employee_id', id)
        } else {
            params.delete('employee_id')
        }
        router.push(`/projects?${params.toString()}`)
        setIsOpen(false)
    }

    return (
        <div className="relative z-[60]" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 ${
                    selectedEmployee 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                    : 'bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-white/10'
                }`}
            >
                {selectedEmployee ? (
                    <>
                        <EmployeeAvatar 
                            avatarUrl={selectedEmployee.avatar_url} 
                            fullName={selectedEmployee.full_name} 
                            className="h-6 w-6 border-white/20"
                        />
                        <span className="text-sm font-black uppercase tracking-wider truncate max-w-[150px]">
                            {selectedEmployee.full_name}
                        </span>
                        <X 
                            className="h-4 w-4 hover:text-white/60 transition-colors" 
                            onClick={(e) => {
                                e.stopPropagation()
                                handleSelect(null)
                            }}
                        />
                    </>
                ) : (
                    <>
                        <div className="p-1 px-2.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                            <User className="h-4 w-4 text-indigo-500" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest">Filtrer par membre</span>
                        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full mt-3 right-0 md:left-0 w-[280px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                        <button
                            onClick={() => handleSelect(null)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all group"
                        >
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 transition-colors">Tous les membres</span>
                            {!selectedEmployee && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </button>
                        
                        <div className="h-px bg-gray-100 dark:bg-white/5 my-2 mx-4" />

                        {employees.map((employee) => (
                            <button
                                key={employee.id}
                                onClick={() => handleSelect(employee.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                    currentEmployeeId === employee.id 
                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400' 
                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 border border-transparent'
                                }`}
                            >
                                <EmployeeAvatar 
                                    avatarUrl={employee.avatar_url} 
                                    fullName={employee.full_name} 
                                    className="h-8 w-8 text-[10px]"
                                />
                                <span className="text-xs font-black uppercase tracking-wider">{employee.full_name}</span>
                                {currentEmployeeId === employee.id && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
