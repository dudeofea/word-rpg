//
//	SPACESHIPS
//
//	Contains all needed functions to generate
//  spaceships and handle stat updates
//

var elem = require('./elem.js');
var global_vars = require('./globals.js');
var convert = require('color-convert');
var transforms = require('./transforms.js');

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

module.exports = {
	//makes a ui for a ship
	make_ui: function(ship, cla){
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
		ship.grid = this.make_grid();
		//health / shield / energy bars
		ship.health_bar = this.make_bar(ship.hp_max, 'health', 'heart');
		//TODO: add bar showing overall shield level
		//ship.shield_bar = this.make_bar(ship.)
		//calc max energy
		ship.max_energy = 0;
		var cells = ship.items_by_type('battery');
		for (var i = 0; i < cells.length; i++) {
			ship.max_energy += cells[i].max_energy;
		}
		ship.energy_bar = this.make_bar(ship.max_energy, 'energy', 'bolt');
		//adding everything
		ui_elem.appendChild(ship_name);
		ui_elem.appendChild(ship.grid.elem);
		ui_elem.appendChild(ship.health_bar.elem);
		ui_elem.appendChild(ship.energy_bar.elem);
		wrapper.appendChild(ship_elem);
		wrapper.appendChild(ui_elem);
		return wrapper;
	},

	// --- make the attack / defend grids
	make_grid: function(){
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
	},

	// --- make a colored bar
	make_bar: function(max, cla, icon_class){
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
	},

	// make control panel so user can edit their upcoming moves
	make_control_panel: function(ship){
		//TODO: add power bar on top of control panel to show energy left, about to be used by this turn
		//TODO: on said power bar, add separate elements to show individual contributions of ship items to power consumption
		var wrapper = elem('div', "control-panel");
		//title
		var title = elem('p', "title", "Modules");
		//sections / navigation
		var header = elem('ul', "tabs");
		var header_back = elem('li', "tabs-background");
		header.appendChild(header_back);
		//clear temp events setup when selecting
		var clear_events = function(){
			ship.grid.elem.onmousemove = null;
			//TODO: remove hover_canvas element
		}
		//on item select event
		var item_select = function(){
			var item = ship.items[this.index];
			console.log(item);
			//--- unselect previous
			var prev = document.getElementsByClassName('selected');
			for (var i = 0; i < prev.length; i++) {
				prev[i].classList.remove('selected');
			}
			//--- select our element
			this.classList.add("selected");
			//convert weird js domtokenlist to array
			var classes = [];
			for (var i = 0; i < this.classList.length; i++) {
				classes.push(this.classList[i]);
			}
			//show detail view of item
			item_detail_header.innerHTML = item.name + " " + item.name_suffix;
			item_detail_content.innerHTML = "";
			var item_canvas_wrapper = elem('div', 'canvas-wrapper');
			item_canvas_wrapper.appendChild(item.elem.cloneNode(true));
			item_detail_content.appendChild(item_canvas_wrapper);
			//for shields, we can control the center of emission
			clear_events();
			if(classes.indexOf("shield") >= 0){
				//use shield field, and setup translation based on mouse position
				var hover_canvas = elem('canvas', 'overlay rpg-canvas');
				var ctx = hover_canvas.getContext('2d');
				hover_canvas.width = global_vars.grid_canvas.w;
				hover_canvas.height= global_vars.grid_canvas.h;
				ship.grid.elem.parentNode.appendChild(hover_canvas);
				var f = item.field.clone();
				//colorize
				var framebuffer = ctx.createImageData(hover_canvas.width, hover_canvas.height);
				var data = framebuffer.data;
				//TODO: get value from global green color
				for (var i = 0; i < data.length; i += 4) {
					data[i]	  = 100;
					data[i+1] = 255;
					data[i+2] = 100;
					data[i+3] = 0;
				}
				//add a translate transform
				f.addTransform(transforms.translate(3, 3));
				var last_transform = f.transforms[f.transforms.length-1];
				var hover_canvas_refresh = function(){
					var data = framebuffer.data;
					var field_data = f.render();
					for (var i = 0; i < field_data.length; i++) {
						data[i*4+3] = field_data[i];
					}
					ctx.putImageData(framebuffer, 0, 0);
				}
				hover_canvas_refresh();
				//move around center based on mouse
				hover_canvas.onmousemove = function(e){
					//console.log(e, last_transform);
					//get x/y on canvas
					var grid_x = Math.floor(e.target.width*e.layerX/e.target.clientWidth);
					var grid_y = Math.floor(e.target.height*e.layerY/e.target.clientHeight);
					last_transform.tx = grid_x;
					last_transform.ty = grid_y;
					//refresh the canvas
					hover_canvas_refresh();
				}
				//TODO: only move around the field when clicked
				//setup detail panel
				item_detail_content.appendChild(elem('p', 'fa-exchange', 'Energy consumption'));
				item_detail_content.appendChild(elem('span', 'value', item.consumption));
				item_detail_content.appendChild(elem('p', 'fa-shield', 'Maximum Shielding'));
				item_detail_content.appendChild(elem('span', 'value', item.max_shield));
				item_detail_content.appendChild(elem('p', 'fa-repeat', 'Shield Regeneration'));
				item_detail_content.appendChild(elem('span', 'value', item.charge_rate));
				item_detail.className = "detail green";
			//item is battery
			}else if(classes.indexOf("battery") >= 0){
				item_detail_content.appendChild(elem('p', 'fa-exchange', 'Energy Production'));
				item_detail_content.appendChild(elem('span', 'value', -item.consumption));
				item_detail_content.appendChild(elem('p', 'fa-bolt', 'Energy Capacity'));
				item_detail_content.appendChild(elem('span', 'value', item.max_energy));
				item_detail.className = "detail blue";
			//for weapons we can control where we aim it
			}else if(classes.indexOf("weapon") >= 0){
				item_detail_content.appendChild(elem('p', 'fa-exchange', 'Energy consumption'));
				item_detail_content.appendChild(elem('span', 'value', item.consumption));
				item_detail_content.appendChild(elem('p', 'fa-certificate', 'Damage'));
				item_detail_content.appendChild(elem('span', 'value', item.damage));
				item_detail_content.appendChild(elem('p', 'fa-crosshairs', 'Accuracy'));
				item_detail_content.appendChild(elem('span', 'value', item.accuracy));
				item_detail.className = "detail orange";
			}
		};
		//on item deselect
		var item_deselect = function(e){
			//TODO: check if not within item-thumb element
			if(e.target.className != "tab-content"){
				return;
			}
			//--- unselect previous
			var prev = document.getElementsByClassName('selected');
			for (var i = 0; i < prev.length; i++) {
				prev[i].classList.remove('selected');
			}
			//hide details
			item_detail.addClass("hide");
			//remove mouse events
			clear_events();
		};
		//setup tabs
		var tabs = {'Power': {color: 'blue'}, 'Defense': {color: 'green'}, 'Weapons': {color: 'orange'}};
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
				content_wrapper.onclick = item_deselect;
				header.appendChild(selected);
				header.appendChild(tab_title);
				header.appendChild(content_wrapper);
			}
		}
		//TODO: setup detail view
		var item_detail = elem("div", "detail hide");
		var item_detail_header = elem("p", "detail-title");
		var item_detail_content = elem("div", "detail-content");
		item_detail.appendChild(item_detail_header);
		item_detail.appendChild(item_detail_content);
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
		//add everything else
		wrapper.appendChild(title);
		wrapper.appendChild(header);
		wrapper.appendChild(item_detail);
		return wrapper;
	},
	//generate a ship based off a string
	gen_ship: function(name){
		var hash = Sha256.hash(name);
		var ship = {};
		// --- generate stats
		ship = this.gen_ship_stats(hash)
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
	},

	gen_ship_stats: function(hash){
		//stats are:
		//
		//      - HP: max health points, represents the ship integrity
		//      - ENRG: max energy levels, energy is used to perform actions. if you run out you essentially die
		//      - THRP: throughput, how much energy the ship can source in a turn
		//				calculated from the sum of all battery energ production values (the opposite of consumption)
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
		var norm = {max_energy: battery.max_energy_val, hp_max: ship.hp_max_val};
		normalize_stats(norm, ['max_energy', 'hp_max']);
		battery.max_energy_val = norm.max_energy;
		battery.max_energy = parseInt(battery.max_energy_mul * battery.max_energy_val);
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
};
