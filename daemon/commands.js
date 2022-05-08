const commands = Object.freeze({
	// Server control
	/**
	 * Start the server, exits if there is already a server running
	 */
	start: 'Start the server. Fails if there is already a running server instance.',
	/**
	 * Restart the server, kills all existing servers
	 */
	restart: 'Restart the server, killing all existing servers.',
	/**
	 * Stop any running server process
	 */
	stop: 'Stop any running server process.',
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
	watch: 'Watch new logs from mongodb log collection'
})
export default commands

export const cliCommands = {
	start: commands.start,
	restart: commands.restart,
	stop: commands.stop,
	/**
	 * Watch new logs from mongodb log collection
	 */
	stat: [
		'Create statistics report for given filter',
		'Usage: .stat [flags] <RegExp> [flags]',
		'Available flags:',
		'i - Regexp case insensitive match',
		'e - Specify a collection-entry pair to match',
		'    e.g. "-e user._id"',
		'o - Output to file, must provide a valid path following the flag',
		'    e.g. "-o date/stat.csv"',
	],
}
