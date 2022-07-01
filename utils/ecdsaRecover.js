const ethers = require('ethers');

const ecdsaRecover = async (signature, message) => {
	const addressRecovered = await ethers.utils.verifyMessage(message, signature);
	return addressRecovered;
};

const compareAddress = (addr1, addr2) => {
	return addr1.toLowerCase() === addr2.toLowerCase();
};

module.exports = {
	compareAddress,
	ecdsaRecover
};
