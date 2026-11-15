import Capacitor
import UIKit

/// Eigene Capacitor-Ansicht, die das lokale Plugin für die Live-Aktivität anmeldet.
class EisenzeitViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EisenzeitLiveActivityPlugin())
    }
}
