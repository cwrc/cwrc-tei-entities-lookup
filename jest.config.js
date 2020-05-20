module.exports = {
	collectCoverage: true,
	collectCoverageFrom: ['./src/index.js'],
	coverageDirectory: './coverage',
	coverageThreshold: {
		global: {
			branches: 65,
			functions: 65,
			lines: 95,
			statements: 85,
		},
	},
	testMatch: ['**/test/**/*.[jt]s?(x)'],
};
