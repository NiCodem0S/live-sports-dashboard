import express from 'express'
import { matchRouter } from './routes/matches.js'

const app = express()
const PORT = 8080

app.use(express.json())

app.get('/', (req, res) => {
	res.json({ message: 'Live Sports Dashboard server is running.' })
})
app.use('/matches', matchRouter)

app.listen(PORT, () => {
	console.log(`Server started at http://localhost:${PORT}`)
})
