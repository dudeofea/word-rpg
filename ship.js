//
//	SPACESHIPS
//
//	Contains all needed functions to generate
//  spaceships and handle stat updates
//

var elem = require('./elem.js');
var global_vars = require('./globals.js');

module.exports = {
	//makes a ui for player / enemy
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
};
