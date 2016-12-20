var ship = require('../ship.js');
var global_vars = require('../globals.js')

describe("Spaceships module", function() {
	describe("Ship item placement", function() {
		it("calcs open spots on empty ship", function() {
			var myship = ship.gen_ship("heyo");
			var v_grid = global_vars.grid_canvas;
			myship.layout = fields.composite(v_grid);			//boolean grid of what tiles are inside/outside the ship
			var main_rect = gen_rect(21, 10, {x: v_grid.w/2, y: v_grid.h/2});
			myship.layout.addField(fields.rectangle(main_rect, 1));
			ship.get_open_spots(myship, {x: 2, y: 3})
		});
	});
});
