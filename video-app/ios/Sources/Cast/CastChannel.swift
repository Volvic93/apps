import Foundation
import Network
import Security

enum CastChannelError: Error {
    case unreachable
    case launchFailed
    case timeout
    case protocolError
}

/// Cast-Verbindung (TLS, Port 8009) zu einem Gerät: startet die YouTube-Anwendung und ermittelt die screenId.
/// Alle Zustände leben auf der eigenen Queue; Rückmeldungen gehen auf den Hauptthread.
final class CastChannel {
    private static let youtubeAppId = "233637DE"
    private static let nsConnection = "urn:x-cast:com.google.cast.tp.connection"
    private static let nsHeartbeat = "urn:x-cast:com.google.cast.tp.heartbeat"
    private static let nsReceiver = "urn:x-cast:com.google.cast.receiver"
    private static let nsMdx = "urn:x-cast:com.google.youtube.mdx"

    /// Hauptthread: Verbindung wurde nach erfolgreichem Aufbau von der Gegenseite beendet.
    var onClosed: (() -> Void)?

    private let endpoint: NWEndpoint
    private let queue = DispatchQueue(label: "flimmerfrei.cast.channel")
    private var connection: NWConnection?
    private var heartbeat: DispatchSourceTimer?
    private var requestId = 0
    private var finished = false
    private var closed = false
    private var started = false
    private var transportConnected = false
    private var mdxRetries = 0
    private var completion: ((Result<String, CastChannelError>) -> Void)?

    init(endpoint: NWEndpoint) {
        self.endpoint = endpoint
    }

