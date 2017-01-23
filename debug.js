//
//	DEBUG
//
//	Useful functions for debugging
//

module.exports = {
	//print off a 2d array to the console
	//TODO: use a popup with a canvas for this
	print_array_2d: function(arr, w){
		if(w == null && arr.width != null){
			w = arr.width;
		}
		var w_counter = 0;
		var h_counter = 0;
		var str = h_counter + "\t| ";
		for (var i = 0; i < arr.length; i++) {
			if(arr[i] >= 0){
				str += " ";
			}
			str += " " + Number(arr[i]).toFixed(1);
			w_counter++;
			if(w_counter >= w){
				console.log(str + "|");
				h_counter++;
				w_counter = 0;
				str = h_counter + "\t| ";
			}
		}
		str = "  \t-";
		for (var i = 0; i < w; i++) {
			str += "---";
		}
		console.log(str + "--");
	}
}
