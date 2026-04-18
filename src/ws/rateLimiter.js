// Per-client WebSocket rate limiter
// Tracks messages per client in a time window

export class WebSocketRateLimiter {
	constructor(maxMessages = 60, windowMs = 60000) {
		// maxMessages: How many messages allowed (default: 60)
		// windowMs: Time window in milliseconds (default: 60,000ms = 60 seconds)
		this.maxMessages = maxMessages
		this.windowMs = windowMs

		// Map to store: clientId -> [array of message timestamps]
		this.clientRequests = new Map()
	}

	// Check if a client exceeded the rate limit
	isRateLimited(clientId) {
		const now = Date.now() // Current time in milliseconds

		// Get stored timestamps for this client (empty array if new client)
		const timestamps = this.clientRequests.get(clientId) || []

		// Step 1: Remove old timestamps that are outside the time window
		// If a timestamp is older than windowMs, it doesn't count anymore
		const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs)

		// Step 2: Check if client exceeded limit
		if (validTimestamps.length >= this.maxMessages) {
			// Client has already sent maxMessages in this window
			return true // Rate limited!
		}

		// Step 3: Add current message timestamp
		validTimestamps.push(now)

		// Step 4: Store updated timestamps back in map
		this.clientRequests.set(clientId, validTimestamps)

		// Not rate limited
		return false
	}

	// Remove client from tracking when they disconnect
	// This prevents memory leaks (don't store data for disconnected clients)
	removeClient(clientId) {
		this.clientRequests.delete(clientId)
	}

	// Optional: Get how many messages a client has left
	getRemaining(clientId) {
		const now = Date.now()
		const timestamps = this.clientRequests.get(clientId) || []

		// Only count valid timestamps (within the time window)
		const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs)

		// Calculate remaining
		return this.maxMessages - validTimestamps.length
	}
}
