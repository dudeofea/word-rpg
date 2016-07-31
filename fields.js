//
//	FIELDS
//
//	Used in generating defense fields for shields
//	and attack fields for weaponry. Each field has
//	some functions to transform it (translate, scale,
//	etc) which the addon modules would cause.
//

//linearly interpolate between two values with a 0-1 normalized value
function lerp(start, end, value){
	return start + (end - start)*value;
}

module.exports = {
	//for creating composite fields
	composite: function(template){
		var comp = {};
		comp.width = template.elem.width;
		comp.height= template.elem.height;
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
		comp.render = function(){
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
		return comp;
	},
	//a circular blur type thing
	gaussian: function(cx, cy, strength, radius){
		var field = {}
		field.run = function(x, y){
			var posx = x - this.cx;
			var posy = y - this.cy;
			return this.const1*Math.exp(this.const2*(posx*posx + posy*posy));
		}
		field.const1 = strength*255;
		field.const2 = -1/(2*radius*radius);
		field.cx = cx;
		field.cy = cy;
		return field;
	},
	//a blurry arrow type thing
	arrow: {

	}
}
