import express from 'express'
import { setFunctionName } from 'utils/wrapAsync.js'
import conditional from './conditional.js'
/**
 * Create a named virtual host
 * @param {String} hostName 
 * @param  {...import('express').Handler} servers 
 * @returns 
 */
export default function vhost(hostName, ...servers) {
	if (!hostName) throw new Error('vhost hostName is missing')
	let match = hostName instanceof RegExp
		? (str) => !!str.match(hostName)?.length
		: (str) => str.toLowerCase() === hostName.toLowerCase()
	return conditional(setFunctionName(req => {
		// Request has no hostName specified: pass through
		if (!req.headers.host) return false
		// Parse hostname from request header (ignore port numbers)
		let hostName = req.headers.host.split(':')[0]
		// Return if this request's host matches the regexp
		return match(hostName)
	}, `vhost[${hostName.toString()}]`), ...servers)
}
