import UIKit

/// Blatt „Übertragen“: Geräte im WLAN, TV-Code, zuletzt verbunden; verbunden: Steuerung.
final class CastSheetViewController: UITableViewController {
    private enum Row {
        case searching
        case device(CastDevice)
        case tvCode
        case recent(CastRecentScreen)
        case connecting(String)
        case connectedName(String)
        case pause
        case resume
        case sendCurrent
        case disconnect
    }

    private struct SectionModel {
        var title: String?
        var footer: String?
        var rows: [Row]
    }

    private let manager = CastManager.shared
    private let discovery = CastDiscovery()
    private var sections: [SectionModel] = []
    private var devices: [CastDevice] = []
    private var hint: String?
    private var isVisible = false
    private var searchTimedOut = false
    private var searchToken = 0

    init() {
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) {
        super.init(style: .insetGrouped)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Übertragen"
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(closeTapped)
        )
        discovery.onUpdate = { [weak self] list, hint in
            guard let self = self else { return }
            self.devices = list
            self.hint = hint
            self.refresh()
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        isVisible = true
        manager.sheetUpdate = { [weak self] in
            self?.refresh()
        }
        manager.sheetError = { [weak self] text in
            self?.showError(text)
        }
        searchTimedOut = false
        searchToken += 1
        let token = searchToken
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            guard let self = self, self.searchToken == token else { return }
            self.searchTimedOut = true
            self.refresh()
        }
        refresh()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        isVisible = false
        searchToken += 1
        discovery.stop()
        manager.sheetUpdate = nil
        manager.sheetError = nil
    }

    @objc private func closeTapped() {
        dismiss(animated: true, completion: nil)
    }

    // MARK: - Aufbau

    private func refresh() {
        var isIdle = false
        if case .idle = manager.state { isIdle = true }
        if isVisible && isIdle {
            if !discovery.isRunning { discovery.start() }
        } else if discovery.isRunning {
            discovery.stop()
            devices = []
        }
        buildSections()
        tableView.reloadData()
    }

    private func buildSections() {
        var result: [SectionModel] = []
        switch manager.state {
        case .connecting(let name):
            result.append(SectionModel(title: nil, footer: nil, rows: [.connecting(name)]))
        case .connected(let name):
            result.append(SectionModel(title: "Verbunden mit", footer: nil, rows: [.connectedName(name)]))
            result.append(SectionModel(
                title: "Steuerung",
                footer: "Das Video läuft auf dem Gerät. Die Lautstärke regelst du an der Fernbedienung des Fernsehers.",
                rows: [.pause, .resume, .sendCurrent]
            ))
            result.append(SectionModel(title: nil, footer: nil, rows: [.disconnect]))
        case .idle:
            var deviceRows: [Row] = devices.map { Row.device($0) }
            var footer: String? = hint
            if devices.isEmpty {
                if searchTimedOut {
                    if footer == nil {
                        footer = "Kein Gerät gefunden. Prüfe, ob iPhone und Gerät im selben WLAN sind, oder verbinde mit dem TV-Code."
                    }
                } else {
                    deviceRows = [.searching]
                }
            }
            result.append(SectionModel(title: "Geräte im WLAN", footer: footer, rows: deviceRows))
            result.append(SectionModel(
                title: "Mit TV-Code verbinden",
                footer: "Den Code findest du in der YouTube-App des Fernsehers unter Einstellungen, Mit TV-Code verknüpfen.",
                rows: [.tvCode]
            ))
            let recents = manager.recentScreens
            if !recents.isEmpty {
                result.append(SectionModel(title: "Zuletzt verbunden", footer: nil, rows: recents.map { Row.recent($0) }))
            }
        }
        sections = result
    }

    private func showError(_ text: String) {
        guard isVisible else { return }
        let alert = UIAlertController(title: "Übertragen", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))
        present(alert, animated: true, completion: nil)
    }

    private func askTVCode() {
        let alert = UIAlertController(
            title: "TV-Code",
            message: "Gib den Code aus der YouTube-App des Fernsehers ein.",
            preferredStyle: .alert
        )
        alert.addTextField { field in
            field.keyboardType = .numberPad
            field.placeholder = "123 456 789 012"
        }
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel, handler: nil))
        alert.addAction(UIAlertAction(title: "Verbinden", style: .default, handler: { [weak self, weak alert] _ in
            let text = alert?.textFields?.first?.text ?? ""
            let cleaned = text.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "-", with: "")
            self?.manager.connect(tvCode: cleaned)
        }))
        present(alert, animated: true, completion: nil)
    }

    // MARK: - Tabelle

    override func numberOfSections(in tableView: UITableView) -> Int {
        return sections.count
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return sections[section].rows.count
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return sections[section].title
    }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        return sections[section].footer
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
        var content = cell.defaultContentConfiguration()
        switch sections[indexPath.section].rows[indexPath.row] {
        case .searching:
            content.text = "Suche …"
            content.textProperties.color = .secondaryLabel
            cell.accessoryView = makeSpinner()
            cell.selectionStyle = .none
        case .device(let device):
            content.text = device.name
            content.image = UIImage(systemName: "tv")
        case .tvCode:
            content.text = "Mit TV-Code verbinden"
            content.image = UIImage(systemName: "number")
        case .recent(let screen):
            content.text = screen.name
            content.secondaryText = "Erneut verbinden"
            content.image = UIImage(systemName: "clock.arrow.circlepath")
        case .connecting(let name):
            content.text = "Verbinde mit \(name) …"
            content.textProperties.color = .secondaryLabel
            cell.accessoryView = makeSpinner()
            cell.selectionStyle = .none
        case .connectedName(let name):
            content.text = name
            content.image = UIImage(systemName: "tv.fill")
            cell.selectionStyle = .none
        case .pause:
            content.text = "Pause"
            content.image = UIImage(systemName: "pause.fill")
        case .resume:
            content.text = "Weiter"
            content.image = UIImage(systemName: "play.fill")
        case .sendCurrent:
            content.text = "Aktuelles Video senden"
            content.image = UIImage(systemName: "arrow.up.right.square")
        case .disconnect:
            content.text = "Trennen"
            content.textProperties.color = .systemRed
        }
        cell.contentConfiguration = content
        return cell
    }

    private func makeSpinner() -> UIActivityIndicatorView {
        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.startAnimating()
        return spinner
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        switch sections[indexPath.section].rows[indexPath.row] {
        case .device(let device):
            manager.connect(device: device)
        case .tvCode:
            askTVCode()
        case .recent(let screen):
            manager.connect(recent: screen)
        case .pause:
            manager.sendControl("pause")
        case .resume:
            manager.sendControl("play")
        case .sendCurrent:
            manager.sendCurrentVideo()
        case .disconnect:
            manager.disconnect()
        case .searching, .connecting, .connectedName:
            break
        }
    }
}
