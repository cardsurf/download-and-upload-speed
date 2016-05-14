





function ConvertableDate() {
	this._init();
};

ConvertableDate.prototype = {

    _init: function() {
        this.date = new Date();
    },

    add_days: function(days) {
        this.date.setDate(this.date.getDate() + days); 
    },

    to_year_month_day_int: function() {
        return parseInt(this.to_year_month_day_string());
    },
    
    to_year_month_day_string: function() {
		let day = this._prepend_zero_if_single_digit(this.date.getDate().toString());
		let month = this._prepend_zero_if_single_digit((this.date.getMonth() + 1).toString());
		let year = this.date.getFullYear().toString();
        return year + month + day;
    },

    _prepend_zero_if_single_digit: function(number_string) {
		return number_string.length == 1 ? "0" + number_string : number_string;
    },

};