    /// Baut die Verbindung auf und liefert die screenId (Zeitlimit insgesamt 20 s).
    func start(completion: @escaping (Result<String, CastChannelError>) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.completion = completion
            self.openConnection()
            self.queue.asyncAfter(deadline: .now() + 20) { [weak self] in
                guard let self = self, !self.finished, !self.closed else { return }
                CastLog.shared.add("Cast: Zeitlimit (20 s) beim Verbinden")
                self.finish(.failure(.timeout))
            }
        }
    }

    /// Schließt die Verbindung (ohne `onClosed`).
    func close() {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.closed = true
            self.completion = nil
            self.shutdown()
        }
    }

    // MARK: - Verbindung

    private func openConnection() {
        let tls = NWProtocolTLS.Options()
        sec_protocol_options_set_verify_block(tls.securityProtocolOptions, { _, _, complete in
            complete(true)
        }, queue)
        let params = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
        let conn = NWConnection(to: endpoint, using: params)
        connection = conn
        conn.stateUpdateHandler = { [weak self] state in
            self?.handleState(state)
        }
        CastLog.shared.add("Cast: Verbindung wird aufgebaut")
        conn.start(queue: queue)
    }

    private func handleState(_ state: NWConnection.State) {
        switch state {
        case .ready:
            if started { return }
            started = true
            CastLog.shared.add("Cast: TLS verbunden")
            send(namespace: CastChannel.nsConnection, destination: "receiver-0", json: ["type": "CONNECT"])
            startHeartbeat()
            receiveHeader()
            requestId += 1
            let launch: [String: Any] = [
                "type": "LAUNCH",
                "appId": CastChannel.youtubeAppId,
                "requestId": requestId
            ]
            send(namespace: CastChannel.nsReceiver, destination: "receiver-0", json: launch)
        case .waiting(let error):
            CastLog.shared.add("Cast: Verbindung wartet: \(error)")
        case .failed(let error):
            CastLog.shared.add("Cast: Verbindung fehlgeschlagen: \(error)")
            connectionLost()
        default:
            break
        }
    }

    private func connectionLost() {
        if closed { return }
        if !finished {
            finish(.failure(.unreachable))
            return
        }
        closed = true
        shutdown()
        CastLog.shared.add("Cast: Verbindung zum Gerät beendet")
        DispatchQueue.main.async { [weak self] in
            self?.onClosed?()
        }
    }

    private func shutdown() {
        if let timer = heartbeat {
            timer.cancel()
            heartbeat = nil
        }
        if let conn = connection {
            conn.stateUpdateHandler = nil
            conn.cancel()
            connection = nil
        }
    }

    private func finish(_ result: Result<String, CastChannelError>) {
        if finished { return }
        finished = true
        if case .failure = result {
            closed = true
            shutdown()
        }
        let handler = completion
        completion = nil
        DispatchQueue.main.async {
            handler?(result)
        }
    }

    // MARK: - Senden

    private func startHeartbeat() {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + 5, repeating: 5)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            self.send(namespace: CastChannel.nsHeartbeat, destination: "receiver-0", json: ["type": "PING"], quiet: true)
        }
        heartbeat = timer
        timer.resume()
    }

    private func send(namespace: String, destination: String, json: [String: Any], quiet: Bool = false) {
        guard let conn = connection, !closed else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: json, options: []),
              let text = String(data: data, encoding: .utf8) else { return }
        if !quiet {
            let type = (json["type"] as? String) ?? "?"
            CastLog.shared.add("Cast: senden \(type) an \(destination)")
        }
        let body = CastProtobuf.encode(sourceId: "sender-0", destinationId: destination, namespace: namespace, payload: text)
        conn.send(content: CastProtobuf.frame(body), completion: .contentProcessed({ error in
            if let error = error {
                CastLog.shared.add("Cast: Senden fehlgeschlagen: \(error)")
            }
        }))
    }

    private func sendMdxStatusRequest() {
        guard let transport = transportId else { return }
        send(namespace: CastChannel.nsMdx, destination: transport, json: ["type": "getMdxSessionStatus"])
    }

    private var transportId: String?

    // MARK: - Empfangen

    private func receiveHeader() {
        guard let conn = connection, !closed else { return }
        conn.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, _, _, error in
            guard let self = self else { return }
            if let error = error {
                CastLog.shared.add("Cast: Empfang fehlgeschlagen: \(error)")
                self.connectionLost()
                return
            }
            guard let data = data, data.count == 4 else {
                CastLog.shared.add("Cast: Gegenstelle hat die Verbindung geschlossen")
                self.connectionLost()
                return
            }
            var length = 0
            for b in data {
                length = (length << 8) | Int(b)
            }
            if length > 1_048_576 {
                CastLog.shared.add("Cast: Nachricht zu groß (\(length) Byte)")
                self.connectionLost()
                return
            }
            if length == 0 {
                self.receiveHeader()
                return
            }
            self.receiveBody(length)
        }
    }

    private func receiveBody(_ length: Int) {
        guard let conn = connection, !closed else { return }
        conn.receive(minimumIncompleteLength: length, maximumLength: length) { [weak self] data, _, _, error in
            guard let self = self else { return }
            if let error = error {
                CastLog.shared.add("Cast: Empfang fehlgeschlagen: \(error)")
                self.connectionLost()
                return
            }
            guard let data = data, data.count == length else {
                CastLog.shared.add("Cast: unvollständige Nachricht")
                self.connectionLost()
                return
            }
            if let message = CastProtobuf.decode(data) {
                self.handle(message)
            } else {
                CastLog.shared.add("Cast: Nachricht nicht lesbar")
            }
            self.receiveHeader()
        }
    }

    private func handle(_ message: CastMessage) {
        guard let payloadData = message.payload.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: payloadData, options: []),
              let json = object as? [String: Any],
              let type = json["type"] as? String else { return }
        switch message.namespace {
        case CastChannel.nsHeartbeat:
            if type == "PING" {
                send(namespace: CastChannel.nsHeartbeat, destination: message.sourceId, json: ["type": "PONG"], quiet: true)
            }
        case CastChannel.nsReceiver:
            handleReceiver(type: type, json: json)
        case CastChannel.nsMdx:
            handleMdx(type: type, json: json)
        default:
            break
        }
    }

    private func handleReceiver(type: String, json: [String: Any]) {
        switch type {
        case "RECEIVER_STATUS":
            guard let status = json["status"] as? [String: Any],
                  let apps = status["applications"] as? [[String: Any]] else {
                CastLog.shared.add("Cast: Status ohne Anwendung")
                return
            }
            var found: [String: Any]?
            for app in apps {
                if (app["appId"] as? String) == CastChannel.youtubeAppId {
                    found = app
                    break
                }
            }
            guard let youtube = found, let transport = youtube["transportId"] as? String, !transport.isEmpty else {
                CastLog.shared.add("Cast: Status ohne YouTube-Anwendung")
                return
            }
            if transportConnected { return }
            transportConnected = true
            transportId = transport
            CastLog.shared.add("Cast: YouTube läuft, transportId \(CastLog.short(transport))")
            send(namespace: CastChannel.nsConnection, destination: transport, json: ["type": "CONNECT"])
            sendMdxStatusRequest()
            scheduleMdxRetry()
        case "LAUNCH_ERROR":
            let reason = (json["reason"] as? String) ?? "unbekannt"
            CastLog.shared.add("Cast: LAUNCH_ERROR (\(reason))")
            finish(.failure(.launchFailed))
        case "INVALID_REQUEST":
            let reason = (json["reason"] as? String) ?? "unbekannt"
            CastLog.shared.add("Cast: INVALID_REQUEST (\(reason))")
        default:
            break
        }
    }

    private func handleMdx(type: String, json: [String: Any]) {
        CastLog.shared.add("Cast: empfangen \(type)")
        guard type == "mdxSessionStatus" else { return }
        guard let data = json["data"] as? [String: Any],
              let screenId = data["screenId"] as? String, !screenId.isEmpty else {
            CastLog.shared.add("Cast: mdxSessionStatus ohne screenId")
            return
        }
        CastLog.shared.add("Cast: screenId \(CastLog.short(screenId))")
        finish(.success(screenId))
    }

    /// Wiederholt `getMdxSessionStatus` alle 3 s (höchstens 4-mal), solange keine Antwort da ist.
    private func scheduleMdxRetry() {
        queue.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self = self, !self.finished, !self.closed else { return }
            if self.mdxRetries >= 4 { return }
            self.mdxRetries += 1
            CastLog.shared.add("Cast: getMdxSessionStatus wiederholt (\(self.mdxRetries))")
            self.sendMdxStatusRequest()
            self.scheduleMdxRetry()
        }
    }
}
