//
//	ITEMS
//
//	Functions having to do with generating items.
//	Involves both the stats and the ui
//
var elem = require('./elem.js');
var global_vars = require('./globals.js');
var convert = require('color-convert');

//linearly interpolate between two values with a 0-1 normalized value
function lerp(start, end, value){
	return start + (end - start)*value;
}

module.exports = {
	//	Generates an item based on string hash
	//
	//	possible item types are:
	//
	//	- fuel cell, shield, solar panel, ion beam, overdrive,
	//	underdrive, shifter, reflector
	//
	gen_item: function(name, level){
		var hash = Sha256.hash(name);
		var generators = [this.gen_battery, this.gen_shield, this.gen_weapon];
		//get item type
		var i = parseInt(hash.normalize(16, 4)*generators.length);
		//console.log(i);
		var item = generators[i](hash, level);
		item.name = name;
		//TODO: add a health stat to items
		return item;
	},
	//generate a weapon with a given hash
	gen_weapon: function(hash, level){
		var item = {hash: hash, type: 'weapon', name_suffix: 'cannon'};
		//keep the multipliers/values in case we need them
		item.damage_mul = 30 * level;
		item.damage_val = hash.normalize(0, 4);
		item.damage = parseInt(item.damage_val * item.damage_mul);
		item.accuracy_mul = 100 * level;
		item.accuracy_val = hash.normalize(4, 4);
		item.accuracy = parseInt(item.accuracy_val * item.accuracy_mul);
		//reliability is proportional to the inverse of damage and proportional to accuracy
		var rel = 0;	//TODO: this
		//draw up a weapon (basic rect style)
		var canvas = elem('canvas', "rpg-canvas");
		canvas.width = global_vars.item_canvas.w;
		canvas.height = global_vars.item_canvas.h;
		item.elem = canvas;
		var ctx = canvas.getContext('2d');
		//pick a number of stripes
		var stripes = 1 + parseInt(Math.ceil(3*hash.normalize(33, 5)))
		//pick some colors
		var a = 60*(hash.normalize(13, 4) - 0.2);
		var b = 60*(hash.normalize(19, 4) - 0.5);
		var colors = [];
		for (var i = 0; i < stripes; i++) {
			colors.push('#' + convert.lab.hex(50-8*i, a, b));
		}
		//TODO: correlate barrel width with accuracy
		//TODO: add a reload stat (how much energy is needed before next shot is fired)
		//define size
		var w = parseInt(25 + 20*hash.normalize(45, 6));
		var h = parseInt(15 + 10*hash.normalize(22, 6));
		var barrel_w = parseInt(8 + 15*hash.normalize(60, 4));
		var top_left = {x: parseInt((canvas.width-w-barrel_w)/2), y: parseInt((canvas.height-h)/2)};
		//add outline
		ctx.fillStyle = '#' + convert.lab.hex(80, a, b);
		ctx.fillRect(top_left.x-2, top_left.y-2, w+4, h+4);
		//draw main body
		ctx.fillStyle = colors[0];
		ctx.fillRect(top_left.x, top_left.y, w, h);
		//draw exhaust panels (or stripes)
		for (var i = stripes; i > 0; i--) {
			ctx.fillStyle = colors[i-1];
			ctx.fillRect(top_left.x+5*(stripes-i), top_left.y, 5, h);
		}
		//draw gun barrel
		var barrel_color = '#' + convert.lab.hex(3, a, 10);
		ctx.fillStyle = '#' + convert.lab.hex(80, a, b);
		ctx.fillRect(top_left.x+w-4, parseInt(top_left.y+h/2-6), barrel_w, 13);
		ctx.fillStyle = '#' + convert.lab.hex(20, a, b);
		ctx.fillRect(top_left.x+w+barrel_w-7, parseInt(top_left.y+h/2-5), 4, 11);
		//be a gun
		item.run = function(){
			//TODO: add modifiers
			//TODO: be a gun
			//energy consumption related to damage
			return parseInt(this.damage/10);
		}
		return item;
	},
	//generate a shield with a given hash
	gen_shield: function(hash, level){
		var item = {hash: hash, type: 'shield', name_suffix: 'shield'};
		//keep the multipliers/values in case we need them
		item.max_shield_mul = 1000 * level;
		item.max_shield_val = hash.normalize(0, 4);
		item.max_shield = parseInt(item.max_shield_val * item.max_shield_mul);
		item.charge_rate_mul = 500 * level;
		item.charge_rate_val = hash.normalize(4, 4);
		item.charge_rate = parseInt(item.charge_rate_val * item.charge_rate_mul);
		//reliability is proportional to the inverse of charge_rate and max shield
		var rel = 0;	//TODO: this
		//draw up a shield (radial style 1)
		var canvas = elem('canvas', "rpg-canvas");
		canvas.width = global_vars.item_canvas.w;
		canvas.height = global_vars.item_canvas.h;
		item.elem = canvas;
		var ctx = canvas.getContext('2d');
		//pick some colors
		var a = 60*(hash.normalize(54, 4) - 0.5);
		var b = 60*(hash.normalize(2, 4) - 0.5);
		var color1 = '#' + convert.lab.hex(40, a, b);
		var color2 = '#' + convert.lab.hex(30, a, b);
		//make a ring
		var thick = 20*hash.normalize(7, 4);
		rpg.draw.ring(ctx, canvas.width/2, canvas.height/2, 10, 10+thick, color1);
		//TODO: correlate struts with charge speed
		//TODO: correlate ring size with shield radius
		//add a certain number of struts
		var certain_num = 2 + parseInt(Math.ceil(7*hash.normalize(12, 8)));
		for (var i = 0; i < certain_num; i++) {
			var ang = 2*(i/certain_num)*Math.PI
			var x = (10+thick/2)*Math.sin(ang);
			var y = -(10+thick/2)*Math.cos(ang);
			rpg.draw.rounded_rect_rot(ctx,
				canvas.width/2+x, canvas.height/2+y, 5, 10, 2, ang, color2);
		}
		//be a shield
		item.run = function(ship){
			//TODO: add modifiers
			//TODO: be a shield
			//TODO: add a weighted version of the shield to the ship's grid
			for (var i = 0; i < ship.grid.defense.length; i++) {
				ship.grid.defense[i] += 5;
			}
			//energy consumption related to charge rate
			return parseInt(this.charge_rate/100);
		};
		return item;
	},
	//generate a battery with a given hash
	gen_battery: function(hash, level){
		var item = {hash: hash, type: 'battery', name_suffix: 'cell'};
		//keep the multipliers/values in case we need them
		item.max_energy_mul = 100 * level;
		item.max_energy_val = hash.normalize(0, 4);
		item.max_energy = parseInt(item.max_energy_val * item.max_energy_mul);
		item.throughput_mul = 50 * level;
		item.throughput_val = hash.normalize(4, 4);
		item.throughput = parseInt(item.throughput_val * item.throughput_mul);
		//reliability is proportional to the inverse of throughput
		var rel = 0;	//TODO: this
		//draw up a battery (style 1)
		var canvas = elem('canvas', "rpg-canvas");
		canvas.width = global_vars.item_canvas.w;
		canvas.height = global_vars.item_canvas.h;
		item.elem = canvas;
		var ctx = canvas.getContext('2d');
		//pick between 1 - 5 partitions
		var part_num = parseInt(Math.ceil(hash.normalize(10, 8) * 5));
		//console.log('partitions: ', part_num);
		//get height of partitions (margins / dividers are fixed)
		var part_h = (canvas.width - 2 * 10 - (part_num - 1) * 5)/part_num;
		//console.log('width: ', part_h);
		//pick a radius (up to 50% of height, and at least 3px)
		var radius = hash.normalize(30, 4) * part_h / 2 + 3;
		//pick a width (at least same as height+5 or up to canvas.width-2*10)
		if(part_h < canvas.width - 20){
			var part_w = lerp(part_h+5, canvas.width - 40, hash.normalize(14, 6));
		}else{
			var part_w = lerp(20, canvas.width - 40, hash.normalize(14, 6));
		}
		//pick some colors
		var a = 60*(hash.normalize(11, 4) - 0.5);
		var b = 60*(hash.normalize(44, 4) - 0.5);
		var color1_hsl = convert.lab.hsl(40, a, b);
		color1_hsl[1] /= 6;
		color1_hsl[2] += 15;
		var color1 = '#'+convert.hsl.hex(color1_hsl);
		var color2 = '#'+convert.lab.hex(2, a, b);
		//draw the partitions
		for (var i = 0; i < part_num - 1; i++) {
			rpg.draw.rounded_rect(ctx, (canvas.width - part_w + 8)/2, i*(part_h+5)+18, part_w - 8, part_h + 4, 0, color2);
		}
		//draw the partitions
		for (var i = 0; i < part_num; i++) {
			rpg.draw.rounded_rect(ctx, (canvas.width - part_w)/2, i*(part_h+5)+10, part_w, part_h, radius, color1);
		}
		//consumes no energy
		//TODO: add energy to energy pool when battery is run
		item.run = function(){ return 0; }
		return item;
	},
	//Make the ui (thumbnail portion) of an item
	make_ui: function(item){
		var wrapper = elem('div', "item-thumb "+item.type);
		//name of item
		var title = elem('p', "title", item.name + ' ' + item.name_suffix);
		//show 1-2 lines of description, depending on item type
		var desc = elem('div', "description");
		switch (item.type) {
			case 'battery':
				var p1 = elem('p', "fa-bolt", item.max_energy);
				var p2 = elem('p', "fa-tachometer", item.throughput);
				break;
			case 'shield':
				var p1 = elem('p', "fa-shield", item.max_shield);
				var p2 = elem('p', "fa-exchange", item.charge_rate);
				break;
			case 'weapon':
				var p1 = elem('p', "fa-certificate", item.damage);
				var p2 = elem('p', "fa-crosshairs", item.accuracy);
				break;
		}
		//TODO: add health bar to item ui
		//add everything
		desc.appendChild(p1);
		desc.appendChild(elem('br'));
		desc.appendChild(p2);
		wrapper.appendChild(item.elem);
		wrapper.appendChild(title);
		wrapper.appendChild(desc);
		return wrapper;
	}
};
