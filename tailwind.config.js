/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				jakarta: ['"Plus Jakarta Sans"', 'sans-serif']
			}
		}
	},
	plugins: []
};
