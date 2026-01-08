'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function uploadAvatar(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) {
        return { error: 'No file provided' }
    }

    // Use admin client to ensure we can create buckets and upload files
    const adminClient = createAdminClient()
    const bucketName = 'avatars'

    // 1. Check if bucket exists, if not create it
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets()
    if (listError) {
        console.error('Error listing buckets:', listError)
        return { error: `Storage error: ${listError.message}` }
    }

    const bucketExists = buckets.find(b => b.name === bucketName)
    if (!bucketExists) {
        console.log(`Bucket ${bucketName} not found, creating...`)
        const { error: createError } = await adminClient.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/*'],
            fileSizeLimit: 5242880 // 5MB
        })

        if (createError) {
            console.error('Error creating bucket:', createError)
            return { error: `Failed to create storage bucket: ${createError.message}` }
        }
    }

    // 2. Upload file
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await adminClient.storage
        .from(bucketName)
        .upload(filePath, file)

    if (uploadError) {
        console.error('Upload error:', uploadError)
        return { error: uploadError.message }
    }

    // 3. Get public URL
    const { data: { publicUrl } } = adminClient.storage
        .from(bucketName)
        .getPublicUrl(filePath)

    return { publicUrl }
}
