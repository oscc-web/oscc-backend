import { strDistance } from 'utils/string.js'
import Test from './Test.js'
let results = []
const length = 100000
function randomStr(){
	return Math.random().toString(36)
}
// New Test('calculate times of a set of data of strDistance')
// 	.run(async () => {
for (let i = 0; i < length; i++){
	let str0 = randomStr(),
		str1 = randomStr(),
		before = (new Date).getTime()
	strDistance(str0, str1)
	let after = (new Date).getTime()
	results.push(after - before)
}
// })
// new Test('analyze results')
// 	.run(async () => {
let sum = 0
for (let i = 0; i < results.length;i++) sum += results[i]
let average = sum / results.length
console.log(`length: ${length}`)
console.log(`average: ${average}`)
let variance = 0
for (let i = 0; i < results.length;i++) {
	variance += Math.pow(results[i] - average, 2)
}
variance /= results.length
console.log(`variance: ${variance}`)
console.log(`standard deviation: ${Math.pow(variance, 0.5)}`)
// })
