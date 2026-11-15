import Foundation
import Network

/// Ein im WLAN gefundenes Cast-Gerät.
struct CastDevice {
    let id: String
    let name: String
    let endpoint: NWEndpoint
}

/// Sucht per Bonjour nach `_googlecast._tcp`. Alle Rückmeldungen laufen auf dem Hauptthread.
final class CastDiscovery {
    /// Liste der Geräte und ggf. ein Hinweistext (z. B. fehlender Zugriff aufs lokale Netzwerk).
    var onUpdate: (([CastDevice], String?) -> Void)?

    private(set) var devices: [CastDevice] = []
    private(set) var hint: String?
    private var browser: NWBrowser?

    var isRunning: Bool { return browser != nil }

    func start() {
        if browser != nil { return }
        devices = []
        hint = nil
        let b = NWBrowser(for: .bonjourWithTXTRecord(type: "_googlecast._tcp", domain: nil), using: .tcp)
        browser = b
        CastLog.shared.add("Suche nach Geräten gestartet")
        b.stateUpdateHandler = { [weak self, weak b] state in
            guard let self = self, let b = b, self.browser === b else { return }
            switch state {
            case .waiting(let error):
                CastLog.shared.add("Suche wartet: \(error)")
                self.hint = "Kein Zugriff aufs lokale Netzwerk. Erlaube ihn in den iOS-Einstellungen unter Datenschutz und Sicherheit, Lokales Netzwerk."
                self.notify()
            case .failed(let error):
                CastLog.shared.add("Suche fehlgeschlagen: \(error)")
                self.hint = "Die Suche im WLAN ist fehlgeschlagen. Prüfe den Zugriff aufs lokale Netzwerk in den iOS-Einstellungen."
                self.notify()
            case .ready:
                CastLog.shared.add("Suche bereit")
                self.hint = nil
                self.notify()
            default:
                break
            }
        }
        b.browseResultsChangedHandler = { [weak self, weak b] results, _ in
            guard let self = self, let b = b, self.browser === b else { return }
            self.apply(results)
        }
        b.start(queue: DispatchQueue.main)
    }

    func stop() {
        guard let b = browser else { return }
        browser = nil
        b.cancel()
        CastLog.shared.add("Suche beendet")
    }

    private func apply(_ results: Set<NWBrowser.Result>) {
        var byId: [String: CastDevice] = [:]
        for result in results {
            guard case let .service(serviceName, _, _, _) = result.endpoint else { continue }
            var name = serviceName
            var id = serviceName
            if case let .bonjour(txt) = result.metadata {
                if let fn = txt["fn"], !fn.isEmpty { name = fn }
                if let identifier = txt["id"], !identifier.isEmpty { id = identifier }
            }
            byId[id] = CastDevice(id: id, name: name, endpoint: result.endpoint)
        }
        let sorted = byId.values.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        let oldIds = Set(devices.map { $0.id })
        for d in sorted where !oldIds.contains(d.id) {
            CastLog.shared.add("Gerät gefunden: \(d.name)")
        }
        devices = sorted
        notify()
    }

    private func notify() {
        onUpdate?(devices, hint)
    }
}
