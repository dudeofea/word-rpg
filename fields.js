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

module.exports = {
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
		//return an array to draw on a canvas
		comp.render = function(){
			//make two 1d arrays of dimensions width x height
			var arr = Array.apply(null, Array(this.width*this.height)).map(Number.prototype.valueOf, 0);
			var arr_xy = Array.apply(null, Array(this.width*this.height)).map(Number.prototype.valueOf, 0);
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
		};
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
	//a rectangle with uniform value inside, and zero value outside
	rectangle: function(rect, strength){
		var field = {};
		field.run = function(x, y){
			//check if in rectangle or not
			if(x < this.x_min || x > this.x_max || y < this.y_min || y > this.y_max){
				return 0;
			}
			return this.on_value;
		}
		field.x_min = rect.x - rect.w / 2;
		field.x_max = rect.x + rect.w / 2;
		field.y_min = rect.y - rect.h / 2;
		field.y_max = rect.y + rect.h / 2;
		field.on_value = strength;
		return field;
	}
}
