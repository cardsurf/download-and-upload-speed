
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;





function File(path) {
	this._init(path);
};

File.prototype = {

    _init: function(path) {
        this.newline = "\n";
        this.regex_newline = /(?:[\n\r]+)/;
		this.path = path;
        this.file = Gio.file_new_for_path(this.path);
    },

    exists: function() {
		return GLib.file_test(this.path, GLib.FileTest.IS_REGULAR) &&  GLib.file_test(this.path, GLib.FileTest.EXISTS);
    },

    read: function() {
		let array_bytes = this.read_bytes();
		let string = array_bytes.toString();
        let array_strings = string.length == 0 ? [] : string.split(this.regex_newline);
        return array_strings;
    },

    read_bytes: function() {
		let [success, array_bytes] = GLib.file_get_contents(this.path, null, null);
		if(!success) {
             throw ("Unable to read file content. Path to file: " + this.path);
        }
        return array_bytes;
    },

    overwrite: function(array_strings) {
        let string = array_strings.join(this.newline);
		return GLib.file_set_contents(this.path, string, string.length, null);
    },

    create: function() {
        return this.overwrite([]);
    },

    remove: function() {
		return this.file.delete(null, null);
    }
};







function Directory(path) {
	this._init(path);
};

Directory.prototype = {

    _init: function(path) {
        this.separator = "/";
        this.path = path.endsWith(this.separator) ? path : path + this.separator;
        this.directory = Gio.file_new_for_path(this.path); 
    },

    exists: function() {
		return GLib.file_test(this.path, GLib.FileTest.IS_DIR) &&  GLib.file_test(this.path, GLib.FileTest.EXISTS);
    },

    create: function() {
        return this.directory.make_directory(null, null);
    },

    removeIfEmpty: function() {
		return this.directory.delete(null, null);
    }
};



