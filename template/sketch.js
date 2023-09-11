/**
 * @type {Sprite}
 */
let play;
/**
 * @type {Sprite}
 */
let ball;
function setup() {
  new Canvas(500,200)
  world.gravity.y = 10;

	play = new Sprite(250, 100, [40, 72, 40, -72, 40, 72, 5], 'k');
  play.rotationSpeed = 1
	new Sprite(251, 50, 20);
}

function draw() {
  clear()
  background(240)
}
