export default {
	// If true, use an epsilon value to compare floating point number equality, rather than pure JS
	// equality. This prevents false inequalities due to floating point precision error.

	'Safe Float Equality': true,

	// Which version of FontAwesome is in use? This adjusts some icons.

	'FontAwesome Version': 4,     // 4 | 6

	// Are we using FontAwesome as CSS+Webfont or as JS+SVG? In the latter, elements we create will
	// get replaced with SVG versions, so our code has to adapt to locate the new elements.

	'FontAwesome Method': 'font', // font | svg
};
