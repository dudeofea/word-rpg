//
//	ELEMENTS
//
//	Convenience functions to create elements
//
module.exports = function(tag, cla, content){
	//create the element
	var e = document.createElement(tag);
	if(cla){
		e.className = cla;
	}
	if(typeof content != "undefined"){
		e.innerHTML = content;
	}
	//add custom functions
	e.addClass = function(name){
		if(this.className.indexOf(name) !== -1){
			return;
		}
		this.className += " " + name;
	}
	e.removeClass = function(name){
		//TODO: use regex to replace all instances of name in class
	}
	//clone node override to copy canvas contents
	e.regularCloneNode = e.cloneNode;
	e.cloneNode = function(deep){
		var cloned = this.regularCloneNode(deep);
		if(this.tagName == "CANVAS"){
			//copy old contents onto new canvas
			var ctx = cloned.getContext('2d');
			ctx.drawImage(this, 0, 0);
		}
		return cloned;
	}
	return e;
};
//
//	extra functions
//

//check if an element is within an element with a certain class
module.exports.withinClass = function(el, cla){
	//check if cla in className
	if(el.className && el.className.indexOf(cla) >= 0){
		return true;
	}
	if(!el.parentNode){
		return false;
	}
	return this.withinClass(el.parentNode, cla);
}
