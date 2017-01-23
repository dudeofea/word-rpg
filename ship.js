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
var fields = require('./fields.js');
var debug = require('./debug.js');
var Sha256 = require('./sha256.js');
var ship_items = require('./item.js');
var normalize = require('./normalize.js');

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
		var grid = { max_val: 1.0 };
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
		//when refreshing value
		grid.refresh = function(){
			var data = this.framebuffer.data;
			for (var i = 0; i < this.defense.length; i++) {
				data[i*4+3] = 220 * this.defense[i] / this.max_val;
			}
			this.ctx.putImageData(this.framebuffer, 0, 0);
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
	//TODO: add keyboard macros to switch tabs, switch items, move hover editor
	make_control_panel: function(ship, enemy){
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
		var hover_canvas = null;
		var hover_field  = null;
		var hover_framebuffer = null;
		var clear_events = function(){
			ship.grid.elem.onmousemove = null;
			//remove hover_canvas element
			if(hover_canvas != null){
				hover_canvas.parentNode.removeChild(hover_canvas);
				hover_canvas = null;
				hover_field = null;
				hover_framebuffer = null;
			}
		}
		//setup mouse events and animate grid canvas for editing
		var hover_canvas_editor = function(color){
			var ctx = hover_canvas.getContext('2d');
			//colorize
			hover_framebuffer = ctx.createImageData(hover_canvas.width, hover_canvas.height);
			var data = hover_framebuffer.data;
			for (var i = 0; i < data.length; i += 4) {
				data[i]	  = color[0];
				data[i+1] = color[1];
				data[i+2] = color[2];
				data[i+3] = 0;
			}
			//add a translate transform
			//TODO: don't re-add this transform over and over when editing
			hover_field.addTransform(transforms.translate(0, 0));
			var last_transform = hover_field.transforms[hover_field.transforms.length-1];
			var hover_canvas_refresh = function(){
				var data = hover_framebuffer.data;
				var field_data = hover_field.render();
				for (var i = 0; i < field_data.length; i++) {
					data[i*4+3] = field_data[i] * 255;
				}
				ctx.putImageData(hover_framebuffer, 0, 0);
			}
			hover_canvas_refresh();
			//drag around shield position
			var hover_enabled = false;
			var last_pos = null;
			var last_translate = {x: 0, y: 0};
			hover_canvas.onmousemove = function(e){
				if(!hover_enabled){ return; }
				//get x/y on canvas
				var grid_x = Math.floor(e.target.width*e.layerX/e.target.clientWidth);
				var grid_y = Math.floor(e.target.height*e.layerY/e.target.clientHeight);
				last_transform.tx = grid_x - last_pos.x + last_translate.x;
				last_transform.ty = grid_y - last_pos.y + last_translate.y;
				//refresh the canvas
				hover_canvas_refresh();
			}
			//only move around the field when mouse is down
			hover_canvas.onmouseup = function(e){
				hover_enabled = false;
				last_pos = null;
			}
			hover_canvas.onmousedown = function(e){
				hover_enabled = true;
				//get initial mouse / translate position
				var grid_x = Math.floor(e.target.width*e.layerX/e.target.clientWidth);
				var grid_y = Math.floor(e.target.height*e.layerY/e.target.clientHeight);
				last_pos = {x: grid_x, y: grid_y};
				last_translate = {x: last_transform.tx, y: last_transform.ty};
			}
		}
		//TODO: add button to item cards to enable / disable (to save power)
		//TODO: add button to item cards to add a modifier item
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
				hover_canvas = elem('canvas', 'overlay rpg-canvas');
				hover_canvas.width = global_vars.grid_canvas.w;
				hover_canvas.height= global_vars.grid_canvas.h;
				ship.grid.elem.parentNode.insertBefore(hover_canvas, ship.grid.elem);	//insert right before our ship's canvas
				//TODO: keep translation value in last transform of field
				hover_field = item.field;
				//get value from global green color
				var color = convert.hex.rgb(global_vars.colors.green.replace('#', ''));
				hover_canvas_editor(color);
				//setup detail panel
				item_detail_content.appendChild(elem('p', 'fa-exchange', 'Energy Consumption'));
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
				//weapon editor, (very) similar to shield editor
				hover_canvas = elem('canvas', 'overlay rpg-canvas');
				hover_canvas.width = global_vars.grid_canvas.w;
				hover_canvas.height= global_vars.grid_canvas.h;
				enemy.grid.elem.parentNode.insertBefore(hover_canvas, enemy.grid.elem);		//insert right before enemy ship's canvas
				//TODO: keep translation value in last transform of field
				hover_field = item.field;
				//get value from global orange color
				var color = convert.hex.rgb(global_vars.colors.orange.replace('#', ''));
				hover_canvas_editor(color);
				//setup detail pane
				item_detail_content.appendChild(elem('p', 'fa-exchange', 'Energy Consumption'));
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
			//check if not within item-thumb element
			if(elem.withinClass(e.target, 'item-thumb')){
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
		//setup detail view
		var item_detail = elem("div", "detail hide");
		var item_detail_header = elem("p", "detail-title");
		var item_detail_content = elem("div", "detail-content");
		item_detail.appendChild(item_detail_header);
		item_detail.appendChild(item_detail_content);
		// --- power tab content
		var batteries = elem('div', "batteries");
		var cells = ship.items_by_type('battery');
		for (var i = 0; i < cells.length; i++) {
			var item = ship_items.make_ui(cells[i]);
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
			var item = ship_items.make_ui(cells[i]);
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
			var item = ship_items.make_ui(cells[i]);
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
		//make ship params from hash
		var params = {};
		// --- pick color scheme
		//a set of hues/saturations is picked while the lightness is controlled
		var a = 60*(normalize.hash(hash, 58, 4) - 0.5);
		var b = 60*(normalize.hash(hash, 42, 4) - 0.5);
		params.color_ship_main = '#'+convert.lab.hex(30, a, b);
		params.color_ship_border = '#'+convert.lab.hex(20, a, b);
		params.color_ship_border_rgb = convert.lab.rgb(20, a, b);
		params.color_ship_grid = '#'+convert.lab.hex(23, a, b);
		params.color_back = '#'+convert.lab.hex(5, a, b);
		// --- ship layout generation
		params.ship_main_rect_ratio = normalize.hash(hash, 21, 4);
		params.ship_aux_rects = [
			{pos: normalize.hash(hash, 15, 4), ratio: normalize.hash(hash, 30, 4)},
			{pos: normalize.hash(hash, 40, 4), ratio: normalize.hash(hash, 50, 4)},
			{pos: normalize.hash(hash, 30, 4), ratio: normalize.hash(hash, 15, 4)}
		];
		var ship = this.create_ship(params);
		//add additional stats
		var stats = this.gen_ship_stats(hash);
		ship.name = name;
		ship.hash = hash;
		for (var s in stats) {
			if (stats.hasOwnProperty(s)) {
				ship[s] = stats[s];
			}
		}
		// --- set ship global hp stat based on layout
		var hull_tiles = 0;
		for (var i = 0; i < ship.layout.length; i++) {
			hull_tiles += ship.layout[i];
		}
		console.log(ship)
		ship.hp_max = ship.tile_hp_max * hull_tiles * 2;	//2 for both upper / lower
		ship.hp = ship.hp_max;
		//make health layout of upper / lower hull. may change when
		//adding hull pieces
		ship.upper_hull = ship.layout.clone().mul(ship.tile_hp_max);
		ship.lower_hull = ship.layout.clone().mul(ship.tile_hp_max);
		//get an open spot to place an item of a certain size
		var get_random_open_spot = function(ship, size){
			//get sum of array (only has 1's or 0's)
			var sum = 0;
			var open = ship.get_open_spots(size);
			for (var i = 0; i < open.length; i++) {
				sum += open[i];
			}
			//pick random spot
			var spot = Math.floor(Math.random() * sum);
			//get it's position
			i = 0;
			while(spot >= 0){
				spot -= open[i];
				i++;
			}
			i--;
			return {x: i % 25, y: Math.floor(i / 25)};
		}
		//add items to some appropriate spot on ship
		var items = ship.items;
		ship.items = [];
		for (var i = 0; i < items.length; i++) {
			var spot = get_random_open_spot(ship, items[i].size);
			ship.add_item(items[i], spot);
		}
		//generate ship visual around said virtual grid (with rounded corners and such)
		ship.draw();
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
		ship['tile_hp_max_val'] = normalize.hash(hash, 8, 4);
		ship['tile_hp_max_mul'] = 3;

		var battery = ship_items.gen_battery(hash, 1);
		battery.name = "Starter";
		var shield = ship_items.gen_shield(hash, 1);
		shield.name = "Starter";
		var weapon = ship_items.gen_weapon(hash, 1);
		weapon.name = "Starter";

		//normalize across max energy, shield, damage, and max health
		var norm = {max_energy: battery.max_energy_val, max_shield: shield.max_shield_val, damage: weapon.damage_val, hp_max: ship.tile_hp_max_val};
		normalize.stats(norm, ['max_energy', 'max_shield', 'damage', 'hp_max']);
		battery.max_energy_val = norm.max_energy;
		battery.max_energy = parseInt(battery.max_energy_mul * battery.max_energy_val);
		shield.max_shield_val = norm.max_shield;
		shield.max_shield = parseInt(shield.max_shield_mul * shield.max_shield_val);
		weapon.damage_val = norm.damage;
		weapon.damage = parseInt(weapon.damage_mul * weapon.damage_val);
		//just a note, hp is currently per hull tile so it will be multiplied later
		ship.tile_hp_max_val = norm.hp_max;
		ship.tile_hp_max = 2 + parseInt(ship.tile_hp_max_mul * ship.tile_hp_max_val);

		//get stat boosts
		ship['e_max_bst'] = normalize.hash(hash, 12, 4);
		ship['thrp_bst'] = normalize.hash(hash, 16, 4);
		ship['hp_max_bst'] = normalize.hash(hash, 20, 4);
		//normalize across stat boosts
		normalize.stats(ship, ['e_max_bst', 'thrp_bst', 'hp_max_bst']);
		//add the base items
		ship.items = [battery, shield, weapon];
		return ship;
	},

	//create/load a ship with a set of parameters
	//TODO: add given items
	create_ship: function(params){
		var ship_defaults = {
			color_ship_main: '#EEE',
			color_ship_border: '#AAA',
			color_ship_grid: '#CCC',
			color_back: '#333',
			ship_main_rect_ratio: 0.5,
			ship_aux_rects: []
		};
		//get all given ship parameters
		var ship_spec = ship_defaults;
		if(params != null){
			for (var p in params) {
				if (params.hasOwnProperty(p)) {
					ship_spec[p] = params[p];
				}
			}
		}
		var ship = {
			spec: ship_spec
		};
		// --- generate graphics
		var canvas = elem('canvas', 'rpg-canvas');
		canvas.height = global_vars.ship_canvas.w;
		canvas.width = global_vars.ship_canvas.h;
		var ctx = canvas.getContext('2d');
		//checks if a spot on a grid is zero (nothing there)
		var is_open = function(grid, x, y, width){
			var i = x + y * width;
			if(i < 0 || i > grid.length || grid[i] != 0){
				return false;
			}
			return true;
		}
		//TODO: add ui control for zooming in/out of ship so you can see things better
		//TODO: add ui control for panning to different parts of ship
		//draw a ship based on a floorplan (place where you put items and shit)
		ship.draw = function(){
			console.log(this.spec.color_ship_border_rgb);
			var tile_size = global_vars.ship_canvas.w / this.layout.width;
			var border_size = 7;
			for (var i = 0; i < this.layout.length; i++) {
				if(this.layout[i] > 0){
					var x = i % this.layout.width;
					var y = (i - x) / this.layout.width;
					//calc variable tile size to fit to pixel borders
					var x_min = Math.ceil(x * tile_size);
					var x_max = Math.ceil((x + 1) * tile_size);
					var y_min = Math.ceil(y * tile_size);
					var y_max = Math.ceil((y + 1) * tile_size);
					var tile_size_x = x_max - x_min;
					var tile_size_y = y_max - y_min;
					//figure out which sides are open (not inside) and draw edges / corners
					ctx.fillStyle = this.spec.color_ship_border;
					var top_open = 		is_open(this.layout, x, y - 1, this.layout.width);
					var bottom_open = 	is_open(this.layout, x, y + 1, this.layout.width);
					var left_open = 	is_open(this.layout, x - 1, y, this.layout.width);
					var right_open = 	is_open(this.layout, x + 1, y, this.layout.width);
					//edges
					if(top_open){
						ctx.fillRect(x_min, y_min - border_size, tile_size_x, border_size);
					}
					if(bottom_open){
						ctx.fillRect(x_min, y_max, tile_size_x, border_size);
					}
					if(left_open){
						ctx.fillRect(x_min - border_size, y_min, border_size, tile_size_y);
					}
					if(right_open){
						ctx.fillRect(x_max, y_min, border_size, tile_size_y);
					}
					//corners
					if(top_open && left_open){
						ctx.beginPath();
						ctx.arc(x_min, y_min, border_size, 0, 2*Math.PI);
						ctx.fill();
					}
					if(top_open && right_open){
						ctx.beginPath();
						ctx.arc(x_max, y_min, border_size, 0, 2*Math.PI);
						ctx.fill();
					}
					if(bottom_open && left_open){
						ctx.beginPath();
						ctx.arc(x_min, y_max, border_size, 0, 2*Math.PI);
						ctx.fill();
					}
					if(bottom_open && right_open){
						ctx.beginPath();
						ctx.arc(x_max, y_max, border_size, 0, 2*Math.PI);
						ctx.fill();
					}
					//draw the actual tile where things go
					if(this.layout[i] > 1){
						//TODO: replace by drawing items separately after ship using pos/bb attribute
						ctx.fillStyle = 'red';
					}else{
						ctx.fillStyle = this.spec.color_ship_main;
					}
					ctx.fillRect(x_min, y_min, tile_size_x, tile_size_y);
					//grid lines
					ctx.fillStyle = this.spec.color_ship_grid;
					if(!bottom_open){	//horizontal
						ctx.fillRect(x_min + 2, y_max - 1, tile_size_x - 4, 1);
					}
					if(!right_open){	//vertical
						ctx.fillRect(x_max - 1, y_min + 2, 1, tile_size_y - 4);
					}
					//upper hull
					var hull_tile_health = this.upper_hull[i] / this.tile_hp_max;
					ctx.fillStyle = "rgba(" + this.spec.color_ship_border_rgb[0] + "," + this.spec.color_ship_border_rgb[1] + "," + this.spec.color_ship_border_rgb[2] + "," + hull_tile_health + ")";
					ctx.fillRect(x_min, y_min, tile_size_x, tile_size_y);
				}
			}
			//TODO: draw rocket boosters in back of ship
			//TODO: draw other ship accessories  (portholes, dents, etc)
		}
		//generate a basic rectangle
		var gen_rect = function(hash_width, scale, center, origin_str){
			var width = normalize.lerp(0.2, 0.8, hash_width) * scale;
			var area = Math.pow((0.8*scale)/2, 2);
			var rect = {x: center.x, y: center.y, w: width, h: area/width};
			//adjust x/y for origin
			if(origin_str == 'top'){ 	rect.y += rect.h/2 - 1; }
			if(origin_str == 'bottom'){ rect.y -= rect.h/2 - 1; }
			if(origin_str == 'left'){ 	rect.x += rect.w/2 - 1; }
			if(origin_str == 'right'){ 	rect.x -= rect.w/2 - 1; }
			return rect;
		};
		//get a perimeter point based on [0-1] value,
		//returns an x / y and a string of where the origin of the rectange to insert should be
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
		ctx.fillStyle = ship_spec.color_back;
		ctx.fillRect(0,0,canvas.width,canvas.height);
		// --- create ship layout using array instead of analog transformable field
		var v_grid = global_vars.grid_canvas;
		var ship_layout_field = fields.static(v_grid);			//boolean grid of what tiles are inside/outside the ship
		var main_rect = gen_rect(ship_spec.ship_main_rect_ratio, 0.8 * v_grid.w, {x: v_grid.w/2, y: v_grid.h/2});
		ship_layout_field.unionField(fields.rectangle(main_rect, 1));
		//add appendages to ship
		for (var i = 0; i < ship_spec.ship_aux_rects.length; i++) {
			var peri = pick_peri(ship_spec.ship_aux_rects[i].pos, main_rect);
			var append = gen_rect(ship_spec.ship_aux_rects[i].ratio, 10, peri, peri.o);
			ship_layout_field.unionField(fields.rectangle(append, 1));
		}
		ship.layout = ship_layout_field;
		// --- ship public methods
		//add a new item to the ship and update layout
		ship.items_inserted = 0;
		ship.items = [];
		ship.add_item = function(item, pos, id){
			var item_bb = {
				x_min: pos.x,
				y_min: pos.y,
				x_max: pos.x + item.size.w - 1,
				y_max: pos.y + item.size.h - 1
			};
			//use IDs to items to differentiate, and track those IDs
			if(id == null){
				this.items_inserted++;
				id = this.items_inserted + 1;
			}
			this.layout.unionField(fields.bounding_box(item_bb, id));
			//add to ship items array
			item.id = id;
			item.bb = item_bb;
			this.items.push(item);
			return id;
		}
		//return an item by id (also add it's index)
		ship.item_by_id = function(id){
			for (var i = 0; i < this.items.length; i++) {
				if(this.items[i].id == id){
					var item = this.items[i];
					item.index = i;
					return item;
				}
			}
			return null;
		};
		//move an exisiting item to a new position
		ship.move_item = function(id, pos){
			var item = this.item_by_id(id);
			if(item == null){
				return;
			}
			this.delete_item(id);
			this.add_item(item, pos, id);
		};
		//delete an exisiting item from layout
		ship.delete_item = function(id){
			var item = this.item_by_id(id);
			if(item == null){
				return;
			}
			//remove from ship layout
			this.layout.unionField(fields.bounding_box(item.bb, 1));
			//remove from items array
			this.items.splice(item.index, 1);
		}
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
		//gets all open indexes on ship for a certain item size (returns boolean map)
		ship.get_open_spots = function(size){
			//go through all the spots
			var open_grid = this.layout.clone();
			for (var i = 0; i < open_grid.length; i++) {
				if(open_grid[i] > 0){
					//check if size itersects with ship bounds
					var x = i % open_grid.width;
					var y = (i - x) / open_grid.width;
					var good = true;
					//go through item spots
					for (var s_y = 0; s_y < size.h; s_y++) {
						var s_off = (y + s_y) * open_grid.width;
						for (var s_x = 0; s_x < size.w; s_x++) {
							if(open_grid[x + s_x + s_off] != 1){
								good = false;
								break;
							}
						}
					}
					if(!good){
						open_grid[i] = 0;
					}
				}
			}
			return open_grid;
		}
		//initialize the ship for combat (full shields, full batteries, etc)
		ship.init = function(){
			//set batteries to full
			var batteries = this.items_by_type('battery')
			for (var i = 0; i < batteries.length; i++) {
				batteries[i].energy = batteries[i].max_energy;
			}
		}
		//run one step of energy consumption / item usage
		//enemy ship is passed if we want to perform actions against it
		ship.run_step = function(enemy){
			//TODO: incorporate reliability trickle-down from batteries
			//get available energy from batteries and such
			var available_energy = 0;
			var batteries = this.items_by_type('battery');
			var weapons = this.items_by_type('weapon');
			for (var i = 0; i < batteries.length; i++) {
				available_energy += Math.min(-batteries[i].consumption, batteries[i].energy);
			}
			var inital_energy = available_energy;
			//TODO: only run enabled items
			//run the items
			for (var i = 0; i < this.items.length; i++) {
				if(this.items[i].type == 'battery' ||
				   this.items[i].type == 'weapon'){
					continue;
				}
				available_energy -= this.items[i].consumption;
				if(available_energy < 0){ available_energy = 0; }
				this.items[i].run(available_energy, ship, enemy);
			}
			//TODO: run weapons one at a time and show damage scores
			var self = this;
			var run_weapon = function(weapon){
				console.log('attacking with: ', weapon);
				//get all upper hull damage
				var dmg = weapon.field.render().mul(-1 * weapon.damage).round();
				var res = enemy.upper_hull.addField(dmg);
				var oflow = res.lessThan(0);	//overflow damage that leaks to weapons
				enemy.upper_hull.addField(oflow.clone().mul(-1));	//remove overflow spots
				//TODO: get all item damage
				//get all lower hull damage
				var res = enemy.lower_hull.addField(oflow);
				oflow = res.lessThan(0);
				enemy.lower_hull.addField(oflow.clone().mul(-1));
				//TODO: show all three types of damage
				//subtract energy used from batteries, sequentially
				var spent_energy = inital_energy - available_energy;
				for (var i = 0; i < batteries.length; i++) {
					if(batteries[i].energy > 0){
						var to_remove = Math.min(batteries[i].energy, spent_energy);
						batteries[i].energy -= to_remove;
						spent_energy -= to_remove;
					};
				}
				//refresh the view
				self.refresh();
			}
			for (var i = 0; i < weapons.length; i++) {
				setTimeout(run_weapon, (i+1) * 0000, weapons[i]);
			}
			//refresh the view
			self.refresh();
		}
		//refresh all things related to a ship (health bar, energy, etc)
		ship.refresh = function(){
			//get ship total energy
			this.energy_bar.val = 0;
			var batteries = this.items_by_type('battery')
			for (var i = 0; i < batteries.length; i++) {
				this.energy_bar.val += batteries[i].energy;
			}
			this.energy_bar.refresh();
			//calc total ship health (sum of upper / lower hull health)
			this.health_bar.val = this.upper_hull.sum() + this.lower_hull.sum();
			this.health_bar.refresh();
			//scale grid based on maximum attainable shield level
			var shields = this.items_by_type('shield');
			this.grid.max_val = 0;
			for (var i = 0; i < shields.length; i++) {
				this.grid.max_val = Math.max(shields[i].max_shield, this.grid.max_val);
			}
			//TODO: give boosted shields a blue tinge when past max shield level
			this.grid.refresh();
			this.draw();
		}
		//TODO: draw space backgroud (with neat colors)
		//TODO: draw stars, planets, dust, mist, etc
		ship.elem = canvas;
		return ship;
	}
};
