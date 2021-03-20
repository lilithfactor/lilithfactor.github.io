//! Loading Animation
const op = setInterval(incNum, 20);
function incNum() {
	const text = document.getElementById('percentage');
	const bar = document.getElementById('bar');
	let a = window.getComputedStyle(bar, ':before').getPropertyValue('width');

	//! for width of bar = 1000px, factor for multiplication if 1/10, for 500px (half), factor is 1/5
	a = Math.floor(parseInt(a) / 10);
	text.innerHTML = a + '%';

	let gradientOrientation = document.getElementById('gradientOrientation');
	let angle = (a * 18) / 5;

	var randomColor1 = Math.floor(Math.random() * 16777216).toString(16);
	var randomColor2 = Math.floor(Math.random() * 16777216).toString(16);

	gradientOrientation.style.backgroundImage =
		'linear-gradient(' +
		angle +
		'deg, #' +
		randomColor1 +
		', #' +
		randomColor2 +
		')';

	//!animation complete
	if (a == 100) {
		clearInterval(op);

		//!unhide Forward Link to Index2.html
		document.getElementById('forward').style.display = 'flex';

		console.log('Loading Complete, You can Move on :)');
	}
}
