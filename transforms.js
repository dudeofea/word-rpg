//
//	TRANSFORMS
//
//	Used to apply a transform to a field
//	or set of fields. Items use transforms
//	to produce their intended effect
//
module.exports = {
	//make a field bigger / smaller from center of grid
	scale: function(cx, cy, scale){
		var tr = {type: 'scale'};
		tr.run = function(xy){
			return [(xy[0] - this.cx)/scale + this.cx, (xy[1] - this.cy)/scale + this.cy];
		}
		tr.cx = cx;
		tr.cy = cy;
		tr.scale = scale;
		return tr;
	},
	//move a field over by some amount
	translate: function(tx, ty){
		var tr = {type: 'translate'};
		tr.run = function(xy){
			return [xy[0] - this.tx, xy[1] - this.ty];
		}
		tr.tx = tx;
		tr.ty = ty;
		return tr;
	}
}
