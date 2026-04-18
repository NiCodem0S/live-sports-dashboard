import { z } from 'zod'

// Define the allowed message types
export const ALLOWED_MESSAGE_TYPES = {
	PING: 'ping',
	SUBSCRIBE: 'subscribe',
	UNSUBSCRIBE: 'unsubscribe',
}

// Zod schema to validate incoming WebSocket messages
export const wsMessageSchema = z.object({
	type: z.enum([ALLOWED_MESSAGE_TYPES.PING, ALLOWED_MESSAGE_TYPES.SUBSCRIBE, ALLOWED_MESSAGE_TYPES.UNSUBSCRIBE]),
	data: z.any().optional(), // Optional data field
})

// Function to validate a message
export function validateWSMessage(messageString) {
	try {
		// Step 1: Parse the JSON
		const parsed = JSON.parse(messageString)

		// Step 2: Validate against schema
		const result = wsMessageSchema.safeParse(parsed)
		return result
	} catch (error) {
		return {
			success: false,
			error: {
				issues: [{ message: 'Invalid JSON format' }],
			},
		}
	}
}
