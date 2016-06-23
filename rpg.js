//use the body as our main game window
function init_rpg(){
	//insert character canvas into body
	// var char = gen_character('boa');
	// var char = gen_character('bob');
	var char = gen_character('Zoikostra');
	document.body.appendChild(char);
}

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

//generate a character based off a string
function gen_character(name){
	var hash = Sha256.hash(name);
	var info = {};
	info['name'] = name;
	info['hash'] = hash;
	//stats are:
	//
	//	- STR: physical strength, determines attack strength for punching/smashing/etc
	//	- INT: intelligence, determines (magical) attack strength for beams/spells/etc
	//	- HP: health points
	//
	//	- level up boosts are how much stats grow per level.
	//	  ex: STR_BST, INT_BST, etc
	//
	// --- generate stats
	info['str'] = hash.normalize(0, 4);
	info['int'] = hash.normalize(4, 4);
	info['hp_max'] = hash.normalize(8, 4);

	info['str_bst'] = hash.normalize(12, 4);
	info['int_bst'] = hash.normalize(16, 4);
	info['hp_max_bst'] = hash.normalize(20, 4);
	//TODO: normalize across stats
	normalize_stats(info, ['str', 'int', 'hp_max']);
	//TODO: normalize across stat boosts
	normalize_stats(info, ['str_bst', 'int_bst', 'hp_max_bst']);
	// --- generate graphics
	var canvas = document.createElement('canvas');
	canvas.height = 150;
	canvas.width = 150;
	canvas.className = "rpg-character";
	ctx = canvas.getContext('2d');
	//TODO: pick colors later (some kind of HSL scheme)
	// --- make a basic shape to build on
	var gen_rect = function(hash_pos, scale, center){
		//draw a generated rectangle
		var width = (hash.normalize(hash_pos, 4) + 0.2) * scale;
		var area = Math.pow(scale/2, 2);
		var rect_size = {w: width, h: area/width};
		ctx.fillStyle = "#666";
		ctx.fillRect(
			center.x - rect_size.w/2,
			center.y - rect_size.h/2,
			rect_size.w,
			rect_size.h);
		return {x: center.x, y: center.y, w: rect_size.w, h: rect_size.h};
	};
	var pick_peri = function(hash_pos, rect){
		//pick a point on the perimeter of a rectangle
		var val = hash.normalize(hash_pos, 2);
		//top left is start, we count clockwise
		var wh_sum = rect.w + rect.h;
		var w_frac = rect.w / wh_sum;
		var h_frac = rect.h / wh_sum;
		if(val > 0.5){	//past mid point
			val = (val - 0.5)*2;
			if(val > w_frac){	//in left section
				var pos = rect.h * ((val-w_frac) / h_frac);
				return {x: rect.x - rect.w/2, y: rect.y + rect.h/2 - pos};
			}else{			//in bottom section
				var pos = rect.w * (val / w_frac);
				return {x: rect.x + rect.w/2 - pos, y: rect.y + rect.h/2};
			}
		}else{			//before mid point
			val = (val)*2;
			if(val > w_frac){	//in right section
				var pos = rect.h * ((val-w_frac) / h_frac);
				return {x: rect.x + rect.w/2, y: rect.y - rect.h/2 + pos};
			}else{			//in top section
				var pos = rect.w * (val / w_frac);
				return {x: rect.x - rect.w/2 + pos, y: rect.y - rect.h/2};
			}
		}
	}
	//large main body
	var r1 = gen_rect(21, 60, {x: canvas.width/2, y: canvas.height/2});
	//3 medium appendages
	for (var i = 0; i < 3; i++) {
		var p = pick_peri(15*i + 4, r1);
		var r2 = gen_rect(15*i + 7, 40, p);
	}
	//TODO: draw boosters on left of spaceship by spreading out
	//		a fixed width of "flame" animation, so it shows up as
	//		one big booster or several small ones
	//TODO: draw space backgroud (with neat colors)
	//TODO: draw stars, planets, dust, mist, etc
	// --- draw ship name
	ctx.fillStyle = "#000";
	ctx.font = "10px Arial";
	ctx.textAlign="center";
	ctx.fillText(name,canvas.width/2,12);
	console.log(info);
	return canvas;
}
