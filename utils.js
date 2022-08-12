const ethers = require('ethers');

function ecdsaRecover(signature, address) {
	let message = 'OpenQ'
	const recoveredAddress = ethers.utils.verifyMessage(message, signature);
	return true;
}

module.exports = ecdsaRecover