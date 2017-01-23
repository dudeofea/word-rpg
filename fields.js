//
//	FIELDS
//
//	Used in generating defense fields for shields
//	and attack fields for weaponry. Each field has
//	some functions to transform it (translate, scale,
//	etc) which the addon modules would cause.
//
//	A static field is special in that it cannot be
//  modified by transforms, it's basically just an
//  array with some additional info.

var normalize = require('./normalize.js');

var fields_module = {
	//for drawing multiple fields onto a grid
	composite: function(size){
		var comp = {};
		comp.width = size.w;
		comp.height= size.h;
		comp.fields = [];
		comp.transforms = [];
		comp.addField = function(f){
			this.fields.push(f)
		};
		comp.addTransform = function(t){
			return this.transforms.push(t) - 1;
		}
		//animate a transform over a set number of frames
		comp.animateTransform = function(ind, f_count){
			var frames = [];
			//similar to render function
			for (var f = 0; f < f_count; f++) {
				var lerp_val = (f+1)/f_count;
				var arr = Array.apply(null, Array(this.width*this.height)).map(Number.prototype.valueOf, 0);
				var arr_xy = Array.apply(null, Array(this.width*this.height)).map(Number.prototype.valueOf, 0);
				//build array of xy points
				for (var y = 0; y < this.height; y++) {
					var off = this.width * y;
					for (var x = 0; x < this.width; x++) {
						arr_xy[off + x] = [x, y];
					}
				}
				//apply transforms to xy points
				for (var i = 0; i < this.transforms.length; i++) {
					for (var j = 0; j < arr_xy.length; j++) {
						if(i == ind){
							var xy = this.transforms[i].run(arr_xy[j]);
							arr_xy[j] = [lerp(arr_xy[j][0], xy[0], lerp_val), lerp(arr_xy[j][1], xy[1], lerp_val)]
						}else{
							arr_xy[j] = this.transforms[i].run(arr_xy[j]);
						}

					}
				}
				//run through fields
				for (var i = 0; i < this.fields.length; i++) {
					for (var j = 0; j < arr_xy.length; j++) {
						arr[j] += this.fields[i].run(arr_xy[j][0], arr_xy[j][1]);
					}
				}
				frames.push(arr);
			}
			//return all frames
			return frames;
		}
		//return a static field to draw on a canvas or manipulate
		comp.render = function(){
			//make two 1d arrays of dimensions width x height
			var arr_xy = Array.apply(null, Array(this.width*this.height)).map(Number.prototype.valueOf, 0);
			var arr =fields_module.static({w: this.width, h: this.height});
			//build array of xy points
			for (var y = 0; y < this.height; y++) {
				var off = this.width * y;
				for (var x = 0; x < this.width; x++) {
					arr_xy[off + x] = [x, y];
				}
			}
			//TODO: fix this so we can use transforms that also modify the output value and not just the x/y points
			//apply transforms to xy points
			for (var i = 0; i < this.transforms.length; i++) {
				for (var j = 0; j < arr_xy.length; j++) {
					arr_xy[j] = this.transforms[i].run(arr_xy[j]);
				}
			}
			//run through fields
			for (var i = 0; i < this.fields.length; i++) {
				for (var j = 0; j < arr_xy.length; j++) {
					arr[j] += this.fields[i].run(arr_xy[j][0], arr_xy[j][1]);
				}
			}
			return arr;
		}
		//make a separate copy
		comp.clone = function(){
			var new_comp = JSON.parse(JSON.stringify(comp));
			//copy fucntions
			new_comp.addField = comp.addField;
			new_comp.addTransform = comp.addTransform;
			new_comp.animateTransform = comp.animateTransform;
			new_comp.render = comp.render;
			//copy fields
			new_comp.fields = [];
			for (var i = 0; i < comp.fields.length; i++) {
				new_comp.fields.push(comp.fields[i]);
			}
			//copy transforms
			new_comp.transforms = [];
			for (var i = 0; i < comp.transforms.length; i++) {
				new_comp.transforms.push(comp.transforms[i]);
			}
			return new_comp;
		}
		return comp;
	},
	//for drawing non-transformable (static) fields, AKA arrays
	//other fields can only be added directly to the array
	static: function(size, array){
		var sta = Array.apply(null, Array(size.w*size.h)).map(Number.prototype.valueOf, 0);
		//if we have an array, copy over what we can
		if(array != null){
			var l = Math.min(sta.length, array.length);
			for (var i = 0; i < l; i++) {
				sta[i] = array[i];
			}
		}
		sta.width = size.w;
		sta.height= size.h;
		//add a new field to array (this)
		sta.addField = function(f){
			//just use standard x,y points with no transforms
			for (var y = 0; y < this.height; y++) {
				var off = this.width * y;
				for (var x = 0; x < this.width; x++) {
					this[off + x] += f.run(x, y);
				}
			}
			return this;
		};
		//sort of like addition, but only sets spots instead of adding them
		sta.unionField = function(f){
			//just use standard x,y points with no transforms
			for (var y = 0; y < this.height; y++) {
				var off = this.width * y;
				for (var x = 0; x < this.width; x++) {
					var val = f.run(x, y);
					if(val != 0){
						this[off + x] = val;
					}
				}
			}
			return this;
		};
		//multiply every point by a scalar
		sta.mul = function(mul){
			for (var y = 0; y < this.height; y++) {
				var off = this.width * y;
				for (var x = 0; x < this.width; x++) {
					this[off + x] *= mul;
				}
			}
			return this;
		}
		//perform dot product of two static fields (assumes the same size)
		sta.dot = function(sta2){
			var new_sta = this.clone();
			for (var i = 0; i < this.length; i++) {
				new_sta[i] = this[i] * sta2[i];
			}
			return new_sta;
		}
		//returns all values less than a certain value
		sta.lessThan = function(val){
			var new_sta = this.clone();
			for (var i = 0; i < new_sta.length; i++) {
				if(new_sta[i] >= val){
					new_sta[i] = 0;
				}
			}
			return new_sta;
		}
		//get sum of the whole array
		sta.sum = function(){
			var sum = 0;
			for (var i = 0; i < this.length; i++) {
				sum += this[i]
			}
			return sum;
		}
		//for rounding values to nearest integer
		sta.round = function(){
			for (var y = 0; y < this.height; y++) {
				var off = this.width * y;
				for (var x = 0; x < this.width; x++) {
					this[off + x] = Math.round(this[off + x]);
				}
			}
			return this;
		}
		//it is a field afterall!
		sta.run = function(x, y){
			return this[this.width*y + x];
		}
		//deep clone of the static field
		sta.clone = function(){
			//copy data
			var new_sta = this.slice();
			new_sta.width = this.width;
			new_sta.height= this.height;
			//copy functions
			new_sta.addField = this.addField;
			new_sta.unionField = this.unionField;
			new_sta.clone = this.clone;
			new_sta.mul = this.mul;
			new_sta.lessThan = this.lessThan;
			new_sta.sum = this.sum;
			new_sta.round = this.round;
			new_sta.run = this.run;
			new_sta.dot = this.dot;
			return new_sta;
		};
		return sta;
	},
	//a circular blur type thing
	gaussian: function(cx, cy, strength, radius){
		var field = {};
		field.run = function(x, y){
			var posx = x - this.cx;
			var posy = y - this.cy;
			return this.const1*Math.exp(this.const2*(posx*posx + posy*posy));
		}
		field.const1 = strength;
		field.const2 = -1/(2*radius*radius);
		field.cx = cx;
		field.cy = cy;
		return field;
	},
	//a rectangle centered at (x,y) with uniform value inside, and zero value outside
	rectangle: function(rect, strength){
		var bb = {};
		bb.x_min = rect.x - rect.w / 2;
		bb.x_max = rect.x + rect.w / 2;
		bb.y_min = rect.y - rect.h / 2;
		bb.y_max = rect.y + rect.h / 2;
		return this.bounding_box(bb, strength);
	},
	//a bounding box with a size value inside of min/max x and y, and zero outside
	bounding_box: function(bb, strength){
		var field = {};
		field.run = function(x, y){
			//check if in rectangle or not
			if(x < this.x_min || x > this.x_max || y < this.y_min || y > this.y_max){
				return 0;
			}
			return this.on_value;
		}
		field.x_min = bb.x_min;
		field.x_max = bb.x_max;
		field.y_min = bb.y_min;
		field.y_max = bb.y_max;
		field.on_value = strength;
		return field;
	}
}

module.exports = fields_module;
