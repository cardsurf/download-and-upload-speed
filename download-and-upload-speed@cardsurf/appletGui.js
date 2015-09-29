
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;

const uuid = 'download-and-upload-speed@cardsurf';
const AppletDirectory = imports.ui.appletManager.applets[uuid];
const AppletConstants = AppletDirectory.appletConstants;
const CssStylization = AppletDirectory.cssStylization;




function IconLabel() {
	this._init();
};

IconLabel.prototype = {
    _init: function() {
		this.actor = new St.BoxLayout();
		this.icon = new St.Icon();
		this.label = new St.Label();

		this.actor.add(this.icon);
		this.actor.add(this.label);
    },

    set_gicon: function(file_icon) {
		this.icon.set_gicon(file_icon);
    },

    set_icon_size: function(size) {
		this.icon.set_icon_size(size);
    },

	set_label_style: function(css_style) {
		this.label.set_style(css_style);
	},

	set_label_width: function(width) {
		this.label.set_width(width);
	},

	set_label_text: function(text) {
		this.label.set_text(text);
	},

	set_label_to_preferred_width: function() {
		this.set_label_width(-1);
	},

	set_label_fixed_width: function(fixed_width_text) {
        Mainloop.timeout_add(1, Lang.bind(this, function() {
			let text = this.label.get_text();
			this.set_label_to_preferred_width();
			this.set_label_text(fixed_width_text);
			let fixed_width = this.label.get_width();
			this.set_label_width(fixed_width);
			this.set_label_text(text);
        	return false;
        }));
	},

};








function AppletGui(panel_height, interface_type) {
	this._init(panel_height, interface_type);
};

AppletGui.prototype = {

    _init: function(panel_height, interface_type) {

		this.panel_height = panel_height;
		this.interface_type = interface_type;

		this.actor = new St.BoxLayout();
		this.iconlabel_received = new IconLabel();
		this.iconlabel_sent = new IconLabel();
	    this.css_styler = new CssStylization.CssStringStyler();

		this._init_actor();
		this._init_icons();
    },

	_init_actor: function() {
		if(this.interface_type == AppletConstants.GuiType.COMPACT) {
			this.actor.set_vertical(true);
		}
		this.actor.add(this.iconlabel_received.actor);
		this.actor.add(this.iconlabel_sent.actor);
	},

	_init_icons: function() {
		for(let [iconlabel, icon_name] of [ [this.iconlabel_received, "arrow_down.svg"], 
											[this.iconlabel_sent, "arrow_up.svg"] ]){
			let icon_file = this._load_icon_file(icon_name);
       	    iconlabel.set_gicon(icon_file);
		}
	},

    _load_icon_file: function(icon_name) {
		let icon_directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/icons/";
		let icon_path = icon_directory + icon_name;
        let icon_file = Gio.file_new_for_path(icon_path);
        let icon_file = new Gio.FileIcon({ file: icon_file });
		return icon_file;
    },

    set_text_style: function(css_style) {
		css_style = this.add_font_size(css_style);
		for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
			iconlabel.set_label_style(css_style);
		}
		
		this._resize_gui_elements_to_match_text(css_style);
    },

    add_font_size: function(css_style) {
		let font_size = this.css_styler.get_numeric_value_or_null(css_style, "font-size");
		if(font_size == null) {
			css_style = this._calculate_font_size_and_add(css_style);
		}
		return css_style;
    },

    _calculate_font_size_and_add: function(css_style) {
		let font_size = this._calculate_font_size();
		let attributes = ["font-size: " + font_size + "px"];
		css_style = this.css_styler.set_attributes(css_style, attributes);
		return css_style;
    },

    _calculate_font_size: function() {
		return this.interface_type == AppletConstants.GuiType.COMPACT ?
			   (this.panel_height * 0.5) - 5 : (this.panel_height * 0.6) - 5;
    },

    _resize_gui_elements_to_match_text: function(css_style) {
		this._set_icons_height_to_font_size(css_style);
		this._set_labels_width_fixed_or_styled(css_style);
    },

    _set_icons_height_to_font_size: function(css_style) {
		let font_size = this.css_styler.get_numeric_value_or_null(css_style, "font-size");
		for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
			iconlabel.set_icon_size(font_size);
		}
    },

    _set_labels_width_fixed_or_styled: function(css_style) {
		let width = this.css_styler.get_numeric_value_or_null(css_style, "width");
		if(width == null) {
			this._set_labels_fixed_width();
		}
		else {
			this._set_labels_styled_width(width);
		}
    },

    _set_labels_fixed_width: function() {
		let label_fixed_width_text = "99.9MB";
		for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
			iconlabel.set_label_fixed_width(label_fixed_width_text);
		}
    },

    _set_labels_styled_width: function(width) {
		for(let iconlabel of [this.iconlabel_received, this.iconlabel_sent]){
			iconlabel.set_label_width(width);
		}
    },

    set_received_text: function(text) {
		let label = this.iconlabel_received.label;
		label.set_text(text);
    },

    set_sent_text: function(text) {
		let label = this.iconlabel_sent.label;
		label.set_text(text);
    }

};






function RadioMenuItem(title, option_names) {
	this._init(title, option_names);
};

