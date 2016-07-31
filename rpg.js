var domready = require("domready");
var convert = require('color-convert');
var fields = require('./fields.js');
var transforms = require('./transforms.js');

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

var global_vars = {
	ship_canvas: {w: 200, h: 200},
	grid_canvas: {w: 25, h: 25},
	item_canvas: {w: 80, h: 80}
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

//linearly interpolate between two values with a 0-1 normalized value
function lerp(start, end, value){
	return start + (end - start)*value;
}

//create an element, with a class and content
function elem(tag, cla, content){
	var e = document.createElement(tag);
	e.className = cla;
	if(typeof content != "undefined"){
		e.innerHTML = content;
	}
	return e;
}

rpg = {};
rpg.ship = {};

//makes a ui for player / enemy
rpg.ship.make_ui = function(ship, cla){
	//to hold everything
	var wrapper = elem('div', cla + " ship-ui");
	//the actual ship
	var ship_elem = elem('div', "ship");
	ship_elem.appendChild(ship.elem);
	//the ui portion
	var ui_elem = elem('div', "ui");
	//the ship name
	var ship_name = elem('p', "ship-name", ship.name);
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
	var canvas = elem('canvas', "rpg-canvas");
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
	var el = elem('div', "stat-bar "+cla);
	//variable bar
	var inner = elem('span', "stat-bar-inner");
	//text value
	var text = elem('p', 'stat-bar-text');
	//icon
	var icon = elem('i', "fa fa-"+icon_class);
	//add all to wrapper
	el.appendChild(inner);
	el.appendChild(text);
	el.appendChild(icon);
	bar.elem = el;
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

// make control panel so user can edit their upcoming moves
rpg.ship.make_control_panel = function(ship){
	//TODO: add power bar to left of control panel to show energy left, about to be used by this turn
	var wrapper = elem('div', "control-panel");
	//title
	var title = elem('p', "title", "Modules");
	//sections / navigation
	var header = elem('ul', "tabs");
	var header_back = elem('li', "tabs-background");
	header.appendChild(header_back);
	//setup tabs
	var tabs = {'Power': {color: 'blue'}, 'Defense': {color: 'purple'}, 'Weapons': {color: 'orange'}};
	for (var t in tabs) {
		if (tabs.hasOwnProperty(t)) {
			var tab_title = elem('p', "tab-title "+tabs[t].color, t);
			var selected = elem('input');
			var content_wrapper = elem('div', "tab-content-wrapper");
			tabs[t].content = elem('div', "tab-content");
			//set class / types / tab name
			selected.type = "radio";
			selected.name = "tab-select";
			selected.value = t;
			selected.checked = (t == 'Power');
			//add everything to header
			content_wrapper.appendChild(tabs[t].content);
			header.appendChild(selected);
			header.appendChild(tab_title);
			header.appendChild(content_wrapper);
		}
	}
	//on item select event
	var item_select = function(){
		console.log(this.index);
		//unselect previous
		var prev = document.getElementsByClassName('selected');
		for (var i = 0; i < prev.length; i++) {
			prev[i].classList.remove('selected');
		}
		//select our element
		this.classList.add("selected");
		//convert weird js domtokenlist to array
		var classes = [];
		for (var i = 0; i < this.classList.length; i++) {
			classes.push(this.classList[i]);
		}
		//for shields, we can control the center of emission
		if(classes.indexOf("shield") >= 0){
			//TODO: highlight the player's ship canvas
			ship.grid.elem.onmousemove = function(e){
				console.log(e);
				//TODO: show shield distribution on separate
				//grid centered at mouse
			}
		}
	};
	// --- power tab content
	var batteries = elem('div', "batteries");
	var cells = ship.items_by_type('battery');
	for (var i = 0; i < cells.length; i++) {
		var item = rpg.item.make_ui(cells[i]);
		item.index = ship.items.indexOf(cells[i]);
		item.onclick = item_select;
		cells[i].ui_elem = item;
		batteries.appendChild(item);
	}
	tabs['Power'].content.appendChild(batteries)
	// --- defense tab content
	var shields = elem('div', "defense");
	var cells = ship.items_by_type('shield');
	for (var i = 0; i < cells.length; i++) {
		var item = rpg.item.make_ui(cells[i]);
		item.index = ship.items.indexOf(cells[i]);
		item.onclick = item_select;
		cells[i].ui_elem = item;
		shields.appendChild(item);
	}
	tabs['Defense'].content.appendChild(shields)
	// --- weapons tab content
	var weapons = elem('div', "weapons");
	var cells = ship.items_by_type('weapon');
	for (var i = 0; i < cells.length; i++) {
		var item = rpg.item.make_ui(cells[i]);
		item.index = ship.items.indexOf(cells[i]);
		item.onclick = item_select;
		cells[i].ui_elem = item;
		weapons.appendChild(item);
	}
	tabs['Weapons'].content.appendChild(weapons)
	//TODO: show current ship items
	//TODO: navigate between tabs
	//add everything else
	wrapper.appendChild(title);
	wrapper.appendChild(header);
	return wrapper;
}

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
			setTimeout(set_grid, 50);
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

	var battery = gen_battery(hash, 1);
	battery.name = "Starter";
	var shield = gen_shield(hash, 1);
	shield.name = "Starter";
	var weapon = gen_weapon(hash, 1);
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
	//console.log(i);
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
	item.run = function(){ return 0; }
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
}

//generate a weapon with a given hash
function gen_weapon(hash, level){
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
}

rpg.item = {};

//Make the ui (thumbnail portion) of an item
rpg.item.make_ui = function(item){
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
	//add everything
	desc.appendChild(p1);
	desc.appendChild(elem('br'));
	desc.appendChild(p2);
	wrapper.appendChild(item.elem);
	wrapper.appendChild(title);
	wrapper.appendChild(desc);
	return wrapper;
};

//
//	Drawing functions for canvases
//
rpg.draw = {};

//draw a rectangle with rounded edges of given size
//thanks to http://stackoverflow.com/a/3368118
rpg.draw.rounded_rect = function(ctx, x, y, w, h, rad, fill){
	ctx.beginPath();
	ctx.moveTo(x + rad, y);									//top left
	ctx.lineTo(x + w - rad, y);								//top right
	ctx.quadraticCurveTo(x + w, y, x + w, y + rad);			//top right corner
	ctx.lineTo(x + w, y + h - rad);							//bottom right
	ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);	//bottom right corner
	ctx.lineTo(x + rad, y + h);								//bottom left
	ctx.quadraticCurveTo(x, y + h, x, y + h - rad);			//bottom left corner
	ctx.lineTo(x, y + rad);									//top left
	ctx.quadraticCurveTo(x, y, x + rad, y);					//top left corner
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
}

