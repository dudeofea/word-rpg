//
//	NORMALIZE FUNCTIONS
//
//	Functions related to normalizing data or dealing with normalized
//  data. Usually for stats and other procedurally generated aspects.
//

module.exports = {
	//get a 0 - 1 range from a series of hex characters
	hash: function(hash, start, length){
		var val = hash.substring(start, start+length);
		//console.log(val);
		var max = Math.pow(2, length*4) - 1;
		return parseInt(val, 16)/max;
	},

	//normalize a set of stats in object so they have an average of 1.0
	stats: function(obj, stats){
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
	},

	//linearly interpolate between two values with a 0-1 normalized value
	lerp: function(start, end, value){
		return start + (end - start)*value;
	}
};
