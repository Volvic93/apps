#!/usr/bin/env ruby
# Baut die Live-Aktivität („Training läuft“) in das von Capacitor erzeugte Xcode-Projekt ein:
#   - Plugin + eigene Ansicht in das App-Ziel,
#   - eine Widget-Erweiterung (WidgetKit/ActivityKit) als zusätzliches Ziel, in die App eingebettet.
# Aufruf (aus ipa-app/): ruby scripts/add-live-activity.rb
# Läuft nur, wenn ios-prepare.sh mit LIVE_ACTIVITY=1 gestartet wurde. Nicht auf einem Gerät oder Mac getestet.
require 'fileutils'
require 'xcodeproj'

ROOT = File.expand_path('..', __dir__)
IOS = File.join(ROOT, 'ios', 'App')
SRC = File.join(ROOT, 'live-activity')
PROJECT = File.join(IOS, 'App.xcodeproj')
APP_DIR = File.join(IOS, 'App')
WIDGET_DIR = File.join(IOS, 'EisenzeitWidget')
BUNDLE_ID = 'de.eisenzeit.app'
WIDGET_ID = "#{BUNDLE_ID}.LiveActivity"

abort "Xcode-Projekt nicht gefunden: #{PROJECT}" unless File.exist?(PROJECT)

# 1. Dateien an Ort und Stelle kopieren
FileUtils.mkdir_p(WIDGET_DIR)
%w[EisenzeitActivityAttributes.swift].each { |f| FileUtils.cp(File.join(SRC, 'Shared', f), APP_DIR) }
%w[EisenzeitLiveActivityPlugin.swift EisenzeitViewController.swift].each { |f| FileUtils.cp(File.join(SRC, 'App', f), APP_DIR) }
%w[EisenzeitWidgetBundle.swift TrainingLiveActivity.swift Info.plist].each { |f| FileUtils.cp(File.join(SRC, 'Widget', f), WIDGET_DIR) }
FileUtils.cp(File.join(SRC, 'Shared', 'EisenzeitActivityAttributes.swift'), WIDGET_DIR)

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == 'App' } or abort 'Ziel "App" nicht gefunden'

# 2. Dateien dem App-Ziel hinzufügen
app_group = project.main_group.find_subpath('App', true)
refs = %w[EisenzeitActivityAttributes.swift EisenzeitLiveActivityPlugin.swift EisenzeitViewController.swift].map do |f|
  app_group.files.find { |x| x.path == f } || app_group.new_reference(f)
end
app.add_file_references(refs)

# 3. Widget-Erweiterung als neues Ziel
app_config = app.build_configurations.first.build_settings
deployment = '16.2'
# ActivityKit (ActivityAttributes) braucht iOS 16.2 auch im App-Ziel (die Capacitor-Vorlage setzt ein niedrigeres Ziel)
app.build_configurations.each { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment }
widget = project.new_target(:app_extension, 'EisenzeitWidget', :ios, deployment)
widget_group = project.main_group.find_subpath('EisenzeitWidget', true)
widget_group.set_source_tree('SOURCE_ROOT')
widget_group.set_path('EisenzeitWidget')
widget_files = %w[EisenzeitWidgetBundle.swift TrainingLiveActivity.swift EisenzeitActivityAttributes.swift].map { |f| widget_group.new_reference(f) }
widget.add_file_references(widget_files)
widget_group.new_reference('Info.plist')
widget.add_system_framework('WidgetKit')
widget.add_system_framework('SwiftUI')
widget.add_system_framework('ActivityKit')

widget.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = WIDGET_ID
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'EisenzeitWidget/Info.plist'
  s['SWIFT_VERSION'] = '5.0'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = deployment
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['SKIP_INSTALL'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['MARKETING_VERSION'] = app_config['MARKETING_VERSION'] || '1.0'
  s['CURRENT_PROJECT_VERSION'] = app_config['CURRENT_PROJECT_VERSION'] || '1'
  s['CODE_SIGNING_ALLOWED'] = 'NO'
  s['CODE_SIGNING_REQUIRED'] = 'NO'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = ''
end

# 4. Erweiterung in die App einbetten
app.add_dependency(widget)
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
build_file = embed.add_file_reference(widget.product_reference, true)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save

# 5. Info.plist der App: Live-Aktivitäten erlauben; eigene Ansicht im Storyboard
plist = File.join(APP_DIR, 'Info.plist')
system('/usr/libexec/PlistBuddy', '-c', 'Add :NSSupportsLiveActivities bool true', plist) or abort 'Info.plist: NSSupportsLiveActivities fehlgeschlagen'
story = File.join(APP_DIR, 'Base.lproj', 'Main.storyboard')
text = File.read(story)
changed = text.sub('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="EisenzeitViewController" customModule="App"')
abort 'Main.storyboard: CAPBridgeViewController nicht gefunden' if changed == text
File.write(story, changed)
# Capacitor 8 nutzt eine SceneDelegate, die das Hauptfenster selbst erzeugt: dort ebenfalls die eigene Ansicht verwenden.
# (Fehlt die SceneDelegate, nutzt die Vorlage das Storyboard – dann reicht die Änderung oben.)
scene = File.join(APP_DIR, 'SceneDelegate.swift')
if File.exist?(scene)
  code = File.read(scene)
  patched = code.gsub(/\bCAPBridgeViewController\s*\(/, 'EisenzeitViewController(')
  abort 'SceneDelegate.swift: CAPBridgeViewController( nicht gefunden – Plugin würde nicht angemeldet' if patched == code && code !~ /EisenzeitViewController/
  File.write(scene, patched)
  puts 'SceneDelegate.swift angepasst.'
else
  puts 'Keine SceneDelegate.swift – Storyboard-Weg.'
end

puts "Live-Aktivität eingebaut (Widget-Erweiterung #{WIDGET_ID})."