//draw a rotated rounded_rect (rotation in degrees)
//note the x and y in this case are the centerpoint of the rect
rpg.draw.rounded_rect_rot = function(ctx, cx, cy, w, h, rad, rot, fill){
	ctx.save();
	//move the rotation point to the center of the rect
    ctx.translate(cx, cy);
	//...and rotate
	ctx.rotate(rot);
	//draw the rect
	this.rounded_rect(ctx, -w/2, -h/2, w, h, rad, fill);
	//undo everything
	ctx.restore();
}

//draw a ring with a certain inner/outer radius
rpg.draw.ring = function(ctx, x, y, rad1, rad2, fill){
	//ensure rad2 > rad1
	if(rad1 > rad2){ rad2 = [rad1, rad1 = rad2][0]; }
	//make a temp canvas
	var tmp_canvas = elem('canvas');
	tmp_canvas.width = 2*rad2;
	tmp_canvas.height = 2*rad2;
	var tmp_ctx = tmp_canvas.getContext('2d');
	//draw the large circle
	tmp_ctx.beginPath();
	tmp_ctx.arc(rad2, rad2, rad2, 0, 2*Math.PI);
	tmp_ctx.fillStyle = fill;
	tmp_ctx.fill();
	//cut out the inner circle
	tmp_ctx.beginPath();
	tmp_ctx.arc(rad2, rad2, rad1, 0, 2*Math.PI);
	tmp_ctx.globalCompositeOperation = "xor";
	tmp_ctx.fill();
	//copy to actual canvas
	ctx.drawImage(tmp_canvas, x-rad2, y-rad2);
}
