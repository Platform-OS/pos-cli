/*
	an interface to call graphql queries against the instance
*/



// purpose:		run a graphql query
// arguments:	body of the query (string)
// returns:		data returned from the database (object)
// ------------------------------------------------------------------------
const graphql = (body) => {
	return fetch('http://localhost:3333/api/graph', {
		headers: { 'Content-Type': 'application/json' },
		method: 'POST',
		body: JSON.stringify(body),
	})
	.then((res) => res.json())
	.then((res) => {
		if(res.errors) {
			res.errors.forEach(error => {
				console.log(body.query);
				console.info(error);
			});
			return res;
		}

		return res && res.data;
	});
};


const graphqlnew = (body) => {
	return fetch('http://localhost:3333/api/graph', {
		headers: { 'Content-Type': 'application/json' },
		method: 'POST',
		body: JSON.stringify(body),
		mode: 'no-cors'
	})
	.then((res) => res.text())
	.then((res) => {
		if(res.errors) {
			res.errors.forEach(error => {
				console.log(body.query);
				console.info(error);
			});
			return res;
		}

		return res && res.data;
	});
};



// exports
// ------------------------------------------------------------------------
export { graphql, graphqlnew }
