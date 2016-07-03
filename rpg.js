var domready = require("domready");
var convert = require('color-convert');

//use the body as our main game window
domready(function(){ init_rpg(); });

//Ideas for game mechanics:
//
//	- items: addons to the ship, can be broken/damaged, typically consume energy
//	- solar panels: to recharge energy, is an optional item
//	- shields: use energy every turn to shield damage
//	- atomizing: scrap an item, or a piece of the ship for energy
//	- attack surface: a grid used to show/calculate damage taken/inflicted from
//	  one ship to another
//	- gaining XP also trickles down into your other ships when returning to
//	  your ship hangar (probably just a fixed amount)
//

//Lore:
//
//	- ships can "level up" after gaining a certain amount of XP because the
//	  atomizer/de-atomizer is controlled by the ships onboard computer
//	  which uses a quantum FPGA to run an recursive neural net to figure out
//	  the best possible ship confiuguration by leveling-up every epoch.
//	- this system is central to every ship and is called the god core
//	- ships are made by creating a god core, and setting it's initial parameters
//	  with an input string (the name of the ship)
//	- it takes more XP every time as the neural net learns less and less new
//	  information over time so it takes longer
//	- the god core can also optionally be powered off (it takes a decent amount
//	  of energy)
//	- the god core is somewhat power hungry as the fitness simulations it
//	  runs are fairly complex and specific to it's reality. it can optionally
//	  be underclocked/turned off to get an THRP boost, however this will affect
//	  XP gains. The opposite is true as well, an overclock will boost XP gains
//	  at the cost of THRP
//	- when returning to the hangar, you sync your ships together and the
//	  other ships get a stats boost from incorporting your ship's experiences
//	  into their god core
//

var global_vars = {
	ship_canvas: {w: 200, h: 200},
	grid_canvas: {w: 25, h: 25},
	item_canvas: {w: 50, h: 50}
}

//get a 0 - 1 range from a series of hex characters
String.prototype.normalize = function(start, length){
	var val = this.substring(start, start+length);
	//console.log(val);
	var max = Math.pow(2, length*4) - 1;
	return parseInt(val, 16)/max;
}

//normalize a set of stats in object
function normalize_stats(obj, stats){
	var avg = 0;
	//get average
	for (var i = 0; i < stats.length; i++) {
		avg += obj[stats[i]];
	}
	avg /= stats.length;
	//normalize
	for (var i = 0; i < stats.length; i++) {
		obj[stats[i]] /= avg;
	}
}

//generate a gaussian distribution over a grid, returns the grid
function gaussian(strength, radius, template){
	var w = template.elem.width;
	var h = template.elem.height;
	var w2 = w/2, h2 = h/2;
	var arr = Array.apply(null, Array(w*h)).map(Number.prototype.valueOf, 0);
	var rho2 = radius*radius;
	var const1 = strength*255;
	var const2 = -1/(2*radius*radius);
	for (var y = 0; y < h; y++) {
		var off = y*w;
		for (var x = 0; x < w; x++) {
			var posx = x - w2;
			var posy = y - h2;
			arr[off+x] = const1*Math.exp(const2*(posx*posx + posy*posy));
		}
	}
	return arr;
}

rpg = {};
rpg.ship = {};

//makes a ui for player / enemy
rpg.ship.make_ui = function(ship, cla){
	//to hold everything
	var wrapper = document.createElement('div');
	wrapper.className = cla + " ship-ui";
	//the actual ship
	var ship_elem = document.createElement('div');
	ship_elem.className = "ship";
	ship_elem.appendChild(ship.elem);
	//the ui portion
	var ui_elem = document.createElement('div');
	ui_elem.className = "ui";
	//the ship name
	var ship_name = document.createElement('p');
	ship_name.className = "ship-name";
	ship_name.innerHTML = ship.name;
	//the attack grid/matrix
	ship.grid = rpg.ship.make_grid();
	//health / energy bars
	ship.health_bar = rpg.ship.make_bar(ship.hp_max, 'health', 'heart');
	//calc max energy
	ship.max_energy = 0;
	var cells = ship.items_by_type('battery');
	for (var i = 0; i < cells.length; i++) {
		ship.max_energy += cells[i].max_energy;
	}
	ship.energy_bar = rpg.ship.make_bar(ship.max_energy, 'energy', 'bolt');
	//adding everything
	ui_elem.appendChild(ship_name);
	ui_elem.appendChild(ship.grid.elem);
	ui_elem.appendChild(ship.health_bar.elem);
	ui_elem.appendChild(ship.energy_bar.elem);
	wrapper.appendChild(ship_elem);
	wrapper.appendChild(ui_elem);
	return wrapper;
}

