export default function ({
	allow,
	deny,
	defaultAction = 'deny',
	denyCode = 404
}) {
	console.log({ allow, deny, defaultAction, denyCode })
	return (req, res, next) => next(req, res)
}