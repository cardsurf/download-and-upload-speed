
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
const Files = AppletDirectory.files;
const FilesCsv = AppletDirectory.filesCsv;
const Dates = AppletDirectory.dates;






function MyApplet(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation);

		this.panel_height = panel_height;
		this.orientation = orientation;
		this.applet_directory = this._get_applet_directory();
		this.bytes_directory = this.applet_directory + "/bytes/";

		this.bytes_received_previous = 0;
		this.bytes_received_iteration = 0;
		this.bytes_received_session = 0;
		this.bytes_received_last_write = 0;
		this.bytes_received_total = 0;
		this.bytes_sent_previous = 0;
		this.bytes_sent_iteration = 0;
		this.bytes_sent_session = 0;
		this.bytes_sent_last_write = 0;
		this.bytes_sent_total = 0;
		this.bytes_total = 0;

		this.network_directory = "/sys/class/net/";
		this.network_interfaces = [];
		this.network_interface = "";
		this.filepath_bytes_received = "";
		this.filepath_bytes_sent = "";
		this.filepath_bytes_total = "";
        this.file_bytes_received = null;
        this.file_bytes_sent = null;
        this.file_bytes_total = null;
		this.list_connections_command = "";
		this.list_connections_process = null;
		this.data_limit_command_invoked = false;

		this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
		this.update_every = 1.0;
        this.custom_start_date = "";
		this.gui_speed_type = 0;
		this.gui_data_limit_type = 0;
		this.decimal_places = AppletConstants.DecimalPlaces.AUTO;
		this.show_hover = true;
		this.launch_terminal = true;
		this.data_limit_command_enabled = false;
		this.data_limit_command = "";
		this.data_limit = 0;
		this.gui_text_css = "";
		this.gui_received_icon_filename = "";
		this.gui_sent_icon_filename = "";
		this.hover_popup_text_css = "";
		this.hover_popup_numbers_css = "";

		this.gui_speed = null;
		this.gui_data_limit = null;
		this.menu_item_network = null;
		this.menu_item_gui = null;
		this.hover_popup = null;

		this._bind_settings();
        this._connect_signals();
		this._init_network_properties();
		this._init_filename_properties();
        this._init_files();
        this._init_custom_start_date();
		this._init_list_connections_process();
		this._init_menu_item_gui();
		this._init_menu_item_network();
		this._init_hover_popup();
		this._init_gui();
        this._read_bytes_total();

		this.run();
    },

    _get_applet_directory: function() {
		let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
		return directory;
    },

	_bind_settings: function () {
		for(let [binding, property_name, callback] of [
						[Settings.BindingDirection.IN, "update_every", null],
						[Settings.BindingDirection.IN, "launch_terminal", null],
						[Settings.BindingDirection.IN, "list_connections_command", this.on_list_connections_command_changed],
						[Settings.BindingDirection.IN, "write_every", null],
						[Settings.BindingDirection.IN, "bytes_start_time", this.on_bytes_start_time_changed],
						[Settings.BindingDirection.IN, "custom_start_date", this.on_custom_start_date_changed],
						[Settings.BindingDirection.IN, "data_limit_command", null],
						[Settings.BindingDirection.IN, "data_limit", this.on_data_limit_changed],
						[Settings.BindingDirection.IN, "data_limit_command_enabled", this.on_data_limit_changed],
						[Settings.BindingDirection.IN, "decimal_places", this.on_decimal_places_changed],
						[Settings.BindingDirection.IN, "show_hover", this.on_show_hover_changed],
						[Settings.BindingDirection.IN, "gui_data_limit_type", this.on_gui_data_limit_type_changed],
						[Settings.BindingDirection.IN, "gui_text_css", this.on_gui_css_changed],
						[Settings.BindingDirection.IN, "gui_received_icon_filename", this.on_gui_icon_changed],
						[Settings.BindingDirection.IN, "gui_sent_icon_filename", this.on_gui_icon_changed],
						[Settings.BindingDirection.IN, "hover_popup_text_css", this.on_hover_popup_css_changed],
						[Settings.BindingDirection.IN, "hover_popup_numbers_css", this.on_hover_popup_css_changed],
                        [Settings.BindingDirection.BIDIRECTIONAL, "gui_speed_type", this.on_gui_speed_type_changed],
						[Settings.BindingDirection.BIDIRECTIONAL, "network_interface", null] ]){
			    this.settings.bindProperty(binding, property_name, property_name, callback, null);
		}
	},

    _connect_signals: function() {
        global.connect("shutdown", Lang.bind(this, this.on_shutdown));
    },

    on_shutdown: function () {
   	 	this._write_bytes_total();
    },

	on_list_connections_command_changed: function () {
		this.list_connections_process.bash_command = this.list_connections_command;
	},

	on_bytes_start_time_changed: function () {
		if(this.bytes_start_time == AppletConstants.BytesStartTime.START_OF_CURRENT_SESSION) {
			this.set_bytes_total_to_session();
		}
		else {
			this._read_bytes_total();
		}
	},

	on_custom_start_date_changed: function () {
		this._read_bytes_total();
	},

	_init_custom_start_date: function () {
		if(this.custom_start_date.length == 0) {
        	let today = new Dates.ConvertableDate();
		    this.custom_start_date = today.to_year_month_day_string("-");
        }
	},

	on_data_limit_changed: function () {
		this.data_limit_command_invoked = this.data_limit_exceeded() ? true : false;
	},

	data_limit_exceeded: function () {
		let data_limit_bytes = this.convert_data_limit_bytes();
		return this.bytes_total > data_limit_bytes;
    },

	convert_data_limit_bytes: function () {
		return this.data_limit * 1000000;
    },

	on_gui_data_limit_type_changed: function () {
		this.gui_data_limit.set_gui(this.gui_data_limit_type);
	},

	on_decimal_places_changed: function () {
		this.gui_speed.set_decimal_places(this.decimal_places);
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
		this.gui_speed.set_reveived_icon(this.gui_received_icon_filename);
		this.gui_speed.set_sent_icon(this.gui_sent_icon_filename);
	},

	on_gui_css_changed: function () {
		this.gui_speed.set_text_style(this.gui_text_css);
	},

	on_hover_popup_css_changed: function () {
		this.hover_popup.set_text_style(this.hover_popup_text_css);
		this.hover_popup.set_numbers_style(this.hover_popup_numbers_css);
	},

	on_gui_speed_type_changed: function () {
		this.menu_item_gui.set_active_option(this.gui_speed_type);
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
		this.filepath_bytes_total = this.bytes_directory + this.network_interface + '.csv';
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
            this._write_bytes_total();
			this._init_filename_properties();
            this._init_files();
			this._reset_bytes();
		}
	},

	_init_files: function () {
        this.file_bytes_received = new Files.File(this.filepath_bytes_received);
        this.file_bytes_sent = new Files.File(this.filepath_bytes_sent);
		this.file_bytes_total = new FilesCsv.BytesFileCsv(this.filepath_bytes_total);
		if(!this.file_bytes_total.exists()) {
        	this.file_bytes_total.create();
        }
	},

	_reset_bytes: function () {
		this._reset_bytes_previous();
		this._reset_bytes_iteration();
		this._reset_bytes_session();
		this._reset_bytes_last_write();
        this._read_bytes_total();
	},

	_reset_bytes_previous: function () {
		this.bytes_received_previous = 0;
		this.bytes_sent_previous = 0;
	},

	_reset_bytes_iteration: function () {
		this.bytes_received_iteration = 0;
		this.bytes_sent_iteration = 0;
	},

	_reset_bytes_session: function () {
		this.bytes_received_session = 0;
		this.bytes_sent_session = 0;
	},

	_reset_bytes_last_write: function () {
		this.bytes_received_last_write = 0;
		this.bytes_sent_last_write = 0;
	},

	_reset_bytes_total: function () {
		this.bytes_received_total = 0;
		this.bytes_sent_total = 0;
		this.bytes_total = 0;
	},

	_init_menu_item_gui: function () {
		this.menu_item_gui = new AppletGui.RadioMenuItem("Gui", ["Compact", "Large"]);
		this.menu_item_gui.set_active_option(this.gui_speed_type);
		this.menu_item_gui.set_callback_option_clicked(this, this.on_menu_item_gui_clicked);
		this._applet_context_menu.addMenuItem(this.menu_item_gui);
		this._applet_context_menu.connect('open-state-changed', Lang.bind(this, this.on_context_menu_state_changed));
	},

	on_menu_item_gui_clicked: function (option_name, option_index) {
		if(this.gui_speed_type != option_index) {
            this.gui_speed_type = option_index;
			this.on_gui_speed_type_changed();
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
		this.gui_speed = new AppletGui.GuiSpeed(this.panel_height, this.gui_speed_type, this.decimal_places);
		this.gui_data_limit = new AppletGui.GuiDataLimit(this.panel_height, this.gui_data_limit_type);
		this.actor.destroy_all_children();
		this._add_gui_speed();
		this._add_gui_data_limit();
	},

	_add_gui_speed: function () {
		this.actor.add(this.gui_speed.actor, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
		this.on_gui_icon_changed();
		this.on_gui_css_changed();
	},

	_add_gui_data_limit: function () {
		this.actor.add(this.gui_data_limit.actor, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
	},





    run: function () {
		this._run_calculate_speed();
		this._run_write_bytes();
    },

    _run_calculate_speed: function () {
        if(this.update_every > 0) {
            this._calculate_speed();
		    Mainloop.timeout_add(this.update_every * 1000, Lang.bind(this, this._run_calculate_speed));
        }
        else {
		    Mainloop.timeout_add(1000, Lang.bind(this, this._run_calculate_speed));
        }
    },

    _calculate_speed: function () {
		this.update_bytes_received();
		this.update_bytes_sent();
		this.update_bytes_total();

		let received = this.convert_bytes_to_readable_unit(this.bytes_received_iteration);
		let sent = this.convert_bytes_to_readable_unit(this.bytes_sent_iteration);
		let received_total = this.convert_two_decimals(this.bytes_received_total);
		let sent_total = this.convert_two_decimals(this.bytes_sent_total);

		this.gui_speed.set_received_text(received);
		this.gui_speed.set_sent_text(sent);
		this.update_gui_data_limit();
		this.hover_popup.set_text(received_total, sent_total);
		this.invoke_data_limit_command_if_exceeded();
    },

	update_bytes_received: function () {;
		let bytes_received = this.read_file(this.file_bytes_received);
		this.bytes_received_iteration = this.calculate_bytes_difference(bytes_received, this.bytes_received_previous);
		this.bytes_received_previous = bytes_received;
		this.bytes_received_session += this.bytes_received_iteration;
		this.bytes_received_last_write += this.bytes_received_iteration;
		this.bytes_received_total += this.bytes_received_iteration;
    },

    read_file: function (file) {
		let file_content = "";
		try {
			file_content = file.read_chars();
		}
		catch(exception) { 
        }
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
		let output_number = this.decimal_places == AppletConstants.DecimalPlaces.AUTO ?
							this.round_output_number_auto(number) : number.toFixed(this.decimal_places);
		return output_number;
    },

	round_output_number_auto: function (number) {
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
		let bytes_sent = this.read_file(this.file_bytes_sent);
		this.bytes_sent_iteration = this.calculate_bytes_difference(bytes_sent, this.bytes_sent_previous);
		this.bytes_sent_previous = bytes_sent;
		this.bytes_sent_session += this.bytes_sent_iteration;
		this.bytes_sent_last_write += this.bytes_sent_iteration;
        this.bytes_sent_total += this.bytes_sent_iteration;
    },

	update_bytes_total: function () {
		this.bytes_total = this.bytes_received_total + this.bytes_sent_total;
    },

	update_gui_data_limit: function () {
		let percentage = this.is_zero(this.data_limit) ? 0 : this.bytes_total / this.convert_data_limit_bytes();
		percentage = percentage * 100;
		this.gui_data_limit.set_percentage(percentage);
	},

	is_zero: function (number) {
		let decimals = 15;
        let precision = decimals - 1;
		let rounded = number.toFixed(precision);
		let zero = 0.0;
		let zero = zero.toFixed(precision);
		return rounded == zero;
	},

	invoke_data_limit_command_if_exceeded: function () {
		if(!this.data_limit_command_invoked && this.data_limit_command_enabled && this.data_limit_exceeded()) {
			this.invoke_data_limit_command();
			this.data_limit_command_invoked = true;
		}
    },

	invoke_data_limit_command: function () {
		let terminal_process = new ShellUtils.TerminalProcess(this.data_limit_command);
		terminal_process.maximized = true;
		terminal_process.spawn_async();
    },

    _run_write_bytes: function () {
        if(this.write_every > 0) {
       	 	this._write_bytes_total();
		    Mainloop.timeout_add(this.write_every * 1000, Lang.bind(this, this._run_write_bytes));
        }
        else {
		    Mainloop.timeout_add(1000, Lang.bind(this, this._run_write_bytes));
        }
    },

	set_bytes_total_to_session: function () {
        this.bytes_received_total = this.bytes_received_session;
	    this.bytes_sent_total = this.bytes_sent_session;
        this.bytes_total = this.bytes_received_total + this.bytes_sent_total;
	},

	calculate_bytes_total: function () {
        this.bytes_received_total = this.bytes_received_session;
	    this.bytes_sent_total = this.bytes_sent_session;
	},

    _read_bytes_total: function() {
		try {
			this._read_bytes_total_file();
            this.add_last_write_bytes_to_total();
		}
        catch (exception) {
		}
    },

    _read_bytes_total_file: function() {
		let date_from = this._get_bytes_start_date_int();
		let rows = this.file_bytes_total.get_byte_rows();
		this._reset_bytes_total();

		for (let i = rows.length - 1; i >= 0; --i) {
		   let row = rows[i];
		   if(row.date >= date_from) {
				this.bytes_received_total += row.bytes_received;
				this.bytes_sent_total += row.bytes_sent;
		   }
		   else {
			   break;
		   }
		}
    },

	_get_bytes_start_date_int: function () {
        if(this.bytes_start_time == AppletConstants.BytesStartTime.CUSTOM_DATE) {
			return this._get_custom_start_date_int();
		}

		let today = new Dates.ConvertableDate();
        let days = this.bytes_start_time;
        today.add_days(-1 * days);
        return today.to_year_month_day_int();
	},

	_get_custom_start_date_int : function () {
        let date_string = this.custom_start_date.trim().replace(/-/g, "");
        let date_int =  parseInt(date_string);
		if(!isNaN(date_int)){
            return date_int;
		}
		throw("Failed to parse custom start date to integer");
	},

	add_last_write_bytes_to_total: function () {
        this.bytes_received_total += this.bytes_received_last_write;
	    this.bytes_sent_total += this.bytes_sent_last_write;
        this.bytes_total = this.bytes_received_total + this.bytes_sent_total;
	},

    _write_bytes_total: function() {
		try {
		    if(this.write_every > 0) {
				this._write_bytes_total_file();
			 	this._reset_bytes_last_write();
		    }
        }		
        catch(exception) {
        }
    },

    _write_bytes_total_file: function() {
		let rows = this.file_bytes_total.get_byte_rows();
        if(rows.length > 0) {
            rows = this._update_or_append_row(rows);
        }
        else {
	        rows = this._add_row(rows);
        }
        this.file_bytes_total.overwrite(rows);
    },

    _update_or_append_row: function(rows) {
         let today = new Dates.ConvertableDate().to_year_month_day_int();
         let last = rows[rows.length - 1];
         if(last.date == today) {
              last.bytes_received += this.bytes_received_session;
              last.bytes_sent += this.bytes_sent_session;
              rows[rows.length - 1] = last;
         }
		 else {
			rows = this._add_row(rows);                
         }
         return rows;
    },

    _add_row: function(rows) {
        let today = new Dates.ConvertableDate().to_year_month_day_int();
        let row = new FilesCsv.BytesRowCsv(today, this.bytes_received_session, this.bytes_sent_session);
	    rows.push(row);           
		return rows;
    },

};














function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
	return myApplet;
}



