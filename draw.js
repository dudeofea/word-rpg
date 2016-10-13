//
//	DRAWING
//
//	Useful functions for drawing on a function
//
var elem = require('./elem.js');

module.exports = {
	//draw a rectangle with rounded edges of given size
	//thanks to http://stackoverflow.com/a/3368118
	rounded_rect: function(ctx, x, y, w, h, rad, fill){
		ctx.beginPath();
		ctx.moveTo(x + rad, y);									//top left
		ctx.lineTo(x + w - rad, y);								//top right
		ctx.quadraticCurveTo(x + w, y, x + w, y + rad);			//top right corner
		ctx.lineTo(x + w, y + h - rad);							//bottom right
		ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);	//bottom right corner
		ctx.lineTo(x + rad, y + h);								//bottom left
		ctx.quadraticCurveTo(x, y + h, x, y + h - rad);			//bottom left corner
		ctx.lineTo(x, y + rad);									//top left
		ctx.quadraticCurveTo(x, y, x + rad, y);					//top left corner
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
	},

	//draw a rotated rounded_rect (rotation in degrees)
	//note the x and y in this case are the centerpoint of the rect
	rounded_rect_rot: function(ctx, cx, cy, w, h, rad, rot, fill){
		ctx.save();
		//move the rotation point to the center of the rect
	    ctx.translate(cx, cy);
		//...and rotate
		ctx.rotate(rot);
		//draw the rect
		this.rounded_rect(ctx, -w/2, -h/2, w, h, rad, fill);
		//undo everything
		ctx.restore();
	},

	//draw a ring with a certain inner/outer radius
	ring: function(ctx, x, y, rad1, rad2, fill){
		//ensure rad2 > rad1
		if(rad1 > rad2){ rad2 = [rad1, rad1 = rad2][0]; }
		//make a temp canvas
		var tmp_canvas = elem('canvas');
		tmp_canvas.width = 2*rad2;
		tmp_canvas.height = 2*rad2;
		var tmp_ctx = tmp_canvas.getContext('2d');
		//draw the large circle
		tmp_ctx.beginPath();
		tmp_ctx.arc(rad2, rad2, rad2, 0, 2*Math.PI);
		tmp_ctx.fillStyle = fill;
		tmp_ctx.fill();
		//cut out the inner circle
		tmp_ctx.beginPath();
		tmp_ctx.arc(rad2, rad2, rad1, 0, 2*Math.PI);
		tmp_ctx.globalCompositeOperation = "xor";
		tmp_ctx.fill();
		//copy to actual canvas
		ctx.drawImage(tmp_canvas, x-rad2, y-rad2);
	}
}
