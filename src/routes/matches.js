import { Router } from 'express'
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches.js'
import { matches } from '../db/schema.js'
import { db } from '../db/db.js'
import { desc } from 'drizzle-orm'
import { getMatchStatus } from '../utils/match-status.js'

export const matchRouter = Router()

const MAX_LIMIT = 100

matchRouter.get('/', async (req, res) => {
	const parsed = listMatchesQuerySchema.safeParse(req.query)
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.issues })
	}

	const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT)

	try {
		const data = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit)

		res.json({ data })
	} catch (e) {
		return res.status(500).json({ error: 'Failed to fetch matches' })
	}
})

matchRouter.post('/', async (req, res) => {
	const parsed = createMatchSchema.safeParse(req.body)

	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
	}

	const {
		data: { startTime, endTime, homeScore, awayScore },
	} = parsed
	/*Equivalent long version:
    const startTime = parsed.data.startTime
    const endTime = parsed.data.endTime
    const homeScore = parsed.data.homeScore
    const awayScore = parsed.data.awayScore
    */

	try {
		const [event] = await db //returns and array containing the inserted match, we destructure it to get the first element directly
			.insert(matches)
			.values({
				...parsed.data,
				startTime: new Date(startTime),
				endTime: new Date(endTime),
				homeScore: homeScore ?? 0,
				awayScore: awayScore ?? 0,
				status: getMatchStatus(startTime, endTime),
			})
			.returning()

		/*Equivalent long version:
            const result = await db.insert(matches).values({...}).returning()
            const event = result[0]  // get the first element
            */

        const broadcastMatchCreated = res.app.locals.broadcastMatchCreated
        if (typeof broadcastMatchCreated === 'function') {
            try {
                broadcastMatchCreated(event)
            } catch (broadcastError) {
                console.error('Failed to broadcast match_created', broadcastError)
            }
        }
        
		res.status(201).json({ message: 'Match created successfully', data: event })
	} catch (e) {
		res.status(500).json({ error: 'Failed to create match', details: parsed.error.issues })
	}
})
