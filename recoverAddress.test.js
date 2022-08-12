const ecdsaRecover = require('./utils')
const ethers = require('ethers');

describe('Verify signature', () => {
	it('Verify signature', () => {
		expect(ecdsaRecover('OpenQ', '0xdf448d548305c70c8d5fb08d1c5a0cb3adfa6668eafa7a154b2c1eecf10c80ea1cc3afe23cc89f74323b02db7322b78c17add446c70ccbbb7a6ecfe58ac8b4bd1b')).toEqual(true);
	});
});