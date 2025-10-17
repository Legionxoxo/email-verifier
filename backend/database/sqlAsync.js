const { Database } = require('sqlite3');
const sqldb = require('./connect_sql');

/**
 * Creates async versions of SQL commands
 */
class SQLAsync {
	constructor() {}

	/** async run command
	 * @param {string} query - SQL query
	 * @param {any[]} [params] - SQL params
	 * @returns {Promise<Database>}
	 */
	runAsync(query, params) {
		return new Promise((res, rej) => {
			sqldb.run(query, params, (/** @type {any} */ err, /** @type {any} */ row) => {
				if (err) rej(err);
				else res(row);
			});
		});
	}

	/** async all command
	 * @param {string} query - SQL query
	 * @param {any[]} [params] - SQL params
	 * @returns {Promise<Database>}
	 */
	allAsync(query, params) {
		return new Promise((res, rej) => {
			sqldb.all(query, params, (/** @type {any} */ err, /** @type {any} */ row) => {
				if (err) rej(err);
				else res(row);
			});
		});
	}

	/** async get command
	 * @param {string} query - SQL query
	 * @param {any[]} [params] - SQL params
	 * @returns {Promise<Database>}
	 */
	getAsync(query, params) {
		return new Promise((res, rej) => {
			sqldb.get(query, params, (/** @type {any} */ err, /** @type {any} */ row) => {
				if (err) rej(err);
				else res(row);
			});
		});
	}
}

const sqlAsync = new SQLAsync();

module.exports = sqlAsync;
