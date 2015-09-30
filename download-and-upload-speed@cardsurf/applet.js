
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

const uuid = 'download-and-upload-speed@cardsurf';
const AppletDirectory = imports.ui.appletManager.applets[uuid];
const AppletGui = AppletDirectory.appletGui;
const AppletConstants = AppletDirectory.appletConstants
const ShellUtils = AppletDirectory.shellUtils;




function MyApplet(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation);

		this.panel_height = panel_height;
		this.orientation = orientation;

		this.bytes_received_previous = 0;
		this.bytes_received_iteration = 0;
		this.bytes_received_total = 0;
		this.bytes_sent_previous = 0;
		this.bytes_sent_iteration = 0;
		this.bytes_sent_total = 0;

		this.network_directory = "/sys/class/net/";
		this.network_interfaces = [];
		this.network_interface = "";
		this.filepath_bytes_received = "";
		this.filepath_bytes_sent = "";
		this.list_connections_command = "";
		this.list_connections_process = null;

		this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
		this.update_every = 1.0;
		this.gui_type = 0;
		this.show_hover = true;
		this.launch_terminal = true;
		this.gui_text_css = "";
		this.gui_received_icon_filename = "";
		this.gui_sent_icon_filename = "";
		this.hover_popup_text_css = "";
		this.hover_popup_numbers_css = "";


		this.applet_gui = null;
		this.menu_item_network = null;
		this.menu_item_gui = null;
		this.hover_popup = null;

		this._bind_settings();
		this._init_network_properties();
		this._init_filename_properties();
		this._init_list_connections_process();
		this._init_menu_item_gui();
		this._init_menu_item_network();
		this._init_hover_popup();
		this._init_gui();

		this.run();
    },

	_bind_settings: function () {
		for(let [binding, property_name, callback] of [
						[Settings.BindingDirection.IN, "update_every", null],
						[Settings.BindingDirection.IN, "launch_terminal", null],
						[Settings.BindingDirection.IN, "list_connections_command", this.on_list_connections_command_changed],
						[Settings.BindingDirection.IN, "show_hover", this.on_show_hover_changed],
						[Settings.BindingDirection.IN, "gui_text_css", this.on_gui_css_changed],
						[Settings.BindingDirection.IN, "gui_received_icon_filename", this.on_gui_icon_changed],
						[Settings.BindingDirection.IN, "gui_sent_icon_filename", this.on_gui_icon_changed],
						[Settings.BindingDirection.IN, "hover_popup_text_css", this.on_hover_popup_css_changed],
						[Settings.BindingDirection.IN, "hover_popup_numbers_css", this.on_hover_popup_css_changed],
                        [Settings.BindingDirection.BIDIRECTIONAL, "gui_type", this.on_interface_type_changed],
						[Settings.BindingDirection.BIDIRECTIONAL, "network_interface", null] ]){
			    this.settings.bindProperty(binding, property_name, property_name, callback, null);
		}
	},

	on_list_connections_command_changed: function () {
		this.list_connections_process.bash_command = this.list_connections_command;
	},

	on_show_hover_changed: function () {
		if(this.show_hover) {
			this.hover_popup.enable();
		}
		else {
			this.hover_popup.disable();
		}
	},

	on_gui_icon_changed: function () {
		this.applet_gui.set_reveived_icon(this.gui_received_icon_filename);
		this.applet_gui.set_sent_icon(this.gui_sent_icon_filename);
		//this.applet_gui.set_icons(this.gui_download_icon_filename, this.gui_upload_icon_filename);
		//this.applet_gui.set_icons(this.gui_text_css);
		////this.applet_gui.set_text_style(this.gui_text_css);
	},

	on_gui_css_changed: function () {
		this.applet_gui.set_text_style(this.gui_text_css);
	},

	on_hover_popup_css_changed: function () {
		this.hover_popup.set_text_style(this.hover_popup_text_css);
		this.hover_popup.set_numbers_style(this.hover_popup_numbers_css);
	},

	on_interface_type_changed: function () {
		this.menu_item_gui.set_active_option(this.gui_type);
		this._init_gui();
	},

	on_applet_clicked: function(event) {
		if(this.launch_terminal) {
			let is_running = this.list_connections_process.is_running();
			if(is_running){
				this.list_connections_process.kill();
			}
			else {
				this.list_connections_process.spawn_async();
			}
		}

		this.close_hover_popup();
	},

	_init_network_properties: function () {
		this.network_interfaces = this._init_network_interfaces();
		this.network_interface = this._init_network_interface();
	},

	_init_network_interfaces: function () {
		let network_interfaces = this.list_network_interfaces();
		network_interfaces = network_interfaces.split('\n');
		network_interfaces.splice(network_interfaces.length - 1, 1);
		return network_interfaces;
	},

    list_network_interfaces: function () {
		let process = new ShellUtils.ShellOutputProcess(['ls', this.network_directory]);
		let output = process.spawn_sync_and_get_output();
		return output;
    },

	_init_network_interface: function () {
		let network_interface = this.settings.getValue("network_interface");
		let is_valid = this.array_contains(this.network_interfaces, network_interface);
		if(!is_valid && this.network_interfaces.length > 0){
			this.network_interface = this.network_interfaces[0];		
		}
		return network_interface;
	},

	array_contains: function (array, element) {
		return array.indexOf(element) > -1;
	},

	_init_filename_properties: function () {
		this.filepath_bytes_received = this.network_directory + this.network_interface + '/statistics/rx_bytes';
		this.filepath_bytes_sent = this.network_directory + this.network_interface + '/statistics/tx_bytes';
	},

	_init_list_connections_process: function () {
		this.list_connections_process = new ShellUtils.TerminalProcess(this.list_connections_command);
		this.list_connections_process.maximized = true;
	},

	_init_menu_item_network: function () {
		this.menu_item_network = new AppletGui.RadioMenuItem("Network interface", this.network_interfaces);
		index = this.network_interfaces.indexOf(this.network_interface);
		this.menu_item_network.set_active_option(index);
		this.menu_item_network.set_callback_option_clicked(this, this.on_menu_item_network_clicked);
		this._applet_context_menu.addMenuItem(this.menu_item_network);
	},

	on_menu_item_network_clicked: function (option_name, option_index) {
		if(this.network_interface != option_name) {
            this.network_interface = option_name;
			this._init_filename_properties();
			this._reset_bytes();
		}
	},

	_reset_bytes: function () {
		this.bytes_received_previous = 0;
		this.bytes_received_iteration = 0;
		this.bytes_received_total = 0;
		this.bytes_sent_previous = 0;
		this.bytes_sent_iteration = 0;
		this.bytes_sent_total = 0;
	},

	_init_menu_item_gui: function () {
		this.menu_item_gui = new AppletGui.RadioMenuItem("Gui", ["Compact", "Large"]);
		this.menu_item_gui.set_active_option(this.gui_type);
		this.menu_item_gui.set_callback_option_clicked(this, this.on_menu_item_gui_clicked);
		this._applet_context_menu.addMenuItem(this.menu_item_gui);
		this._applet_context_menu.connect('open-state-changed', Lang.bind(this, this.on_context_menu_state_changed));
	},

	on_menu_item_gui_clicked: function (option_name, option_index) {
		if(this.gui_type != option_index) {
            this.gui_type = option_index;
			this.on_interface_type_changed();
		}
	},

	on_context_menu_state_changed: function () {
		this.close_hover_popup();
	},

	close_hover_popup: function () {
		this.hover_popup.close();	
	},

    on_panel_height_changed: function() {
		this.panel_height = this.panel.actor.get_height();
		this._init_gui();
    },

	_init_hover_popup: function () {
		this.hover_popup = new AppletGui.HoverMenuTotalBytes(this, this.orientation);
		this.on_hover_popup_css_changed();
	},

	_init_gui: function () {
		this.applet_gui = new AppletGui.AppletGui(this.panel_height, this.gui_type);
		this.actor.destroy_all_children();
		this.actor.add(this.applet_gui.actor, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
		this.on_gui_icon_changed();
		this.on_gui_css_changed();
	},





    run: function () {
		this.update_bytes_received();
		this.update_bytes_sent();

		let received = this.convert_bytes_to_readable_unit(this.bytes_received_iteration);
		let sent = this.convert_bytes_to_readable_unit(this.bytes_sent_iteration);
		let received_total = this.convert_two_decimals(this.bytes_received_total);
		let sent_total = this.convert_two_decimals(this.bytes_sent_total);

		this.applet_gui.set_received_text(received);
		this.applet_gui.set_sent_text(sent);
		this.hover_popup.set_text(received_total, sent_total);

		Mainloop.timeout_add(this.update_every * 1000, Lang.bind(this, this.run));
    },

	update_bytes_received: function () {;
		let bytes_received = this.read_file(this.filepath_bytes_received);
		this.bytes_received_iteration = this.calculate_bytes_difference(bytes_received, this.bytes_received_previous);
		this.bytes_received_previous = bytes_received;
		this.bytes_received_total += this.bytes_received_iteration;
    },

    read_file: function (filepath) {
		let success = false;
		let file_content = "";
		try {
			[success, file_content] = GLib.file_get_contents(filepath);
		}
		catch(exception) { }

		return file_content;
    },	

    calculate_bytes_difference: function (bytes, previous_bytes) {
		let difference = bytes - previous_bytes;
		if(difference < 0 || previous_bytes == 0) {
			difference = 0;
		}
		return difference;
    },

    convert_bytes_to_readable_unit: function (bytes) {
		let [number, unit] = this._convert_to_readable_unit(bytes);
		if(unit != "B") {
			number = this.round_output_number(number);
		}

		let output = number.toString() + unit;
		return output;
    },	

	_convert_to_readable_unit: function (bytes) {
		if(bytes >= 1000000000000) {
			return [bytes/1000000000000, "TB"];
		}
		if(bytes >= 1000000000) {
			return [bytes/1000000000, "GB"];
		}
		if(bytes >= 1000000) {
			return [bytes/1000000, "MB"];
		}
		if(bytes >= 1000) {
			return [bytes/1000, "kB"];
		}
		return [bytes, "B"];
    },

	round_output_number: function (number) {
		if(number > 100) {
			return number.toFixed(0);
		}
		if(number > 10) {
			return number.toFixed(1);
		}
		return number.toFixed(2);
    },

    convert_two_decimals: function (bytes) {
		let [number, unit] = this._convert_to_readable_unit(bytes);
		let output = number.toFixed(2).toString() + " " + unit;
		return output;
    },	

	update_bytes_sent: function () {
		let bytes_sent = this.read_file(this.filepath_bytes_sent);
		this.bytes_sent_iteration = this.calculate_bytes_difference(bytes_sent, this.bytes_sent_previous);
		this.bytes_sent_previous = bytes_sent;
		this.bytes_sent_total += this.bytes_sent_iteration;
    },

};




function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
	return myApplet;
}



