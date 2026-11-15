import Foundation

/// Die für Chromecast nötigen Felder einer `CastMessage`.
struct CastMessage {
    var sourceId: String = ""
    var destinationId: String = ""
    var namespace: String = ""
    var payload: String = ""
}

/// Protobuf von Hand: Kodieren/Dekodieren von `CastMessage` und Rahmung (4 Byte Länge, Big-Endian).
enum CastProtobuf {
    // MARK: - Kodieren

    private static func appendVarint(_ value: UInt64, to bytes: inout [UInt8]) {
        var v = value
        while v >= 0x80 {
            bytes.append(UInt8(v & 0x7F) | 0x80)
            v >>= 7
        }
        bytes.append(UInt8(v))
    }

    private static func appendString(_ text: String, field: Int, to bytes: inout [UInt8]) {
        let data = [UInt8](text.utf8)
        appendVarint(UInt64((field << 3) | 2), to: &bytes)
        appendVarint(UInt64(data.count), to: &bytes)
        bytes.append(contentsOf: data)
    }

    /// Baut eine `CastMessage` (Text-Nutzlast) als Protobuf-Bytes.
    static func encode(sourceId: String, destinationId: String, namespace: String, payload: String) -> Data {
        var bytes: [UInt8] = []
        appendVarint(UInt64(1 << 3), to: &bytes)      // 1 protocol_version
        appendVarint(0, to: &bytes)                   // CASTV2_1_0
        appendString(sourceId, field: 2, to: &bytes)
        appendString(destinationId, field: 3, to: &bytes)
        appendString(namespace, field: 4, to: &bytes)
        appendVarint(UInt64(5 << 3), to: &bytes)      // 5 payload_type
        appendVarint(0, to: &bytes)                   // 0 = Text
        appendString(payload, field: 6, to: &bytes)
        return Data(bytes)
    }

    /// Stellt die 4 Byte Länge (Big-Endian) voran.
    static func frame(_ body: Data) -> Data {
        let n = body.count
        var bytes: [UInt8] = [
            UInt8((n >> 24) & 0xFF),
            UInt8((n >> 16) & 0xFF),
            UInt8((n >> 8) & 0xFF),
            UInt8(n & 0xFF)
        ]
        bytes.append(contentsOf: [UInt8](body))
        return Data(bytes)
    }

    // MARK: - Dekodieren

    private static func readVarint(_ bytes: [UInt8], _ pos: inout Int) -> UInt64? {
        var result: UInt64 = 0
        var shift: UInt64 = 0
        while pos < bytes.count {
            let b = bytes[pos]
            pos += 1
            result |= UInt64(b & 0x7F) << shift
            if b & 0x80 == 0 { return result }
            shift += 7
            if shift > 63 { return nil }
        }
        return nil
    }

    /// Liest eine `CastMessage`; unbekannte Felder werden übersprungen. Bei kaputten Daten `nil`.
    static func decode(_ data: Data) -> CastMessage? {
        let bytes = [UInt8](data)
        var pos = 0
        var message = CastMessage()
        while pos < bytes.count {
            guard let tag = readVarint(bytes, &pos) else { return nil }
            let field = Int(tag >> 3)
            let wire = Int(tag & 7)
            switch wire {
            case 0:
                guard readVarint(bytes, &pos) != nil else { return nil }
            case 1:
                pos += 8
                if pos > bytes.count { return nil }
            case 2:
                guard let len64 = readVarint(bytes, &pos) else { return nil }
                if len64 > UInt64(bytes.count) { return nil }
                let len = Int(len64)
                if pos + len > bytes.count { return nil }
                let slice = Array(bytes[pos..<(pos + len)])
                pos += len
                let text = String(decoding: slice, as: UTF8.self)
                switch field {
                case 2: message.sourceId = text
                case 3: message.destinationId = text
                case 4: message.namespace = text
                case 6: message.payload = text
                default: break
                }
            case 5:
                pos += 4
                if pos > bytes.count { return nil }
            default:
                return nil
            }
        }
        return message
    }
}
