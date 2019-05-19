'use strict'

const axios = require('axios')

module.exports = request

async function request (term) {
	console.log('Getting json data')
	const endpoint = 'http://www.viaf.org/viaf/AutoSuggest';

	console.log(`Searching VIAF for ${term}`)

	try {
		const response = await axios.get(endpoint, {
			params: {query: term}
		});
		const data = response.data;
		return data
	} catch (e) {
		console.log(e);

		// TODO: Throw and handle by error middleware instead
		return {'error': 'The endpoint returned an error'}
	}
}