import UIKit
import WebKit

/// Einstellungen (Tabelle, insetGrouped). Änderungen werden sofort in UserDefaults gesichert
/// und über `onSettingsChanged` an die Web-Ansicht weitergegeben.
final class SettingsViewController: UITableViewController {
    var onSettingsChanged: (() -> Void)?
    var onDataCleared: (() -> Void)?

    private enum Section: Int, CaseIterable {
        case playback
        case statistics
        case data
        case about
    }

    private enum SwitchRow: Int, CaseIterable {
        case adblock
        case background
        case autoPip
    }

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
        case .playback: return SwitchRow.allCases.count
        case .statistics: return 1
        case .data: return 1
        case .about: return 1
        }
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        guard let kind = Section(rawValue: section) else { return nil }
        switch kind {
        case .playback: return "Werbung und Wiedergabe"
        case .statistics: return "Statistik"
        case .data: return "Daten"
        case .about: return "Info"
        }
    }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        guard let kind = Section(rawValue: section) else { return nil }
        switch kind {
        case .playback:
            return "Bild-in-Bild beim Verlassen ist ein Versuch: iOS erlaubt es nicht in jeder Lage. Die Änderung des Werbeblockers lädt die Seite neu."
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
        case .playback:
            guard let row = SwitchRow(rawValue: indexPath.row) else { return cell }
            var content = cell.defaultContentConfiguration()
            let toggle = UISwitch()
            toggle.onTintColor = Theme.accent
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
            }
            cell.contentConfiguration = content
            cell.accessoryView = toggle

        case .statistics:
            var content = UIListContentConfiguration.valueCell()
            content.text = "Blockierte Werbung"
            content.secondaryText = String(AppSettings.shared.adsBlockedTotal)
            cell.contentConfiguration = content

        case .data:
            var content = cell.defaultContentConfiguration()
            content.text = "Browserdaten löschen"
            content.textProperties.color = .systemRed
            cell.contentConfiguration = content
            cell.selectionStyle = .default

        case .about:
            var content = UIListContentConfiguration.valueCell()
            content.text = "Version"
            content.secondaryText = versionText()
            cell.contentConfiguration = content
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if let kind = Section(rawValue: indexPath.section), kind == .data {
            confirmClearData()
        }
    }

    // MARK: - Aktionen

    @objc private func switchChanged(_ sender: UISwitch) {
        guard let row = SwitchRow(rawValue: sender.tag) else { return }
        switch row {
        case .adblock: AppSettings.shared.adblock = sender.isOn
        case .background: AppSettings.shared.background = sender.isOn
        case .autoPip: AppSettings.shared.autoPip = sender.isOn
        }
        onSettingsChanged?()
    }

    private func confirmClearData() {
        let alert = UIAlertController(
            title: "Browserdaten löschen?",
            message: "Du wirst bei YouTube abgemeldet. Das lässt sich nicht rückgängig machen.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel, handler: nil))
        alert.addAction(UIAlertAction(title: "Löschen", style: .destructive) { [weak self] _ in
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
                let done = UIAlertController(title: "Erledigt", message: "Die Browserdaten wurden gelöscht.", preferredStyle: .alert)
                done.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))
                self?.present(done, animated: true, completion: nil)
            }
        }
    }

    private func versionText() -> String {
        let info = Bundle.main.infoDictionary
        let version = (info?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (info?["CFBundleVersion"] as? String) ?? "?"
        return version + " (" + build + ")"
    }
}
