'use strict'

const axios = require('axios')
const _ = require('lodash')

module.exports = request

async function request (term) {
	const endpoint = 'http://www.viaf.org/viaf/AutoSuggest'

	console.log('search:viaf')
	try {
		const t0 = Date.now()
		const response = await axios.get(endpoint, {
			params: {query: term}
		});
		const dt = Date.now() - t0
		const results = response.data.result.map(result => ({
			id: result.recordID,
			label: result.displayForm,
			description: `Type: ${result.nametype}`,
		}))
		return {results: results, response_time: dt}
	} catch (e) {
		console.log(e);

		// TODO: Throw and handle by error middleware instead
		return {'error': 'The endpoint returned an error'}
	}
}
