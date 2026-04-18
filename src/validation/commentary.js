import { z } from 'zod'

export const listCommentaryQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).optional(),
})

export const createCommentarySchema = z.object({
	minute: z.coerce.number().int().nonnegative(),
	sequence: z.coerce.number().int().positive(),
	period: z.string().min(1),
	eventType: z.string().min(1),
	actor: z.string().optional(),
	team: z.string().optional(),
	message: z.string().min(1),
	metadata: z.record(z.string(), z.any()).optional(),
	tags: z.array(z.string()).optional(),
})
