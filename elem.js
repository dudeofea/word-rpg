//
//	ELEMENTS
//
//	Convenience functions to create elements
//
module.exports = function(tag, cla, content){
	var e = document.createElement(tag);
	if(cla){
		e.className = cla;
	}
	if(typeof content != "undefined"){
		e.innerHTML = content;
	}
	return e;
};
