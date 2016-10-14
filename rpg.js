var domready = require("domready");
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
			setTimeout(set_grid, 100);
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
