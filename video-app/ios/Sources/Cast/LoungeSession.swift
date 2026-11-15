import Foundation

enum LoungeError: Error {
    case invalidCode
    case tokenFailed
    case bindFailed
    case network
}

/// Ergebnis der Kopplung per TV-Code.
struct LoungeScreen {
    let screenId: String
    let loungeToken: String
    let name: String
}

/// Fernbedienungs-Sitzung über die Lounge-Schnittstelle (HTTPS). Nur vom Hauptthread benutzen;
/// alle Completion-Handler laufen auf dem Hauptthread.
final class LoungeSession {
    private static let base = "https://www.youtube.com/api/lounge"

    private static let unreserved: CharacterSet = {
        var set = CharacterSet()
        set.insert(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        return set
    }()

    private let screenId: String
    private var token: String?
    private var sid: String?
    private var gsessionId: String?
    private var rid = 0
    private var offset = 0
    private let clientId = UUID().uuidString
    private let session: URLSession

    init(screenId: String, token: String?) {
        self.screenId = screenId
        self.token = token
        self.session = LoungeSession.makeSession()
    }

    // MARK: - Hilfen

    private static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.httpAdditionalHeaders = [
            "Origin": "https://www.youtube.com",
            "Content-Type": "application/x-www-form-urlencoded"
        ]
        return URLSession(configuration: config)
    }

    private static func encode(_ text: String) -> String {
        return text.addingPercentEncoding(withAllowedCharacters: unreserved) ?? ""
    }

    private static func formBody(_ pairs: [(String, String)]) -> Data {
        let text = pairs.map { encode($0.0) + "=" + encode($0.1) }.joined(separator: "&")
        return Data(text.utf8)
    }

