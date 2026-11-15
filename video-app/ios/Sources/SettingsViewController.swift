import UIKit
import WebKit

/// Einstellungen (Tabelle, insetGrouped, Systemoptik). Änderungen werden sofort in UserDefaults gesichert
/// und über `onSettingsChanged` an die Web-Ansicht weitergegeben.
final class SettingsViewController: UITableViewController {
    var onSettingsChanged: (() -> Void)?
    var onDataCleared: (() -> Void)?
    /// Liefert den Diagnose-Text der Seite (Antwort auf dem Hauptthread).
    var onRequestDiagnostics: ((@escaping (String) -> Void) -> Void)?

    private enum Section: Int, CaseIterable {
        case appearance
        case playback
        case statistics
        case cast
        case data
        case about
    }

    private enum SwitchRow: Int, CaseIterable {
        case adblock
        case background
        case autoPip
        case playerButtons
        case alwaysShowButton
        case airplayMode
    }

    private let appearanceTitles = ["Automatisch", "Hell", "Dunkel"]

    init() {
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) {
        super.init(style: .insetGrouped)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Einstellungen"
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(closeTapped)
        )
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        tableView.reloadData()
    }

    @objc private func closeTapped() {
        dismiss(animated: true, completion: nil)
    }

    // MARK: - Tabelle

    override func numberOfSections(in tableView: UITableView) -> Int {
        return Section.allCases.count
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        guard let kind = Section(rawValue: section) else { return 0 }
        switch kind {
        case .appearance: return appearanceTitles.count
        case .playback: return SwitchRow.allCases.count
        case .statistics: return 2
        case .cast: return 1
        case .data: return 1
        case .about: return 2
        }
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        guard let kind = Section(rawValue: section) else { return nil }
        switch kind {
        case .appearance: return "Darstellung"
        case .playback: return "Werbung und Wiedergabe"
        case .statistics: return "Statistik"
        case .cast: return "Übertragung"
        case .data: return "Daten"
        case .about: return "Info"
        }
    }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        guard let kind = Section(rawValue: section) else { return nil }
        switch kind {
        case .playback:
            return "Bild-in-Bild beim Verlassen ist ein Versuch: iOS erlaubt es nicht in jeder Lage. Die Änderung des Werbeblockers lädt die Seite neu. Der Ersatzknopf erscheint sonst nur, wenn die Seite ihren Menü-Knopf nicht zeigt.

AirPlay-Modus (Versuch): Nötig für AirPlay. YouTube überträgt das Video dann auf andere Art; die Auflösung kann geringer sein. Aus lassen, wenn AirPlay nicht gebraucht wird."
        case .statistics:
            if let error = ContentBlocker.lastError {
                return "Sperrliste nicht geladen: " + error
            }
            return nil
        case .data:
            return "Löscht Anmeldung, Cookies und Zwischenspeicher der Web-Ansicht. Du bist danach bei YouTube abgemeldet."
        default:
            return nil
        }
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        cell.accessoryView = nil
        cell.accessoryType = .none
        cell.selectionStyle = .none

        guard let kind = Section(rawValue: indexPath.section) else { return cell }

        switch kind {
        case .appearance:
            var content = cell.defaultContentConfiguration()
            content.text = appearanceTitles[indexPath.row]
            cell.contentConfiguration = content
            cell.selectionStyle = .default
            if indexPath.row == AppSettings.shared.appearance {
                cell.accessoryType = .checkmark
            }

        case .playback:
            guard let row = SwitchRow(rawValue: indexPath.row) else { return cell }
            var content = cell.defaultContentConfiguration()
            let toggle = UISwitch()
            toggle.tag = row.rawValue
            toggle.addTarget(self, action: #selector(switchChanged(_:)), for: .valueChanged)
            switch row {
            case .adblock:
                content.text = "Werbeblocker"
                toggle.isOn = AppSettings.shared.adblock
            case .background:
                content.text = "Hintergrundwiedergabe"
                toggle.isOn = AppSettings.shared.background
            case .autoPip:
                content.text = "Beim Verlassen automatisch Bild-in-Bild"
                toggle.isOn = AppSettings.shared.autoPip
            case .playerButtons:
                content.text = "Knöpfe im Player"
                toggle.isOn = AppSettings.shared.playerButtons
            case .alwaysShowButton:
                content.text = "Schwebenden Knopf immer anzeigen"
                toggle.isOn = AppSettings.shared.alwaysShowButton
            case .airplayMode:
                content.text = "AirPlay-Modus (Versuch)"
                toggle.isOn = AppSettings.shared.airplayMode
            }
            cell.contentConfiguration = content
            cell.accessoryView = toggle

        case .statistics:
            var content = UIListContentConfiguration.valueCell()
            if indexPath.row == 0 {
                content.text = "Blockierte Werbung"
                content.secondaryText = String(AppSettings.shared.adsBlockedTotal)
            } else {
                content.text = "Sperrliste"
                if ContentBlocker.isLoaded {
                    content.secondaryText = AppSettings.shared.adblock ? "aktiv" : "geladen, aus"
                } else {
                    content.secondaryText = "nicht geladen"
                }
            }
            cell.contentConfiguration = content

        case .cast:
            var content = cell.defaultContentConfiguration()
            content.text = "Übertragungs-Protokoll"
            cell.contentConfiguration = content
            cell.accessoryType = .disclosureIndicator
            cell.selectionStyle = .default

        case .data:
            var content = cell.defaultContentConfiguration()
            content.text = "Browserdaten löschen"
            content.textProperties.color = .systemRed
            cell.contentConfiguration = content
            cell.selectionStyle = .default

        case .about:
            var content = UIListContentConfiguration.valueCell()
            if indexPath.row == 0 {
                content.text = "Version"
                content.secondaryText = versionText()
            } else {
                content.text = "Diagnose"
                cell.accessoryType = .disclosureIndicator
                cell.selectionStyle = .default
            }
            cell.contentConfiguration = content
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        guard let kind = Section(rawValue: indexPath.section) else { return }
        switch kind {
        case .appearance:
            AppSettings.shared.appearance = indexPath.row
            tableView.reloadSections(IndexSet(integer: indexPath.section), with: .none)
            onSettingsChanged?()
        case .cast:
            navigationController?.pushViewController(CastLogViewController(), animated: true)
        case .data:
            confirmClearData()
        case .about:
            if indexPath.row == 1 {
                showDiagnostics()
            }
        default:
            break
        }
    }

    // MARK: - Aktionen

    @objc private func switchChanged(_ sender: UISwitch) {
        guard let row = SwitchRow(rawValue: sender.tag) else { return }
        switch row {
        case .adblock: AppSettings.shared.adblock = sender.isOn
        case .background: AppSettings.shared.background = sender.isOn
        case .autoPip: AppSettings.shared.autoPip = sender.isOn
        case .playerButtons: AppSettings.shared.playerButtons = sender.isOn
        case .alwaysShowButton: AppSettings.shared.alwaysShowButton = sender.isOn
        case .airplayMode: AppSettings.shared.airplayMode = sender.isOn
        }
        onSettingsChanged?()
    }

    private func confirmClearData() {
        let alert = UIAlertController(
            title: "Browserdaten löschen?",
            message: "Du wirst bei YouTube und Google abgemeldet. Das lässt sich nicht rückgängig machen.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel, handler: nil))
        alert.addAction(UIAlertAction(title: "Löschen und abmelden", style: .destructive) { [weak self] _ in
            self?.clearData()
        })
        present(alert, animated: true, completion: nil)
    }

    private func clearData() {
        let store = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        store.removeData(ofTypes: types, modifiedSince: Date(timeIntervalSince1970: 0)) { [weak self] in
            DispatchQueue.main.async {
                self?.onDataCleared?()
                let done = UIAlertController(title: "Erledigt", message: "Die Browserdaten wurden gelöscht, du bist abgemeldet.", preferredStyle: .alert)
                done.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))
                self?.present(done, animated: true, completion: nil)
            }
        }
    }

    private func showDiagnostics() {
        guard let request = onRequestDiagnostics else { return }
        request { [weak self] pageText in
            guard let self = self else { return }
            let blocker = "Sperrliste: " + (ContentBlocker.isLoaded ? "aktiv" : "nicht geladen")
            var text = pageText + "
" + blocker + "
App-Version: " + self.versionText()
            if let error = ContentBlocker.lastError {
                text += "
Sperrliste-Fehler: " + error
            }
            let alert = UIAlertController(title: "Diagnose", message: text, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Kopieren", style: .default) { _ in
                UIPasteboard.general.string = text
            })
            alert.addAction(UIAlertAction(title: "Schließen", style: .cancel, handler: nil))
            self.present(alert, animated: true, completion: nil)
        }
    }

    private func versionText() -> String {
        let info = Bundle.main.infoDictionary
        let version = (info?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (info?["CFBundleVersion"] as? String) ?? "?"
        return version + " (" + build + ")"
    }
}