// --- make the attack / defend grids
rpg.ship.make_grid = function(){
	var grid = {};
	var canvas = document.createElement('canvas');
	canvas.className = "rpg-canvas";
	canvas.width = global_vars.grid_canvas.w;
	canvas.height = global_vars.grid_canvas.h;
	grid.ctx = canvas.getContext('2d');
	grid.defense = Array.apply(null, Array(canvas.width*canvas.height)).map(Number.prototype.valueOf, 0);
	grid.framebuffer = grid.ctx.createImageData(canvas.width, canvas.height);
	//colorize
	var data = grid.framebuffer.data;
	for (var i = 0; i < data.length; i += 4) {
		data[i]	  = 255;
		data[i+1] = 255;
		data[i+2] = 255;
		data[i+3] = 0;
	}
	//when damage is inflicted
	grid.damage = function(dmg, x, y, callback){
		this.defense[y*this.elem.width+x] -= dmg;
		this.refresh();
		//TODO: make extra canvas layer and fade with CSS transition
	}
	//when refreshing value
	grid.refresh = function(){
		var data = this.framebuffer.data;
		for (var i = 0; i < this.defense.length; i++) {
			data[i*4+3] = this.defense[i];
		}
		this.ctx.putImageData(this.framebuffer, 0, 0);
	}
	canvas.onmousedown = function(e){
		var grid_x = Math.floor(e.target.width*e.layerX/e.target.clientWidth);
		var grid_y = Math.floor(e.target.height*e.layerY/e.target.clientHeight);
		grid.damage(15, grid_x, grid_y);
	}
	grid.elem = canvas;
	return grid;
};

// --- make a colored bar
rpg.ship.make_bar = function(max, cla, icon_class){
	var bar = {max: max, val: max};
	//wrapper
	var elem = document.createElement('div');
	elem.className = "stat-bar "+cla;
	//variable bar
	var inner = document.createElement('span');
	inner.className = "stat-bar-inner";
	//text value
	var text = document.createElement('p');
	text.className = 'stat-bar-text';
	//icon
	var icon = document.createElement('i');
	icon.className = "fa fa-"+icon_class;
	//add all to wrapper
	elem.appendChild(inner);
	elem.appendChild(text);
	elem.appendChild(icon);
	bar.elem = elem;
	bar.text_elem = text;
	bar.inner_elem = inner;
	//on refresh
	bar.refresh = function(){
		this.text_elem.innerHTML = this.max + ' / ' + this.val;
		this.inner_elem.style.width = 100 * this.val / this.max + '%';
	}
	bar.refresh();
	return bar;
};

