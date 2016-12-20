var ship = require('../ship.js');
var global_vars = require('../globals.js')

describe("Spaceships module", function() {
	describe("item placement", function() {
		it("calcs open spots on empty ship", function() {
			var myship = ship.create_ship({}, []);
			ship.get_open_spots(myship, {x: 2, y: 3})
		});
	});
});
