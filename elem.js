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
	return e;
};
