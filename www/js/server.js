'use strict'

const path = require('path')
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000

app.use(cors({
  origin: 'https://www.wikidata.org',
  allowedHeaders: 'x-requested-with',
  credentials: true,
  // optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}))

const providers = {
	P214: require('./providers/P214'),
}

const router = express.Router();

router.get('/', (req, res, next) => {
    res.sendFile(path.resolve('index.html'));
})

router.get('/search', async (req, res, next) => {
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

// Mount router to a base URL
app.use('/externalitemsuggester', router)

app.use((req, res, next) => {
  res.status(404).send("Sorry, can't find that!")
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
