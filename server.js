require('dotenv').config();
const axios = require('axios');
const express = require('express');
const app = express();
const cors = require('cors');
const dayjs = require('dayjs');
const cookieParser = require('cookie-parser');
const { Magic } = require('@magic-sdk/admin');

const { ecdsaRecover, compareAddress } = require('./utils/ecdsaRecover');

const magic = new Magic(process.env.MAGIC_SECRET_KEY);

const port = 3001;

app.use(cors({ credentials: true, origin: process.env.ORIGIN_URL }));
app.use(cookieParser(process.env.COOKIE_SIGNER));
app.use(express.json());

app.post('/api/login', async (req, res) => {
	try {
		const didToken = req.headers.authorization.substr(7);
		await magic.token.validate(didToken);
		res.status(200).json({ authenticated: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/verifySignature', async (req, res) => {
	try {
		const { signature, address } = req.body;

		if (!signature) {
			res.cookie('signature', "", {
				signed: false,
				secure: false,
				httpOnly: true,
				expires: dayjs().add(30, 'days').toDate(),
			});

			res.json({ 'status': false });
		}
		else {
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
		}
	} catch (error) {
		res.status(500).json({ 'status': false, error: 'internal_server', error_description: error.message || '' });
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

				res.cookie('github_oauth_token_unsigned', auth.data.access_token, {
					signed: false,
					secure: false,
					httpOnly: true,
					expires: dayjs().add(30, 'days').toDate(),
				});

				res.cookie('github_oauth_token', auth.data.access_token, {
					signed: true,
					secure: false,
					httpOnly: true,
					expires: dayjs().add(30, 'days').toDate(),
				});

				res.json(auth.data);
			} catch (e) {
				console.log(e);
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
	console.log('oauthToken in checkAuth', oauthToken);

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
		res.clearCookie('github_oauth_token_unsigned');
		return res.status(200).json({ isAuthenticated: false, avatarUrl: null });
	} else {
		// Token present but expired -> isAuthenticated: true, login: user login
		return res.status(200).json({ isAuthenticated: true, avatarUrl: data.avatar_url, login: data.login, githubId: data.node_id });
	}
});

app.get('/logout', async (req, res) => {
	res.clearCookie('github_oauth_token');
	res.clearCookie('github_oauth_token_unsigned');
	return res.status(200).json({ isAuthenticated: false });
});

app.get('/hasSignature', async (req, res) => {
	const signature = req.cookies.signature;
	const { address } = req.query;



	if (signature === undefined || signature === "") {
		return res.status(200).json({ 'status': false, 'error': 'unauthorized' });
	}

	const addressRecovered = await ecdsaRecover(signature, 'OpenQ');

	const adminAddresses = process.env.ADMIN_ADDRESSES.split(",");

	if (compareAddress(addressRecovered, address)) {
		return res.status(200).json({ 'status': true, addressRecovered, admin: adminAddresses.includes(addressRecovered) });
	}
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
