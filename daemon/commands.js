/**
 * @enum {String}
 */
const commands = Object.freeze({
	// Server control
	/**
	 * Start the server, exits if there is already a server running
	 */
	start: 'Start the server, exits if there is already a server running',
	/**
	 * Restart the server, kills all existing servers
	 */
	restart: 'Restart the server, kills all existing servers',
	/**
	 * Stop any running server process
	 */
	stop: 'Stop any running server process',
	// Utility
	/**
	 * Install commands and check the existence of config.js[on]
	 */
	install: 'Install commands and check the existence of config.js[on]',
	/**
	 * Connect to ysyx REPL with bunch of handful tools
	 */
	connect: 'Connect to ysyx REPL with bunch of handful tools',
	/**
	 * Watch new logs from mongodb log collection
	 */
	watch: 'Watch new logs from mongodb log collection',
})
export default commands