'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const AssetSchema = z.object({
  name: z.string().min(1, { error: 'Name is required.' }).trim(),
  value: z.coerce.number({ error: 'Value must be a number.' }),
  type: z.enum(['property', 'vehicle', 'investment', 'cash', 'other']),
})

export type AssetState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
} | undefined

export async function createAsset(state: AssetState, formData: FormData): Promise<AssetState> {
  const session = await requireAuth()
  const result = AssetSchema.safeParse({
    name: formData.get('name'),
    value: formData.get('value'),
    type: formData.get('type'),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors as Record<string, string[]> }

  await db.manualAsset.create({ data: { userId: session.userId, ...result.data } })
  revalidatePath('/accounts')
  revalidatePath('/insights')
  return { success: true }
}

export async function deleteAsset(assetId: string): Promise<void> {
  const session = await requireAuth()
  const asset = await db.manualAsset.findFirst({ where: { id: assetId, userId: session.userId } })
  if (!asset) return
  await db.manualAsset.delete({ where: { id: assetId } })
  revalidatePath('/accounts')
  revalidatePath('/insights')
}
