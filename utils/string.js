export const ml = (segments, ...args) => segments
	.map((str, i) => str + (args[i]?.toString() || ''))
	.join('')
	.trim()
	.split('\n')
	.map(str => str.replace(/^\s*\|\s*/, ''))
	.join('\n')

export const sl = (segments, ...args) => segments
	.map((str, i) => str + (args[i]?.toString() || ''))
	.join('')
	.trim()
	.split('\n')
	.map(str => str.replace(/^\s*\|\s*/, ''))
	.join(' ')
/**
 * Compute the distance of two strings
 * @param {*} a string to be compared
 * @param {*} b string to be compared
 * @param {{
 * 	normalize: number,
 * 	REPLACE: number,
 * 	INSERT: number,
 * 	DELETE: number,
 * 	CASE: number,
 * }} parameters
 * all operations are considered to be posed on string 'b'
 * @returns
 */
export function strDistance(a, b, { normalize = 0, ...costs } = {}) {
	if (a.length == 0 || b.length == 0) return normalize
		? Math.min(normalize, (a || b).length)
		: (a || b).length
	// Initialize dp matrix
	const
		{ REPLACE = 1, INSERT = 1, DELETE = 1, CASE = 1 } = costs,
		matrix = [
			new Array(b.length + 1)
				.fill(0)
				.map((_, j) => j && j * DELETE),
			...new Array(a.length)
				.fill(null)
				// Initialize first row and first col with row/col number
				.map((_, i) => [
					i + 1,
					...new Array(b.length).fill(Infinity)
				])
		];
	// Dynamic programming computation
	[...a].forEach((charA, _i) => {
		[...b].forEach((charB, _j) => {
			// Offset i, j
			const [i, j] = [_i + 1, _j + 1]
			// Get current optimal solution, update editing distance
			matrix[i][j] = charB === charA
				? matrix[i - 1][j - 1]
				: Math.min(
					// Change case
					charA.toLowerCase() === charB.toLowerCase()
						? matrix[i - 1][j - 1] + CASE
						: Infinity,
					// Replacement
					matrix[i - 1][j - 1] + REPLACE,
					// Deletion from 'b'
					matrix[i][j - 1] + DELETE,
					// Insertion into 'b'
					matrix[i - 1][j] + INSERT
				)
		})
	})
	return normalize
		? Math.min(normalize, matrix[a.length][b.length])
		: matrix[a.length][b.length]
}
