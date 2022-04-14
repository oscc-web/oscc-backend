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

export function strDistance(a, b) {
	if (a.length == 0) return b.length
	if (b.length == 0) return a.length
	var matrix = []
	// Increment along the first column of each row
	var i
	for (i = 0; i <= b.length; i++) {
		matrix[i] = [i]
	}
	// Increment each column in the first row
	var j
	for (j = 0; j <= a.length; j++) {
		matrix[0][j] = j
	}
	// Fill in the rest of the matrix
	for (i = 1; i <= b.length; i++) {
		for (j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) == a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1]
			} else {
				matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // Substitution
					Math.min(matrix[i][j - 1] + 1, // Insertion
						matrix[i - 1][j] + 1)) // Deletion
			}
		}
	}
	return matrix[b.length][a.length]
}
