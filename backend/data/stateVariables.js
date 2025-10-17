const { v4: uuidv4 } = require('uuid');
const { SERVER_ID } = require('./env');
const fs = require('fs');
const path = require('path');

const uuid = uuidv4(); // unique id of the server to check if the server restarted

const mxDomainEmDomainMapFile = fs.readFileSync(path.join(process.cwd(), 'data/mxDomainEmDomainMap.json'), 'utf-8'),
	mxDomainEmDomainMap = JSON.parse(mxDomainEmDomainMapFile),
	em_domain = mxDomainEmDomainMap[SERVER_ID] || '';

const stateVariables = {
	uuid, // When the uuid changes, will tell the controller that the code has been restarted
	mx_domain: SERVER_ID || '',
	em_domain: mxDomainEmDomainMap[SERVER_ID] || '',
	ping_freq: 10,
	thread_num: 4,
};

module.exports = stateVariables;
