const { v4: uuidv4 } = require('uuid');

const uuid = uuidv4(); // unique id of the server to check if the server restarted

// Standalone configuration (no cluster/SERVER_ID needed)
const stateVariables = {
	uuid, // When the uuid changes, will tell the controller that the code has been restarted
	ping_freq: 10,
	thread_num: 4,
	mx_domain: process.env.MX_DOMAIN || '',
	em_domain: process.env.EM_DOMAIN || '',
};

module.exports = stateVariables;
