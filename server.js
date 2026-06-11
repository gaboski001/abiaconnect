import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
app.use(express.static(dist))
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => console.log(`Running on port ${port}`))