//loads the combat screen between the player's ship and an enemy ship
rpg.load_combat = function(player, enemy, game_screen){
	console.log(player.name + ' vs ' + enemy.name);
	// --- create the UI elements
	var combat_screen = document.createElement('div');
	combat_screen.className = "rpg-combat-screen";
	// --- make the uis
	var player_ui = rpg.ship.make_ui(player, 'player');
	var enemy_ui = rpg.ship.make_ui(enemy, 'enemy');
	// --- set shields to max value
	//for now just show gaussian distribution
	player.grid.defense = gaussian(0.7, 5, player.grid);
	player.grid.refresh();
	enemy.grid.defense = gaussian(0.5, 5, player.grid);
	enemy.grid.refresh();
	//TODO: --- setup attack events
	//TODO: add grid glitter animation to show that it exists
	// --- add control panel so user can edit their upcoming moves
	var make_control_panel = function(ship){
		var wrapper = document.createElement('div');
		wrapper.className = "control-panel";
		//title
		var title = document.createElement('p');
		title.className = "title";
		title.innerHTML = "Modules";
		//sections / navigation
		var header = document.createElement('ul');
		header.className = "tabs"
		var power = document.createElement('li');
		var defense = document.createElement('li');
		var weapons = document.createElement('li');
		power.innerHTML = "Power";
		defense.innerHTML = "Defense";
		weapons.innerHTML = "Weapons";
		//add everything
		header.appendChild(power);
		header.appendChild(defense);
		header.appendChild(weapons);
		wrapper.appendChild(title);
		wrapper.appendChild(header);
		return wrapper;
	}
	var control_panel = make_control_panel(player);
	//TODO: add enable/disable animation for control panel to indicate turns
	// --- finally, add everything to screen
	var ships = document.createElement('div');
	ships.className = "ships-wrapper";
	ships.appendChild(player_ui);
	ships.appendChild(enemy_ui);
	combat_screen.appendChild(ships);
	combat_screen.appendChild(control_panel);
	game_screen.innerHTML = "";
	game_screen.appendChild(combat_screen);
}

//generate a ship based off a string
rpg.gen_ship = function(name){
	var hash = Sha256.hash(name);
	var ship = {};
	// --- generate stats
	ship = gen_ship_stats(hash)
	ship['name'] = name;
	ship['hash'] = hash;
	// --- generate graphics
	var canvas = document.createElement('canvas');
	canvas.height = global_vars.ship_canvas.w;
	canvas.width = global_vars.ship_canvas.h;
	canvas.className = "rpg-canvas";
	ctx = canvas.getContext('2d');
	// --- pick colors scheme
	//a set of hues/saturations is picked while the lightness is controlled
	var a = 60*(hash.normalize(58, 4) - 0.5);
	var b = 60*(hash.normalize(42, 4) - 0.5);
	var color1 = '#'+convert.lab.hex(30, a, b);
	var color2 = '#'+convert.lab.hex(5, a, b);
	// --- make a basic shape to build on
	//draw a generated rectangle
	var draw_rect = function(rect){
		//draw the rectangle
		ctx.fillStyle = color1;
		ctx.fillRect(
			parseInt(rect.x - rect.w/2),
			parseInt(rect.y - rect.h/2),
			parseInt(rect.w),
			parseInt(rect.h));
	}
	//draw multiple
	var draw_rects = function(rects){
		for (var i = 0; i < rects.length; i++) {
			draw_rect(rects[i]);
		}
	}
	//generate a basic rectangle
	var gen_rect = function(hash_pos, scale, center, origin){
		var width = (hash.normalize(hash_pos, 4) + 0.2) * scale;
		var area = Math.pow(scale/2, 2);
		var rect = {x: center.x, y: center.y, w: width, h: area/width};
		//adjust x/y for origin
		if(origin == 'top'){ 	rect.y += rect.h/2 - 1; }
		if(origin == 'bottom'){ rect.y -= rect.h/2 - 1; }
		if(origin == 'left'){ 	rect.x += rect.w/2 - 1; }
		if(origin == 'right'){ 	rect.x -= rect.w/2 - 1; }
		return rect;
	};
	//get a perimeter point based on [0-1] value
	//TODO: quantize perimeter points to help line things up better
	var pick_peri = function(val, rect){
		//pick a point on the perimeter of a rectangle
		//top left is start, we count clockwise
		var wh_sum = rect.w + rect.h;
		var w_frac = rect.w / wh_sum;
		var h_frac = rect.h / wh_sum;
		if(val > 0.5){	//past mid point
			val = (val - 0.5)*2;
			if(val > w_frac){	//in left section
				var pos = rect.h * ((val-w_frac) / h_frac);
				return {x: rect.x - rect.w/2, y: rect.y + rect.h/2 - pos, o: 'right'};
			}else{			//in bottom section
				var pos = rect.w * (val / w_frac);
				return {x: rect.x + rect.w/2 - pos, y: rect.y + rect.h/2, o: 'top'};
			}
		}else{			//before mid point
			val = (val)*2;
			if(val > w_frac){	//in right section
				var pos = rect.h * ((val-w_frac) / h_frac);
				return {x: rect.x + rect.w/2, y: rect.y - rect.h/2 + pos, o: 'left'};
			}else{			//in top section
				var pos = rect.w * (val / w_frac);
				return {x: rect.x - rect.w/2 + pos, y: rect.y - rect.h/2, o: 'bottom'};
			}
		}
	}
	// --- background
	ctx.fillStyle = color2;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	//large main body
	var rects = [];
	var peris = [];
	rects.push(gen_rect(21, 75, {x: canvas.width/2, y: canvas.height/2}));
	//3 medium appendages
	for (var i = 0; i < 3; i++) {
		var val = hash.normalize(15*i + 4, 2);
		//make sure the rectangle have enough space between them
		var val_good = false;
		while(!val_good){
			val_good = true;
			for (var j = 0; j < peris.length; j++) {
				if(Math.abs(peris[j] - val) < 0.1){
					val += 0.1;
					if(val > 1.0){ val -= 1.0; }
					val_good = false;
				}
			}
		}
		peris.push(val);
		//add the rectangle
		var p = pick_peri(val, rects[0]);
		rects.push(gen_rect(15*i + 7, 40, p, p.o));
		//TODO: find rects that are too skinny and on corners and push them
		//		into the main rectangle
	}
	draw_rects(rects);
	//ship public methods
	ship.items_by_type = function(type){
		var ret = [];
		for (var i = 0; i < this.items.length; i++) {
			if(this.items[i].type == type){
				ret.push(this.items[i]);
			}
		}
		return ret;
	}
	//TODO: draw boosters on left of spaceship by spreading out
	//		a fixed width of "flame" animation, so it shows up as
	//		one big booster or several small ones
	//TODO: draw space backgroud (with neat colors)
	//TODO: draw stars, planets, dust, mist, etc
	console.log(ship);
	ship.elem = canvas;
	return ship;
}