    private static func firstMatch(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let ns = text as NSString
        guard let match = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: ns.length)),
              match.numberOfRanges > 1 else { return nil }
        return ns.substring(with: match.range(at: 1))
    }

    /// Schickt ein Formular; Antwort (Status, Text) auf dem Hauptthread. Status -1 = Netzwerkfehler.
    private static func post(session: URLSession, url: String, token: String?, form: [(String, String)],
                             completion: @escaping (Int, String) -> Void) {
        guard let u = URL(string: url) else {
            DispatchQueue.main.async { completion(-1, "") }
            return
        }
        var request = URLRequest(url: u)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("https://www.youtube.com", forHTTPHeaderField: "Origin")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        if let token = token {
            request.setValue(token, forHTTPHeaderField: "X-YouTube-LoungeId-Token")
        }
        request.httpBody = formBody(form)
        let task = session.dataTask(with: request) { data, response, error in
            var status = -1
            var text = ""
            if error == nil, let http = response as? HTTPURLResponse {
                status = http.statusCode
                if let data = data {
                    text = String(decoding: data, as: UTF8.self)
                }
            } else if let error = error {
                CastLog.shared.add("Lounge: Netzwerkfehler: \(error.localizedDescription)")
            }
            DispatchQueue.main.async { completion(status, text) }
        }
        task.resume()
    }

    private static func isOK(_ status: Int) -> Bool {
        return status >= 200 && status < 300
    }

    private static func jsonObject(_ text: String) -> [String: Any]? {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data, options: []) else { return nil }
        return object as? [String: Any]
    }

    // MARK: - TV-Code

    /// Löst einen TV-Code (Ziffern) in screenId, Token und Name auf.
    static func pair(code: String, completion: @escaping (Result<LoungeScreen, LoungeError>) -> Void) {
        let s = makeSession()
        CastLog.shared.add("Lounge: get_screen (TV-Code)")
        post(session: s, url: base + "/pairing/get_screen", token: nil, form: [("pairing_code", code)]) { status, text in
            s.finishTasksAndInvalidate()
            CastLog.shared.add("Lounge: get_screen HTTP \(status)")
            if status < 0 {
                completion(.failure(.network))
                return
            }
            guard isOK(status),
                  let json = jsonObject(text),
                  let screen = json["screen"] as? [String: Any],
                  let screenId = screen["screenId"] as? String, !screenId.isEmpty,
                  let token = screen["loungeToken"] as? String, !token.isEmpty else {
                completion(.failure(status >= 500 ? .network : .invalidCode))
                return
            }
            let name = (screen["name"] as? String) ?? ""
            CastLog.shared.add("Lounge: Token erhalten \(CastLog.short(token))")
            completion(.success(LoungeScreen(screenId: screenId, loungeToken: token, name: name.isEmpty ? "Fernseher" : name)))
        }
    }

    // MARK: - Sitzung

    /// Holt (falls nötig) einen Token und baut die Sitzung auf.
    func connect(completion: @escaping (Result<Void, LoungeError>) -> Void) {
        if token != nil {
            bind { ok in
                completion(ok ? .success(()) : .failure(.bindFailed))
            }
            return
        }
        fetchToken { [weak self] newToken in
            guard let self = self else { return }
            guard let newToken = newToken else {
                completion(.failure(.tokenFailed))
                return
            }
            self.token = newToken
            self.bind { ok in
                completion(ok ? .success(()) : .failure(.bindFailed))
            }
        }
    }

    private func fetchToken(completion: @escaping (String?) -> Void) {
        CastLog.shared.add("Lounge: get_lounge_token_batch")
        LoungeSession.post(session: session, url: LoungeSession.base + "/pairing/get_lounge_token_batch",
                           token: nil, form: [("screen_ids", screenId)]) { status, text in
            CastLog.shared.add("Lounge: Token-Abruf HTTP \(status)")
            guard LoungeSession.isOK(status),
                  let json = LoungeSession.jsonObject(text),
                  let screens = json["screens"] as? [[String: Any]],
                  let first = screens.first,
                  let token = first["loungeToken"] as? String, !token.isEmpty else {
                completion(nil)
                return
            }
            CastLog.shared.add("Lounge: Token erhalten \(CastLog.short(token))")
            completion(token)
        }
    }

    private func bind(completion: @escaping (Bool) -> Void) {
        sid = nil
        gsessionId = nil
        rid = 1
        offset = 0
        let form: [(String, String)] = [
            ("device", "REMOTE_CONTROL"),
            ("id", clientId),
            ("name", "Flimmerfrei"),
            ("mdx-version", "3"),
            ("pairing_type", "cast"),
            ("app", "android-phone-13.14.55")
        ]
        let url = LoungeSession.base + "/bc/bind?RID=\(rid)&VER=8&CVER=1"
        CastLog.shared.add("Lounge: bind")
        LoungeSession.post(session: session, url: url, token: token, form: form) { [weak self] status, text in
            guard let self = self else { return }
            CastLog.shared.add("Lounge: bind HTTP \(status)")
            guard LoungeSession.isOK(status),
                  let newSid = LoungeSession.firstMatch("\"c\",\"(.*?)\",\"", in: text), !newSid.isEmpty else {
                completion(false)
                return
            }
            self.sid = newSid
            self.gsessionId = LoungeSession.firstMatch("\"S\",\"(.*?)\"\\]", in: text)
            CastLog.shared.add("Lounge: SID \(CastLog.short(newSid))")
            completion(true)
        }
    }

    /// Erneuert Token (falls möglich) und bindet neu.
    private func rebind(completion: @escaping (Bool) -> Void) {
        fetchToken { [weak self] newToken in
            guard let self = self else { return }
            if let newToken = newToken { self.token = newToken }
            self.bind(completion: completion)
        }
    }

    // MARK: - Befehle

    /// Sendet einen Befehl (`setPlaylist`, `play`, `pause`, `seekTo`, `stopVideo`).
    /// Parameter-Schlüssel mit führendem Unterstrich, z. B. `_videoId`.
    func send(command: String, params: [String: String], completion: @escaping (Bool) -> Void) {
        sendOnce(command: command, params: params) { [weak self] status in
            guard let self = self else { return }
            if LoungeSession.isOK(status) {
                completion(true)
                return
            }
            if status == 400 || status == 404 || status == 410 {
                CastLog.shared.add("Lounge: \(command) HTTP \(status), neu binden")
                self.rebind { ok in
                    if !ok {
                        completion(false)
                        return
                    }
                    self.sendOnce(command: command, params: params) { status2 in
                        completion(LoungeSession.isOK(status2))
                    }
                }
                return
            }
            completion(false)
        }
    }

    private func sendOnce(command: String, params: [String: String], completion: @escaping (Int) -> Void) {
        guard let sid = sid else {
            completion(400)
            return
        }
        rid += 1
        var url = LoungeSession.base + "/bc/bind?SID=" + LoungeSession.encode(sid)
        if let g = gsessionId {
            url += "&gsessionid=" + LoungeSession.encode(g)
        }
        url += "&RID=\(rid)&VER=8&CVER=1"
        var form: [(String, String)] = [
            ("count", "1"),
            ("ofs", String(offset)),
            ("req0__sc", command)
        ]
        let keys = params.keys.sorted()
        for key in keys {
            form.append(("req0_" + key, params[key] ?? ""))
        }
        offset += 1
        CastLog.shared.add("Lounge: Befehl \(command) (RID \(rid), ofs \(offset - 1))")
        LoungeSession.post(session: session, url: url, token: token, form: form) { status, _ in
            CastLog.shared.add("Lounge: \(command) HTTP \(status)")
            completion(status)
        }
    }

    func close() {
        session.finishTasksAndInvalidate()
    }
}
