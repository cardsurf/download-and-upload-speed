#!/bin/bash

applet_name="Download and upload speed"
applet_uuid="download-and-upload-speed@cardsurf"
applet_share="/.local/share/cinnamon/applets/"
applet_file="applet.js"
applet_directory=$HOME$applet_share$applet_uuid

desklet_name="Download and upload speed desklet"
desklet_uuid="download-and-upload-speed-desklet@cardsurf"
desklet_share="/.local/share/cinnamon/desklets/"
desklet_file="desklet.js"
desklet_directory=$HOME$desklet_share$desklet_uuid
desklet_js="$desklet_directory/$desklet_file"

translations="po"
files=".*\.\(js\|json\|po\|pot\|sh\)$"
js_files=".*\.\(js\)$"
assingment="\s*\=\s*"
constructor_arguments="orientation\, panel_height\, "
panel_height="this\.panel_height"
orientation="this\.orientation"
instruction_end=".*\;"


# Copy files
cp -r "$applet_directory/." $desklet_directory

# Rename files
mv "$desklet_directory/$applet_file" $desklet_js
mv "$desklet_directory/$translations/$applet_uuid.pot" "$desklet_directory/$translations/$desklet_uuid.pot"

# Replace applet name
find $desklet_directory -iregex $files | xargs sed -i "s|$applet_name|$desklet_name|"
# Replace applet uuid
find $desklet_directory -iregex $files | xargs sed -i "s|$applet_uuid|$desklet_uuid|"
# Replace appplet share subpath
find $desklet_directory -iregex $files | xargs sed -i "s|$applet_share|$desklet_share|"

# Replace imports
find $desklet_directory -iregex $js_files | xargs sed -i 's|imports.ui.appletManager.applets|imports.ui.deskletManager.desklets|'
sed -i 's|imports.ui.applet|imports.ui.desklet|' $desklet_js
sed -i "s|const Applet$assingment|const Desklet \= |" $desklet_js

# Replace settings
sed -i 's|AppletSettings|DeskletSettings|' $desklet_js

# Replace constructor
sed -i 's|MyApplet|MyDesklet|' $desklet_js
sed -i 's|Applet.Applet|Desklet.Desklet|' $desklet_js
sed -i "s|$constructor_arguments||" $desklet_js

# Replace base methods
sed -i 's|on_applet_clicked|on_desklet_clicked|' $desklet_js
sed -i 's|on_applet_removed_from_panel|on_desklet_removed|' $desklet_js

# Replace variables
sed -i 's|this._applet_context_menu|this._menu|' $desklet_js

# Replace GUI
sed -i 's|this.actor.destroy_all_children();|let box = new St.BoxLayout();|' $desklet_js
sed -i 's|add_gui_speed: function ()|add_gui_speed: function (box)|' $desklet_js
sed -i 's|add_gui_data_limit: function ()|add_gui_data_limit: function (box)|' $desklet_js
sed -i 's|add_gui_speed();|add_gui_speed(box);|' $desklet_js
sed -i 's|add_gui_data_limit();|add_gui_data_limit(box);|' $desklet_js
sed -i 's|add_gui_data_limit(box);|add_gui_data_limit(box);\n\t\tthis.setContent(box);|' $desklet_js
sed -i 's|this.actor.add|box.add|' $desklet_js

# Assign variables
sed -i "0,/\}\,/s/$panel_height$instruction_end/$panel_height \= 50\;/" $desklet_js
sed -i "0,/\}\,/s/$orientation$instruction_end/$orientation \= St\.Side\.BOTTOM\;/" $desklet_js