function gen_ship_stats(hash){
	//stats are:
	//
	//      - HP: max health points, represents the ship integrity
	//      - ENRG: max energy levels, energy is used to perform actions. if you run out you essentially die
	//      - THRP: throughput, how much energy the ship can source in a turn
	//
	//      - level up boosts are how much stats grow per level.
	//        ex: HP_BST, etc
	//
	// --- generate basic items
	ship = {};
	ship['hp_max_val'] = hash.normalize(8, 4);
	ship['hp_max_mul'] = 100;

	var battery = gen_battery(hash.substring(0, 8), 1);

	//normalize across max energy, throughput, and max health
	var norm = {max_energy: battery.max_energy_val, throughput: battery.throughput_val, hp_max: ship.hp_max_val};
	normalize_stats(norm, ['max_energy', 'throughput', 'hp_max']);
	battery.max_energy_val = norm.max_energy;
	battery.throughput_val = norm.throughput;
	battery.max_energy = parseInt(battery.max_energy_mul * battery.max_energy_val);
	battery.throughput = parseInt(battery.throughput_mul * battery.throughput_val);
	ship.hp_max_val = norm.hp_max;
	ship.hp_max = parseInt(ship.hp_max_mul * ship.hp_max_val);

	//get stat boosts
	ship['e_max_bst'] = hash.normalize(12, 4);
	ship['thrp_bst'] = hash.normalize(16, 4);
	ship['hp_max_bst'] = hash.normalize(20, 4);
	//normalize across stat boosts
	normalize_stats(ship, ['e_max_bst', 'thrp_bst', 'hp_max_bst']);
	//add the base items
	ship.items = [battery];
	return ship;
}

