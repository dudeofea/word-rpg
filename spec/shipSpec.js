var ship = require('../ship.js');
var fields = require('../fields.js');
var debug = require('../debug.js');

function fieldsEqual(a, b){
	expect(a.width).toBe(b.width);
	expect(a.height).toBe(b.height);
	expect(a.length).toBe(b.length);
	var good = true;
	for (var y = 0; y < a.height; y++) {
		var off = a.width * y;
		for (var x = 0; x < a.width; x++) {
			expect(a[off + x]).toBe(b[off + x]);
			if(a[off + x] != b[off + x]){
				console.log('Value mismatch @ ('+x+','+y+'): '+a[off + x]+' != '+b[off + x]);
				good = false;
				//color for terminal
				a[off + x] = '\x1b[31m'+a[off + x]+'\x1b[0m';
				b[off + x] = '\x1b[31m'+b[off + x]+'\x1b[0m';
			}
		}
	}
	if(!good){
		debug.print_array_2d(a, a.width);
		debug.print_array_2d(b, b.width);
	}
}

describe("Spaceships", function() {
	describe("item placement", function() {
		it("calculates open spots on empty ship", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				0, 1, 1, 1, 0,
				0, 0, 1, 1, 0,
				0, 0, 0, 0, 0,
			]);
			//test the result
			var res = ship.get_open_spots(myship, {x: 2, y: 1})
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 0, 0,
				0, 1, 1, 0, 0,
				0, 0, 1, 0, 0,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(res, ans);
		});
	});
});
