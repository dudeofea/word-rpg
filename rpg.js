var domready = require("domready");
var convert = require('color-convert');

//use the body as our main game window
domready(function init_rpg(){
	//insert canvases into body
	var names = ['Zoikostra', 'Garanthuur', 'Ijiklin', 'Bolom', 'Septfire', 'Thalanmir', 'Wawok', 'The Unamed One', 'Greysbane', 'Furyton', 'Rhyolsteros', 'Hastesfas'];
	for (var i = 0; i < names.length; i++) {
		var char = gen_ship(names[i]);
		document.body.appendChild(char);
	}
});

//get a 0 - 1 range from a series of hex characters
String.prototype.normalize = function(start, length){
	var val = this.substring(start, start+length);
	//console.log(val);
	var max = Math.pow(2, length*4) - 1;
	return parseInt(val, 16)/max;
}

//normalize a set of stats in object
function normalize_stats(info, stats){
	var avg = 0;
	//get average
	for (var i = 0; i < stats.length; i++) {
		avg += info[stats[i]];
	}
	avg /= stats.length;
	//normalize
	for (var i = 0; i < stats.length; i++) {
		info[stats[i]] /= avg;
	}
}

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

//generate a ship based off a string
function gen_ship(name){
	var hash = Sha256.hash(name);
	var info = {};
	info['name'] = name;
	info['hash'] = hash;
	//stats are:
	//
	//	- HP: max health points, represents the ship integrity
	//	- ENRG: max energy levels, energy is used to perform actions. if you run out you essentially die
	//	- THRP: throughput, how much energy the ship can source in a turn
	//
	//	- level up boosts are how much stats grow per level.
	//	  ex: HP_BST, etc
	//
	// --- generate stats
	info['e_max'] = hash.normalize(0, 4);
	info['thrp'] = hash.normalize(4, 4);
	info['hp_max'] = hash.normalize(8, 4);

	info['e_max_bst'] = hash.normalize(12, 4);
	info['thrp_bst'] = hash.normalize(16, 4);
	info['hp_max_bst'] = hash.normalize(20, 4);
	//normalize across stats
	normalize_stats(info, ['e_max', 'thrp', 'hp_max']);
	//normalize across stat boosts
	normalize_stats(info, ['e_max_bst', 'thrp_bst', 'hp_max_bst']);
	// --- generate graphics
	var canvas = document.createElement('canvas');
	canvas.height = 200;
	canvas.width = 200;
	canvas.className = "rpg-character";
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
	//background
	ctx.fillStyle = color2;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	//large main body
	var rects = [];
	var peris = [];
	rects.push(gen_rect(21, 75, {x: canvas.width/2, y: canvas.height/2}));
	//3 medium appendages
	for (var i = 0; i < 3; i++) {
		var val = hash.normalize(15*i + 4, 2);
		var val_good = false;
		while(!val_good){
			val_good = true;
			for (var j = 0; j < peris.length; j++) {
				if(Math.abs(peris[j] - val) < 0.1){
					console.log(peris[j], val);
					val += 0.1;
					if(val > 1.0){ val -= 1.0; }
					val_good = false;
				}
			}
		}
		peris.push(val);
		var p = pick_peri(val, rects[0]);
		rects.push(gen_rect(15*i + 7, 40, p, p.o));
		//TODO: find rects that are too skinny and on corners and push them
		//		into the main rectangle
	}
	draw_rects(rects);
	//TODO: draw boosters on left of spaceship by spreading out
	//		a fixed width of "flame" animation, so it shows up as
	//		one big booster or several small ones
	//TODO: draw space backgroud (with neat colors)
	//TODO: draw stars, planets, dust, mist, etc
	// --- draw ship name
	ctx.fillStyle = "#FFF";
	ctx.font = "10px Arial";
	ctx.textAlign="center";
	ctx.fillText(name,canvas.width/2,12);
	console.log(info);
	return canvas;
}
