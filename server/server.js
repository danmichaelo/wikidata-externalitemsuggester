'use strict'

const express = require('express')
const cors = require('cors')
const app = express()
const port = 3000

app.use(cors({
  origin: 'https://www.wikidata.org',
  allowedHeaders: 'x-requested-with',
  credentials: true,
  // optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}))

const providers = {
	P214: require('./providers/P214'),
}

app.get('/search', async (req, res, next) => {
	let property = req.query.property,
		term = req.query.value,
		processor = providers[property]

	if (!processor) {
		// TODO: Throw error
		res.send('Unsupported property')
		return
	}

	try {
		const data = await processor(term)
		res.json(data);
	} catch (e) {
		// TOOD: this will eventually be handled by your error handling middleware
		next(e)
	}
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
