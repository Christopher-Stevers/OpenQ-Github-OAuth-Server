const axios = require('axios');
const express = require('express');
const app = express();
const cors = require('cors');
const dayjs = require('dayjs');
const cookieParser = require('cookie-parser');
const ecdsaRecover = require('./utils')

const { ecdsaRecover, compareAddress } = require('./utils/ecdsaRecover');

require('dotenv').config();

const port = 3001;

app.use(cors({ credentials: true, origin: process.env.ORIGIN_URL }));
app.use(cookieParser(process.env.COOKIE_SIGNER));
app.use(express.json());

app.get('/verifySignature', async (req, res) => {
	const { signedMessage, address } = req.query;

	if (ecdsaRecover(signedMessage, address)) {
		
		res.cookie('signedMessage', signedMessage, {
			signed: false,
			secure: false,
			httpOnly: true,
			expires: dayjs().add(30, 'days').toDate(),
		});
	
		res.json({'valid_signature': true});
	} else {
		res.json({'valid_signature': false});
	}
});

app.get('/', async (req, res) => {
	const app = req.query.app;
	const code = req.query.code;
	if (app && code) {
		const client_id = process.env[app.toUpperCase() + '_ID'];
		const client_secret = process.env[app.toUpperCase() + '_SECRET'];
		if (client_id && client_secret) {
			try {
				const auth = await axios.post('https://github.com/login/oauth/access_token', {
					client_id,
					client_secret,
					code
				}, {
					headers: {
						Accept: 'application/json'
					}
				});

				res.cookie('github_oauth_token', auth.data.access_token, {
					signed: true,
					secure: false,
					httpOnly: true,
					expires: dayjs().add(30, 'days').toDate(),
				});

				res.json(auth.data);
			} catch (e) {
				res.status(e.response.status).json({ error: 'internal_error', error_description: e.message });
			}
		} else {
			res.status(400).json({ error: 'bad_request', error_description: `App ${app} is not configured. Requires client_id and client_secret` });
		}
	} else {
		res.status(400).json({ error: 'bad_request', error_description: 'No app or code provided.' });
	}
});

app.get('/checkAuth', async (req, res) => {
	const oauthToken = req.signedCookies.github_oauth_token;

	if (typeof oauthToken == 'undefined') {
		// No token at all -> isAuthenticated: false
		return res.status(200).json({ isAuthenticated: false, avatarUrl: null });
	}

	let status, data;
	try {
		let response = await axios.get('https://api.github.com/user', {
			headers: {
				'Authorization': `token ${oauthToken}`
			}
		});

		status = response.status;
		data = response.data;
	} catch (error) {
		console.error(error);
	}


	if (status != 200) {
		// Token present, but expired
		// Clear the cookie, return isAuthenticated: false
		res.clearCookie('github_oauth_token');
		return res.status(200).json({ isAuthenticated: false, avatarUrl: null });
	} else {
		// Token present but expired -> isAuthenticated: true, login: user login
		return res.status(200).json({ isAuthenticated: true, avatarUrl: data.avatar_url });
	}
});

app.get('/logout', async (req, res) => {
	res.clearCookie('github_oauth_token');
	return res.status(200).json({ isAuthenticated: false });
});

app.get('/hasSignature', async (req, res) => {
	const signature = req.cookies.signature;
	const { address } = req.query;

	if (signature === undefined) {
		return res.status(200).json({ 'status': false, 'error': 'unauthorized' });
	}

	const addressRecovered = await ecdsaRecover(signature, 'OpenQ');
	if (compareAddress(addressRecovered, address)) {
		return res.status(200).json({ 'status': true });
	} else {
		return res.status(200).json({ 'status': false, 'error': 'unauthorized' });
	}
});

app.post('/verifySignature', async (req, res) => {
	try {
		const { signature, address } = req.body;
		const addressRecovered = await ecdsaRecover(signature, 'OpenQ');
		if (compareAddress(addressRecovered, address)) {
			res.cookie('signature', signature, {
				signed: false,
				secure: false,
				httpOnly: true,
				expires: dayjs().add(30, 'days').toDate(),
			});
			res.json({ 'status': true });
		} else {
			res.status(401).json({ 'status': false, 'error': 'unauthorized' });
		}
	} catch (error) {
		res.status(500).json({ 'status': false, error: 'internal_server', error_description: error.message || '' });
	}
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
