//use the body as our main game window
function init_rpg(){
	//insert character canvas into body
	var char = gen_character('boa');
	var char = gen_character('bob');
	document.body.appendChild(char);
}

//get a 0 - 1 range from a series of hex characters
String.prototype.normalize = function(start, length){
	var val = this.substring(start, start+length);
	//console.log(val);
	var max = Math.pow(2, length*4) - 1;
	return parseInt(val, 16)/max;
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
	console.log(info);
	//TODO: normalize across stats
	//TODO: normalize across stat boosts
	// --- generate graphics
	var canvas = document.createElement('canvas');
	canvas.height = 500;
	canvas.width = 500;
	return canvas;
}