//Generates an item based on string hash
//
//	possible item types are:
//
//	- fuel cell, shield, solar panel, ion beam, overdrive,
//	underdrive, shifter, reflector
//
rpg.gen_item = function(name, level){
	var hash = Sha256.hash(name);
	var generators = [gen_battery, gen_shield, gen_weapon];
	//get item type
	var i = parseInt(hash.normalize(16, 4)*generators.length);
	console.log(i);
	var item = generators[i](hash, level);
	item.name = name;
	return item;
}

//generate a battery with a given hash
function gen_battery(hash, level){
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
	//TODO: draw up a battery
	var canvas = document.createElement('canvas');
	canvas.className = "rpg-canvas";
	canvas.width = global_vars.item_canvas.w;
	canvas.height = global_vars.item_canvas.h;
	item.elem = canvas;
	return item;
}

//generate a shield with a given hash
function gen_shield(hash, level){
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
	//TODO: draw up a shield
	var canvas = document.createElement('canvas');
	canvas.className = "rpg-canvas";
	canvas.width = global_vars.item_canvas.w;
	canvas.height = global_vars.item_canvas.h;
	item.elem = canvas;
	return item;
}

//generate a weapon with a given hash
function gen_weapon(hash, level){
	var item = {hash: hash, type: 'weapon', name_suffix: 'pistol'};
	//keep the multipliers/values in case we need them
	item.damage_mul = 30 * level;
	item.damage_val = hash.normalize(0, 4);
	item.damage = parseInt(item.damage_val * item.damage_mul);
	item.accuracy_mul = 100 * level;
	item.accuracy_val = hash.normalize(4, 4);
	item.accuracy = parseInt(item.accuracy_val * item.accuracy_mul);
	//reliability is proportional to the inverse of damage and proportional to accuracy
	var rel = 0;	//TODO: this
	//TODO: draw up a shield
	var canvas = document.createElement('canvas');
	canvas.className = "rpg-canvas";
	canvas.width = global_vars.item_canvas.w;
	canvas.height = global_vars.item_canvas.h;
	item.elem = canvas;
	return item;
}

rpg.item = {};

//Make the ui (thumbnail portion) of an item
rpg.item.make_ui = function(item){
	var wrapper = document.createElement('div');
	wrapper.className = "item-thumb "+item.type;
	//name of item
	var title = document.createElement('p');
	title.className = "title";
	title.innerHTML = item.name + ' ' + item.name_suffix;
	//show 1-2 lines of description, depending on item type
	var desc = document.createElement('div');
	desc.className = "description";
	console.log(item);
	switch (item.type) {
		case 'battery':
			var p1 = document.createElement('p');
			p1.className = "fa-bolt";
			p1.innerHTML = item.max_energy;
			var p2 = document.createElement('p');
			p2.className = "fa-tachometer";
			p2.innerHTML = item.throughput;
			desc.appendChild(p1);
			desc.appendChild(document.createElement('br'));
			desc.appendChild(p2);
			break;
		case 'shield':
			var p1 = document.createElement('p');
			p1.className = "fa-shield";
			p1.innerHTML = item.max_shield;
			var p2 = document.createElement('p');
			p2.className = "fa-exchange";
			p2.innerHTML = item.charge_rate;
			desc.appendChild(p1);
			desc.appendChild(document.createElement('br'));
			desc.appendChild(p2);
			break;
		case 'weapon':
			var p1 = document.createElement('p');
			p1.className = "fa-certificate";
			p1.innerHTML = item.damage;
			var p2 = document.createElement('p');
			p2.className = "fa-crosshairs";
			p2.innerHTML = item.accuracy;
			desc.appendChild(p1);
			desc.appendChild(document.createElement('br'));
			desc.appendChild(p2);
			break;
	}
	//add everything
	wrapper.appendChild(item.elem);
	wrapper.appendChild(title);
	wrapper.appendChild(desc);
	return wrapper;
};
