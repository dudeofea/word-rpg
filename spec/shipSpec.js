var ship = require('../ship.js');
var fields = require('../fields.js');
var debug = require('../debug.js');
var item = require('../item.js');

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

describe("Spaceship", function() {
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
			var res = myship.get_open_spots({w: 2, h: 1})
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 0, 0,
				0, 1, 1, 0, 0,
				0, 0, 1, 0, 0,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(res, ans);
		});
		it("adds an item to ship layout", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			//test the result
			var myitem = item.gen_item('test', 1);
			myitem.size = {w: 2, h: 1};
			myship.add_item(myitem, {x: 0, y: 2});
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				2, 2, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(myship.layout, ans);
		});
		it("calculates open spots with an exisiting item", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				1, 1, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			//add the item
			var myitem = item.gen_item('test', 1);
			myitem.size = {w: 2, h: 1};
			myship.add_item(myitem, {x: 0, y: 3});
			//test the result
			var res = myship.get_open_spots({w: 2, h: 2});
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 0, 0,
				0, 0, 1, 0, 0,
				0, 0, 0, 0, 0,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(res, ans);
		});
		it("adds 3 items to ship layout", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			//test the result
			var myitem = item.gen_item('test', 1);
			myitem.size = {w: 2, h: 1};
			myship.add_item(myitem, {x: 1, y: 1});
			myship.add_item(myitem, {x: 0, y: 2});
			myship.add_item(myitem, {x: 2, y: 3});
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 2, 2, 1, 0,
				3, 3, 1, 1, 0,
				0, 0, 4, 4, 1,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(myship.layout, ans);
		});
		it("moves an item on ship layout", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			//test the result
			var myitem = item.gen_item('test', 1);
			myitem.size = {w: 2, h: 1};
			var id = myship.add_item(myitem, {x: 2, y: 3});
			myship.move_item(id, {x: 0, y: 2});
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				2, 2, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(myship.layout, ans);
		});
		it("deletes an item from ship layout", function() {
			//create a default ship
			var myship = ship.create_ship();
			//create a custom ship layout (using fields) by hand
			//in some weird shape, then test the open spots
			myship.layout = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			//test the result
			var myitem = item.gen_item('test', 1);
			myitem.size = {w: 2, h: 1};
			var id = myship.add_item(myitem, {x: 2, y: 3});
			myship.delete_item(id);
			var ans = fields.static({w: 5, h: 5}, [
				0, 0, 0, 0, 0,
				0, 1, 1, 1, 0,
				1, 1, 1, 1, 0,
				0, 0, 1, 1, 1,
				0, 0, 0, 0, 0,
			]);
			fieldsEqual(myship.layout, ans);
		});
	});
});