RadioMenuItem.prototype = {
	__proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(title, option_names) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, title, false);
		
		this.options = [];
		this.active_option_index = -1;
		this.callback_object = null;
		this.callback_option_clicked = null;
		this._init_options(option_names);
    },

	_init_options: function(option_names) {
		for(let option_name of option_names) {
			 let option = new PopupMenu.PopupMenuItem(option_name, false);
			 option.connect('activate', Lang.bind(this, this._on_option_clicked));
			 this.menu.addMenuItem(option);
			 this.options.push(option);
		}
	},

	_on_option_clicked: function (option, event) {
		let index_clicked = this.options.indexOf(option);
		this.set_active_option(index_clicked);
		this._invoke_callback_option_clicked();
	},

	set_active_option: function(index) {
		if(this.active_option_index != index) {
			if(this.active_option_index != -1) {
				this.set_font_weight(this.active_option_index, "normal");
			}
			this.set_font_weight(index, "bold");
			this.active_option_index = index;		
		}
	},

	set_font_weight: function(option_index, font_weight) {
		let css_style = "font-weight: " + font_weight + ";";
		let option = this.options[option_index];
		this.set_option_style(option, css_style);
	},

	set_option_style: function(option, css_style) {
		option.label.set_style(css_style);
	},

	_invoke_callback_option_clicked: function() {
		if(this.callback_option_clicked != null) {
			let option = this.get_active_option();
			let option_name = this.get_option_name(option);
			this.callback_option_clicked.call(this.callback_object, option_name, this.active_option_index); 
		}
	},
	
	get_active_option: function() {
		return this.options[this.active_option_index];
	},

	get_option_name: function(option) {
		return option.label.get_text();
	},

	get_active_option_index: function(active_option_index) {
		return this.active_option_index;
	},

	set_callback_option_clicked: function(callback_object, callback_option_clicked) {
		this.callback_object = callback_object;
		this.callback_option_clicked = callback_option_clicked;
	},
};








function HoverMenuTotalBytes(applet, orientation){
    this._init(applet, orientation);
}

HoverMenuTotalBytes.prototype={

    _init: function(applet, orientation) {

		this.applet = applet;
        this.orientation = orientation;

		this.default_handler_id = 0;
		this.enter_handler_id = this.default_handler_id;
		this.leave_handler_id = this.default_handler_id;

	    this.menu = new Applet.AppletPopupMenu(applet, this.orientation);
		this.actor = new St.Table({style_class: "switcher-list"});
		this.label_text_received = new St.Label();
		this.label_bytes_received = new St.Label();
		this.label_text_sent = new St.Label();
		this.label_bytes_sent = new St.Label();

		this._init_labels();
		this._init_actor();
		this._init_menu();
		this._add_menu_to_applet();
		this.enable();
    },

	_init_labels: function(){
		this.label_text_received.set_text("Total download:");
		this.label_text_sent.set_text("Total upload:");
	},

	set_text_style: function(css_style) {
		this._set_widgets_style(css_style, [this.label_text_received, this.label_text_sent]);
	},

	set_numbers_style: function(css_style) {
		this._set_widgets_style(css_style, [this.label_bytes_received, this.label_bytes_sent]);
	},

	_set_widgets_style: function(css_style, widgets){
		css_style = this._append_semicolon(css_style);
		for(let widget of widgets){
			widget.set_style(css_style);
		}
	},

	_append_semicolon: function(css_style){
		css_style = css_style.trim();
		last_char = css_style.slice(-1);
		semicolon = ';';
		if (last_char != semicolon) {
			css_style += semicolon;
		}
		return css_style;
	},

	_init_actor: function(){
		this.actor.add(this.label_text_received, {row: 0, col: 0});
		this.actor.add(this.label_bytes_received, {row: 0, col: 1});
		this.actor.add(this.label_text_sent, {row: 1, col: 0});
		this.actor.add(this.label_bytes_sent, {row: 1, col: 1});
	},

	_init_menu: function(){
		this.menu.box.style_class = null;
		this.menu.addActor(this.actor);
	},

	_add_menu_to_applet: function(){
        this.menuManager = new PopupMenu.PopupMenuManager(this.applet);
		this.menuManager.addMenu(this.menu);
	},

	enable: function(){
		this._connect_hover_signals();
	},

	disable: function(){
		this._disconnect_hover_signals();
	},

	_connect_hover_signals: function(){
		if(!this._hover_handlers_connected()) {
			let applet_actor = this.applet.actor;
			this.enter_handler_id = applet_actor.connect("enter-event", Lang.bind(this, this._on_hover_enter));
			this.leave_handler_id = applet_actor.connect("leave-event", Lang.bind(this, this._on_hover_leave));
		}
	},

	_hover_handlers_connected: function(){
		return this.enter_handler_id != this.default_handler_id &&
			   this.leave_handler_id != this.default_handler_id;
	},

	_disconnect_hover_signals: function(){
		let applet_actor = this.applet.actor;
		applet_actor.disconnect(this.enter_handler_id);
		applet_actor.disconnect(this.leave_handler_id);
		this._set_default_id_hover_handlers();
	},

	_set_default_id_hover_handlers: function(){
		this.enter_handler_id = this.default_handler_id;
		this.leave_handler_id = this.default_handler_id;
	},

	_on_hover_enter: function(){
		this.open();
	},

	_on_hover_leave: function(){
		this.close();
	},

	open: function(){
		this.menu.open();
	},

	close: function(){
		this.menu.close();
	},

	set_text: function(received_total, sent_total){
		this.label_bytes_received.set_text(received_total.toString());
		this.label_bytes_sent.set_text(sent_total.toString());
	},

}


