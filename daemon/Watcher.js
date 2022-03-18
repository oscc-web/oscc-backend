import dbInit from '../utils/mongo.js'

export default function createWatcher(collectionName = 'log') {
	const collection = dbInit(`${collectionName}/R`)[collectionName]
	
}