var domready = require("domready");
var convert = require('color-convert');
var fields = require('./fields.js');
var transforms = require('./transforms.js');
var elem = require('./elem.js');
var global_vars = require('./globals.js');

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
//	- use "attack bar" between ships and modules to show the attack sequence and
//	  who's turn it is. This way adding local 2-player multiplayer is easy as we
//	  just use the same bar.
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

//make game object
rpg = {
	ship: require('./ship.js'),
	draw: require('./draw.js'),
	item: require('./item.js')
};

//draws up an attack bar to queue up attack sequences
rpg.make_attack_bar = function(attack_cb){
	var abar = elem('div', "attack-bar ready-left");
	abar.appendChild(elem('span', 'back-left'));
	abar.appendChild(elem('span', 'back-right'));
	var wrapper = elem('div', 'attack-bar-content');
	var ready1 = elem('p', "attack-button left", 'READY');
	var ready2 = elem('p', "attack-button right waiting", 'WAITING');
	//add chevrons
	var elems = [];
	for (var i = 0; i < 5; i++) {
		elems.push(elem('span', 'chevron-left ready chevron-left-'+(5-i-1)));
	}
	elems.push(elem('p', 'engage', 'ENGAGE'));
	for (var i = 0; i < 5; i++) {
		elems.push(elem('span', 'chevron-right chevron-right-'+i));
	}
	//click to start engagement
	ready1.onclick = attack_cb;
	//add everything
	wrapper.appendChild(ready1);
	for (var i = 0; i < elems.length; i++) {
		wrapper.appendChild(elems[i]);
	}
	wrapper.appendChild(ready2);
	abar.appendChild(wrapper);
	return abar;
}

//loads the combat screen between the player's ship and an enemy ship
rpg.load_combat = function(player, enemy, game_screen){
	//console.log(player.name + ' vs ' + enemy.name);
	// --- create the UI elements
	var combat_screen = elem('div', "rpg-combat-screen");
	// --- make the uis
	var player_ui = rpg.ship.make_ui(player, 'player');
	var enemy_ui = rpg.ship.make_ui(enemy, 'enemy');
	// --- set shields to max value
	//make a basic field
	var shield_grid = fields.composite(player.grid);
	shield_grid.addField(fields.gaussian(12.5, 12.5, 1, 1.3));
	shield_grid.addField(fields.gaussian(15, 15, 0.8, 0.5));
	shield_grid.addField(fields.gaussian(10, 15, 0.8, 0.5));
	shield_grid.addField(fields.gaussian(10, 10, 0.8, 0.5));
	shield_grid.addField(fields.gaussian(15, 10, 0.8, 0.5));
	player.grid.defense = shield_grid.render();
	player.grid.refresh();
	shield_grid.addTransform(transforms.scale(global_vars.grid_canvas.w/2, global_vars.grid_canvas.h/2, 12))
	var frames = shield_grid.animateTransform(0, 10);
	var frames_i = 0;
	var set_grid = function(){
		enemy.grid.defense = frames[frames_i++];
		enemy.grid.refresh();
		if(frames_i < frames.length -1){
			setTimeout(set_grid, 40);
		}
	}
	set_grid();
	//TODO: --- setup attack events
	//TODO: add grid glitter animation to show that it exists
	//add an attack bar for sequencing turns
	var attack_bar = rpg.make_attack_bar(function onattack(){
		//TODO: check and throttle energy usage if above max throughput
		//run the player items
		for (var i = 0; i < player.items.length; i++) {
			player.energy -= player.items[i].run(player);
		}
		//run the enemy items
		for (var i = 0; i < enemy.items.length; i++) {
			enemy.energy -= enemy.items[i].run(enemy);
		}
		//TODO: check for lose/win conditions
		//refresh both ship views
		player.refresh();
		enemy.refresh();
	});
	//add a control panel so user can set up their attack / defense
	var control_panel = rpg.ship.make_control_panel(player);
	//TODO: add enable/disable animation for control panel to indicate turns
	// --- finally, add everything to screen
	var ships = elem('div', "ships-wrapper");
	ships.appendChild(player_ui);
	ships.appendChild(enemy_ui);
	combat_screen.appendChild(ships);
	combat_screen.appendChild(attack_bar);
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
	var canvas = elem('canvas', 'rpg-canvas');
	canvas.height = global_vars.ship_canvas.w;
	canvas.width = global_vars.ship_canvas.h;
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
	// --- ship public methods
	//get all ship items of a type
	ship.items_by_type = function(type){
		var ret = [];
		for (var i = 0; i < this.items.length; i++) {
			if(this.items[i].type == type){
				ret.push(this.items[i]);
			}
		}
		return ret;
	}
	//run a function for all items of a type
	ship.for_item_type = function(type, cb){
		var items = this.items_by_type(type);
		for (var i = 0; i < items.length; i++) {
			var ret = cb(items[i]);
			if(ret != null){ items[i] = ret; }
		}
	}
	//refresh all things related to a ship (health bar, energy, etc)
	ship.refresh = function(){
		this.energy_bar.val = this.energy;
		this.energy_bar.refresh();
		this.health_bar.val = this.hp;
		this.health_bar.refresh();
		this.grid.refresh();
	}
	//TODO: draw boosters on left of spaceship by spreading out
	//		a fixed width of "flame" animation, so it shows up as
	//		one big booster or several small ones
	//TODO: draw space backgroud (with neat colors)
	//TODO: draw stars, planets, dust, mist, etc
	//console.log(ship);
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

	var battery = rpg.item.gen_battery(hash, 1);
	battery.name = "Starter";
	var shield = rpg.item.gen_shield(hash, 1);
	shield.name = "Starter";
	var weapon = rpg.item.gen_weapon(hash, 1);
	weapon.name = "Starter";

	//normalize across max energy, throughput, and max health
	var norm = {max_energy: battery.max_energy_val, throughput: battery.throughput_val, hp_max: ship.hp_max_val};
	normalize_stats(norm, ['max_energy', 'throughput', 'hp_max']);
	battery.max_energy_val = norm.max_energy;
	battery.throughput_val = norm.throughput;
	battery.max_energy = parseInt(battery.max_energy_mul * battery.max_energy_val);
	battery.throughput = parseInt(battery.throughput_mul * battery.throughput_val);
	ship.hp_max_val = norm.hp_max;
	ship.hp_max = parseInt(ship.hp_max_mul * ship.hp_max_val);
	ship.hp = ship.hp_max;
	ship.energy_max = battery.max_energy;
	ship.energy = ship.energy_max;

	//get stat boosts
	ship['e_max_bst'] = hash.normalize(12, 4);
	ship['thrp_bst'] = hash.normalize(16, 4);
	ship['hp_max_bst'] = hash.normalize(20, 4);
	//normalize across stat boosts
	normalize_stats(ship, ['e_max_bst', 'thrp_bst', 'hp_max_bst']);
	//add the base items
	ship.items = [battery, shield, weapon];
	return ship;
}
