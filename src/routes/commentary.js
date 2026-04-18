import { Router } from 'express'
import { matchIdParamSchema } from '../validation/matches.js'
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js'
import { db } from '../db/db.js'
import { commentary } from '../db/schema.js'
import { desc, eq } from 'drizzle-orm'

const MAX_LIMIT = 100

export const commentaryRouter = Router({ mergeParams: true })

commentaryRouter.get('/', async (req, res) => {
	const paramsResult = matchIdParamSchema.safeParse(req.params)
	if (!paramsResult.success) {
		return res.status(400).json({ error: 'Invalid match ID parameter', details: paramsResult.error.issues })
	}

	const queryResult = listCommentaryQuerySchema.safeParse(req.query)
	if (!queryResult.success) {
		return res.status(400).json({ error: 'Invalid query parameters', details: queryResult.error.issues })
	}

	try {
		const { id: matchId } = paramsResult.data
		const { limit = 10 } = queryResult.data

		const safeLimit = Math.min(limit, MAX_LIMIT) // Set a maximum limit to prevent abuse

		const results = await db
			.select()
			.from(commentary)
			.where(eq(commentary.matchId, matchId))
			.orderBy(desc(commentary.createdAt))
			.limit(safeLimit)

		return res.status(200).json({ data: results })
	} catch (error) {
		console.error('Failed to fetch commentary', error)
		return res.status(500).json({ error: 'Failed to fetch commentary' })
	}
})

commentaryRouter.post('/', async (req, res) => {
	const paramsResult = matchIdParamSchema.safeParse(req.params)

	if (!paramsResult.success) {
		return res.status(400).json({ error: 'Invalid match ID parameter', details: paramsResult.error.issues })
	}

	const bodyResult = createCommentarySchema.safeParse(req.body)

	if (!bodyResult.success) {
		return res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues })
	}

	try {
		const { minute, ...rest } = bodyResult.data
		const [result] = await db
			.insert(commentary)
			.values({
				matchId: paramsResult.data.id,
				minute,
				...rest,
			})
			.returning()

			if(req.app.locals.broadcastCommentary){
				req.app.locals.broadcastCommentary(result.matchId, result)
			}

		return res.status(201).json({ data: result })
	} catch (e) {
		console.error('Failed to create commentary', e)
		return res.status(500).json({ error: 'Failed to create commentary' })
	}
})
