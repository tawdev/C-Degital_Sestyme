import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditEmployeeForm from './edit-form'

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('id', params.id)
        .single()

    if (!employee) {
        notFound()
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Employee</h1>
            <EditEmployeeForm employee={employee} />
        </div>
    )
}
